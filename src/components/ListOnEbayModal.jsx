import React, { useState, useEffect } from 'react';
import { ebayAPI } from '../services/api';

const CONDITION_OPTIONS = [
  { id: 1000, label: 'New' },
  { id: 1500, label: 'New Other' },
  { id: 2000, label: 'Certified Refurbished' },
  { id: 2500, label: 'Seller Refurbished' },
  { id: 3000, label: 'Used - Like New' },
  { id: 4000, label: 'Used - Very Good' },
  { id: 5000, label: 'Used - Good' },
  { id: 6000, label: 'Used - Acceptable' },
  { id: 7000, label: 'For Parts or Not Working' },
];

export default function ListOnEbayModal({ item, onClose, isDark }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    quantity: '1',
    categoryId: '',
    conditionId: 1000,
    freeShipping: true,
    dispatchTimeMax: '3',
    // Business policy IDs — auto-filled from seller snapshot
    paymentPolicyId: '',
    returnPolicyId: '',
    fulfillmentPolicyId: '',
  });

  // ── Seller policies (from /ebay/status) ───────────────────────────────────
  const [sellerPolicies, setSellerPolicies] = useState({
    returnPolicies: [],
    paymentPolicies: [],
    fulfillmentPolicies: [],
    businessPolicyIds: {},
  });
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  // ── Item specifics (from fresh scrape) ───────────────────────────────────
  const [itemSpecifics, setItemSpecifics] = useState([]);
  const [loadingSpecifics, setLoadingSpecifics] = useState(false);

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Fetch seller policies on mount via GET /ebay/status
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPolicies() {
      try {
        setLoadingPolicies(true);
        const res = await ebayAPI.getStatus();
        if (cancelled) return;

        const snapshot = res?.data?.sellerSnapshot || {};

        // Guard: if seller registration not completed the Account API returns 400 —
        // skip silently instead of crashing; policies will just be empty.
        if (snapshot.sellerRegistrationCompleted === false) {
          setSellerPolicies({
            returnPolicies: [],
            paymentPolicies: [],
            fulfillmentPolicies: [],
            businessPolicyIds: snapshot.businessPolicyIds || {},
          });
          return;
        }

        setSellerPolicies({
          returnPolicies: snapshot.returnPolicies || [],
          paymentPolicies: snapshot.paymentPolicies || [],
          fulfillmentPolicies: snapshot.fulfillmentPolicies || [],
          businessPolicyIds: snapshot.businessPolicyIds || {},
        });
      } catch (err) {
        console.error('[ListOnEbayModal] Failed to load seller policies:', err);
      } finally {
        if (!cancelled) setLoadingPolicies(false);
      }
    }

    loadPolicies();
    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Pre-fill form from item + re-scrape for leaf category & item specifics
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!item) return;

    // Immediately populate what we already know
    setForm((prev) => ({
      ...prev,
      title: String(item.title || '').slice(0, 80),
      description: String(item.description || item.title || ''),
      price: item.priceValue ? String(Number(item.priceValue).toFixed(2)) : '',
      categoryId: String(item.categoryId || item.raw?.categoryId || ''),
    }));

    // Show any pre-existing specifics while fresh scrape loads
    if (Array.isArray(item.itemSpecifics) && item.itemSpecifics.length > 0) {
      setItemSpecifics(item.itemSpecifics);
    }

    // Resolve canonical listing URL to re-scrape
    const itemUrl =
      item.itemUrl ||
      item.ebayUrl ||
      item.url ||
      item.raw?.itemWebUrl ||
      item.raw?.itemUrl ||
      (item.legacyItemId ? `https://www.ebay.com/itm/${item.legacyItemId}` : null) ||
      (item.itemId ? `https://www.ebay.com/itm/${item.itemId}` : null);

    if (!itemUrl) return;

    let cancelled = false;
    setLoadingSpecifics(true);

    ebayAPI
      .scrapeItemDetails(itemUrl)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};

        // ── Leaf category ID from breadcrumb ──────────────────────────────
        if (data.categoryId) {
          setForm((prev) => ({ ...prev, categoryId: String(data.categoryId) }));
        }

        // ── Item specifics ────────────────────────────────────────────────
        if (Array.isArray(data.itemSpecifics) && data.itemSpecifics.length > 0) {
          setItemSpecifics(data.itemSpecifics);
        }
      })
      .catch((err) => {
        console.warn('[ListOnEbayModal] scrapeItemDetails failed (non-fatal):', err?.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSpecifics(false);
      });

    return () => { cancelled = true; };
  }, [item]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Auto-fill policy IDs once policies have loaded
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const bpIds = sellerPolicies.businessPolicyIds || {};

    // businessPolicyIds are the eBay-recommended defaults; fall back to first in list
    const paymentPolicyId =
      bpIds.paymentPolicyId ||
      sellerPolicies.paymentPolicies[0]?.paymentPolicyId ||
      '';
    const returnPolicyId =
      bpIds.returnPolicyId ||
      sellerPolicies.returnPolicies[0]?.returnPolicyId ||
      '';
    const fulfillmentPolicyId =
      bpIds.shippingPolicyId ||
      sellerPolicies.fulfillmentPolicies[0]?.fulfillmentPolicyId ||
      '';

    setForm((prev) => ({ ...prev, paymentPolicyId, returnPolicyId, fulfillmentPolicyId }));
  }, [sellerPolicies]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.title.trim()) return setError('Title is required');
    if (!form.price || Number(form.price) <= 0) return setError('Price must be a positive number');
    if (!form.categoryId.trim()) return setError('Category ID is required');

    try {
      setSubmitting(true);

      const pictureUrls = [];
      if (item?.imageUrl) pictureUrls.push(item.imageUrl);
      if (Array.isArray(item?.additionalImages)) {
        pictureUrls.push(...item.additionalImages.slice(0, 11));
      }

      // Convert specifics array → key/value map that quick-list backend expects
      const itemSpecificsMap = {};
      itemSpecifics.forEach(({ name, label, value }) => {
        const key = name || label;
        if (key && value) itemSpecificsMap[key] = value;
      });

      const res = await ebayAPI.quickList({
        title: form.title.trim(),
        description: form.description.trim() || form.title.trim(),
        price: Number(form.price),
        quantity: Math.max(1, Number(form.quantity) || 1),
        categoryId: form.categoryId.trim(),
        conditionId: Number(form.conditionId),
        freeShipping: form.freeShipping,
        dispatchTimeMax: Number(form.dispatchTimeMax) || 3,
        currency: 'USD',
        pictureUrls,
        itemSpecifics: Object.keys(itemSpecificsMap).length > 0 ? itemSpecificsMap : null,
        // Only include policy IDs when actually selected
        ...(form.paymentPolicyId ? { paymentPolicyId: form.paymentPolicyId } : {}),
        ...(form.returnPolicyId ? { returnPolicyId: form.returnPolicyId } : {}),
        ...(form.fulfillmentPolicyId ? { fulfillmentPolicyId: form.fulfillmentPolicyId } : {}),
      });

      setResult(res?.data || {});
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to list on eBay');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const base = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
  }`;

  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const divider = `border-t my-1 ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`;
  const sectionBox = `rounded-xl border p-4 space-y-3 ${
    isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'
  }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${base}`}>

        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <h2 className="text-lg font-semibold">List on eBay</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Using your active eBay account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
          >
            ✕
          </button>
        </div>

        {/* ── Success state ── */}
        {result ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4">
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                ✅ Listed successfully!
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Item ID: <span className="font-mono font-semibold">{result.itemId}</span>
              </p>
              {result.listingUrl && (
                <a
                  href={result.listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 text-xs text-blue-600 hover:underline font-medium"
                >
                  View on eBay →
                </a>
              )}
              {result.warnings?.length > 0 && (
                <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  <p className="font-semibold">Warnings:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w?.message || String(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2">
                Close
              </button>
              <button
                type="button"
                onClick={() => { setResult(null); setError(null); }}
                className="btn-primary flex-1 py-2"
              >
                List Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {/* Item preview */}
            {item?.imageUrl && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
              }`}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{item.title}</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Original price: ${Number(item.priceValue || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className={labelClass}>
                Title <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                className={inputClass}
                maxLength={80}
                placeholder="Listing title (max 80 chars)"
                disabled={submitting}
              />
              <p className="text-xs text-slate-400 mt-0.5">{form.title.length}/80</p>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder="Item description"
                disabled={submitting}
              />
            </div>

            {/* Price & Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Price (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="0.00"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="1"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Category ID — auto-populated from breadcrumb scrape */}
            <div>
              <label className={labelClass}>
                Category ID <span className="text-red-500">*</span>
                {loadingSpecifics && (
                  <span className="ml-1.5 font-normal text-blue-400 text-xs animate-pulse">
                    auto-detecting…
                  </span>
                )}
              </label>
              <input
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 43304"
                disabled={submitting}
              />
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Auto-extracted from the listing's breadcrumb (leaf category)
              </p>
            </div>

            {/* Condition */}
            <div>
              <label className={labelClass}>Condition</label>
              <select
                name="conditionId"
                value={form.conditionId}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Shipping */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Dispatch Time (days)</label>
                <input
                  name="dispatchTimeMax"
                  type="number"
                  min="0"
                  max="30"
                  value={form.dispatchTimeMax}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="freeShipping"
                    checked={form.freeShipping}
                    onChange={handleChange}
                    disabled={submitting}
                  />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Free Shipping
                  </span>
                </label>
              </div>
            </div>

            <div className={divider} />

            {/* ── Seller Policies ── */}
            <div className={sectionBox}>
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Seller Policies
                {loadingPolicies && (
                  <span className="ml-1.5 font-normal text-blue-400 animate-pulse">loading…</span>
                )}
              </p>

              {/* Payment Policy */}
              <div>
                <label className={labelClass}>Payment Policy</label>
                <select
                  name="paymentPolicyId"
                  value={form.paymentPolicyId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting || loadingPolicies}
                >
                  <option value="">
                    {sellerPolicies.paymentPolicies.length === 0
                      ? 'No policies found — account default will apply'
                      : 'Select Payment Policy'}
                  </option>
                  {sellerPolicies.paymentPolicies.map((p) => (
                    <option key={p.paymentPolicyId} value={p.paymentPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Return Policy */}
              <div>
                <label className={labelClass}>Return Policy</label>
                <select
                  name="returnPolicyId"
                  value={form.returnPolicyId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting || loadingPolicies}
                >
                  <option value="">
                    {sellerPolicies.returnPolicies.length === 0
                      ? 'No policies found — account default will apply'
                      : 'Select Return Policy'}
                  </option>
                  {sellerPolicies.returnPolicies.map((p) => (
                    <option key={p.returnPolicyId} value={p.returnPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fulfillment / Shipping Policy */}
              <div>
                <label className={labelClass}>Shipping Policy</label>
                <select
                  name="fulfillmentPolicyId"
                  value={form.fulfillmentPolicyId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting || loadingPolicies}
                >
                  <option value="">
                    {sellerPolicies.fulfillmentPolicies.length === 0
                      ? 'No policies found — account default will apply'
                      : 'Select Shipping Policy'}
                  </option>
                  {sellerPolicies.fulfillmentPolicies.map((p) => (
                    <option key={p.fulfillmentPolicyId} value={p.fulfillmentPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Item Specifics ── */}
            {(loadingSpecifics || itemSpecifics.length > 0) && (
              <>
                <div className={divider} />
                <div>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Item Specifics
                    {loadingSpecifics && (
                      <span className="ml-1.5 font-normal text-blue-400 animate-pulse">fetching…</span>
                    )}
                  </p>

                  {loadingSpecifics && itemSpecifics.length === 0 ? (
                    <div className={`rounded-lg border px-3 py-2.5 text-xs ${
                      isDark
                        ? 'border-slate-700 bg-slate-800/40 text-slate-500'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      Loading item specifics from listing…
                    </div>
                  ) : (
                    <div className={`rounded-lg border overflow-hidden text-xs divide-y max-h-52 overflow-y-auto ${
                      isDark ? 'border-slate-700 divide-slate-700' : 'border-slate-200 divide-slate-100'
                    }`}>
                      {itemSpecifics.map((spec, i) => {
                        const specLabel = spec.name || spec.label || '';
                        const specValue = spec.value || '';
                        return (
                          <div
                            key={`${specLabel}-${i}`}
                            className={`grid grid-cols-2 gap-3 px-3 py-1.5 ${
                              isDark ? 'bg-slate-800/50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            }`}
                          >
                            <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {specLabel}
                            </span>
                            <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                              {specValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Warning */}
            <div className={`rounded-xl border p-3 text-xs ${
              isDark
                ? 'border-amber-800 bg-amber-950/20 text-amber-200'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              ⚠️ This will create a <strong>live listing</strong> on your active eBay seller account immediately.
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary flex-1 py-2.5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Listing…
                  </>
                ) : (
                  'List on eBay'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
