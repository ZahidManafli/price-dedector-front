// Utility: Convert Markdown to plain text
function markdownToPlainText(md) {
  return String(md)
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/#+\s?(.*)/g, '$1') // headings
    .replace(/\n/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[.*?\]\(.*?\)/g, '') // links
    .replace(/[`>\-]/g, '') // code, blockquote, lists
    .replace(/\s+/g, ' ')
    .trim();
}

// Utility: Wrap in CDATA, removing any existing CDATA
function wrapDescriptionCdata(desc) {
  const cleaned = String(desc).replace(/<!\[CDATA\[|\]\]>/g, '');
  return `<![CDATA[${cleaned}]]>`;
}
/**
 * ListOnEbayModal.jsx  (updated)
 *
 * Changes vs original:
 *  1. New `scrapedOverride` prop — when provided (from bucket), pre-fills the form
 *     with already-scraped data and skips the re-scrape network call.
 *  2. New `onSuccess` prop — called with the listing result when listing succeeds.
 *     The parent (BucketDrawer) uses this to record the successful listing and
 *     remove the item from the bucket.
 *  3. Everything else is identical to the original.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ebayAPI, dewisoAPI } from '../services/api';

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

// ─── ImageEditModal ────────────────────────────────────────────────────────────
function ImageEditModal({ isDark, currentUrl, imageIndex, onConfirm, onClose }) {
  const [tab, setTab] = useState('url');
  const [urlInput, setUrlInput] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleConfirm = async () => {
    setError(null);
    if (tab === 'url') {
      const trimmed = urlInput.trim();
      if (!trimmed) return setError('Please enter an image URL');
      onConfirm({ displayUrl: trimmed, ebayUrl: trimmed });
      return;
    }
    if (!file) return setError('Please select an image file');
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('images', file);
      formData.append('templateId', `listing-image-edit-${Date.now()}`);
      const res = await dewisoAPI.uploadImages(formData);
      const items = res?.data?.items || [];
      const first = items[0];
      if (!first) throw new Error('Upload returned no items');
      if (first.status === 'failed') throw new Error(first.error || 'Image upload failed');
      const ebayUrl = first.ebayUrl || first.localUrl;
      const displayUrl = first.localUrl || first.ebayUrl;
      if (!ebayUrl) throw new Error('No eBay image URL returned — reconnect your eBay account');
      onConfirm({ displayUrl, ebayUrl });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const overlay = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4';
  const card = `rounded-2xl border shadow-2xl w-full max-w-sm ${
    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
  }`;
  const tabBtn = (active) =>
    `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
      active
        ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
    }`;
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
  }`;

  return (
    <div className={overlay}>
      <div className={card}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <h3 className="text-sm font-semibold">Edit Image {imageIndex + 1}</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Replace with a URL or upload from your computer
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {currentUrl && (
            <div className={`rounded-xl overflow-hidden border aspect-video flex items-center justify-center ${
              isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
            }`}>
              <img src={filePreview || currentUrl} alt="Current" className="max-h-36 object-contain" />
            </div>
          )}
          <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button type="button" className={tabBtn(tab === 'url')} onClick={() => setTab('url')}>🔗 Paste URL</button>
            <button type="button" className={tabBtn(tab === 'upload')} onClick={() => setTab('upload')}>💻 Upload File</button>
          </div>
          {tab === 'url' && (
            <div className="space-y-2">
              <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Image URL</label>
              <input
                type="url" value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                className={inputClass} placeholder="https://example.com/image.jpg"
              />
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                The URL will be sent directly to eBay as the listing image.
              </p>
            </div>
          )}
          {tab === 'upload' && (
            <div className="space-y-2">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  isDark
                    ? 'border-slate-600 hover:border-blue-500 bg-slate-800/40'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50'
                }`}
              >
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="mx-auto max-h-28 object-contain rounded-lg" />
                ) : (
                  <>
                    <div className="text-2xl mb-2">📁</div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Click or drag & drop an image</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>JPG, PNG, WEBP · max 5 MB</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {file && (
                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Image will be uploaded to eBay Picture Services and linked to your listing.
              </p>
            </div>
          )}
          {error && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              isDark ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600'
            }`}>
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={uploading} className="btn-secondary flex-1 py-2 text-sm disabled:opacity-60">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={uploading} className="btn-primary flex-1 py-2 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Uploading…
                </>
              ) : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ListOnEbayModal ───────────────────────────────────────────────────────────
/**
 * @param {object}   item            - The raw eBay browse result item
 * @param {object}  [scrapedOverride] - Pre-scraped data from bucket (skips re-scrape)
 * @param {boolean}  isDark
 * @param {function} onClose
 * @param {function} [onSuccess]     - Called with listing result on successful list
 */
export default function ListOnEbayModal({ item, scrapedOverride, onClose, isDark, onSuccess, onUpdateItem }) {
  // If scrapedOverride is present, we are editing a bucket item
  const isEditBucketItem = !!scrapedOverride && typeof onUpdateItem === 'function';
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    quantity: '1',
    categoryId: '',
    conditionId: 1000,
    freeShipping: true,
    dispatchTimeMax: '3',
    paymentPolicyId: '',
    returnPolicyId: '',
    fulfillmentPolicyId: '',
  });
  const MARKETPLACE_OPTIONS = [
    { id: 'EBAY_US', label: 'United States', country: 'US' },
    { id: 'EBAY_GB', label: 'United Kingdom', country: 'GB' },
    { id: 'EBAY_DE', label: 'Germany', country: 'DE' },
    { id: 'EBAY_AZ', label: 'Azerbaijan', country: 'AZ' },
    // Add more as needed
  ];
    
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    quantity: '1',
    categoryId: '',
    conditionId: 1000,
    freeShipping: true,
    dispatchTimeMax: '3',
    paymentPolicyId: '',
    returnPolicyId: '',
    fulfillmentPolicyId: '',
    marketplaceId: MARKETPLACE_OPTIONS[0].id,
    country: MARKETPLACE_OPTIONS[0].country,
  });

  const [sellerPolicies, setSellerPolicies] = useState({
    returnPolicies: [],
    paymentPolicies: [],
    fulfillmentPolicies: [],
    businessPolicyIds: {},
  });
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [itemSpecifics, setItemSpecifics] = useState([]);
  const [displayUrls, setDisplayUrls] = useState([]);
  const [ebayUrls, setEbayUrls] = useState([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [loadingSpecifics, setLoadingSpecifics] = useState(false);
  const [editingImageIdx, setEditingImageIdx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ── 1. Fetch seller policies ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadPolicies() {
      try {
        setLoadingPolicies(true);
        const res = await ebayAPI.getStatus();
        if (cancelled) return;
        const snapshot = res?.data?.sellerSnapshot || {};
        if (snapshot.sellerRegistrationCompleted === false) {
          setSellerPolicies({ returnPolicies: [], paymentPolicies: [], fulfillmentPolicies: [], businessPolicyIds: snapshot.businessPolicyIds || {} });
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

  // ── 2. Pre-fill form + scrape item details ────────────────────────────────
  useEffect(() => {
    if (!item) return;

    // ── If bucket already scraped — use override directly, no re-scrape ──
    if (scrapedOverride) {
      const upscale = (url) => String(url || '').replace(/\/s-l\d+(\.\w+)(\?.*)?$/, '/s-l1600$1$2');
      const overridePics = Array.isArray(scrapedOverride.pictureUrls)
        ? scrapedOverride.pictureUrls
        : item.imageUrl ? [upscale(item.imageUrl)] : [];

      setForm((prev) => ({
        ...prev,
        title: String(scrapedOverride.title || item.title || '').slice(0, 80),
        description: String(scrapedOverride.description || item.title || ''),
        price: scrapedOverride.price != null ? String(Number(scrapedOverride.price).toFixed(2)) : '',
        quantity: String(scrapedOverride.quantity || 1),
        categoryId: String(scrapedOverride.categoryId || item.categoryId || item.raw?.categoryId || ''),
        conditionId: scrapedOverride.conditionId ?? 1000,
        freeShipping: scrapedOverride.freeShipping ?? true,
        dispatchTimeMax: String(scrapedOverride.dispatchTimeMax || 3),
      }));
      setItemSpecifics(scrapedOverride.itemSpecifics || []);
      setDisplayUrls(overridePics);
      setEbayUrls(overridePics);
      return; // Skip the normal scrape path
    }

    // ── Normal path (no override) ─────────────────────────────────────────
    setForm((prev) => ({
      ...prev,
      title: String(item.title || '').slice(0, 80),
      description: String(item.description || item.title || ''),
      price: item.priceValue ? String(Number(item.priceValue).toFixed(2)) : '',
      categoryId: String(item.categoryId || item.raw?.categoryId || ''),
    }));

    if (Array.isArray(item.itemSpecifics) && item.itemSpecifics.length > 0) {
      setItemSpecifics(item.itemSpecifics);
    }

    const itemUrl =
      item.itemUrl || item.ebayUrl || item.url || item.raw?.itemWebUrl || item.raw?.itemUrl ||
      (item.legacyItemId ? `https://www.ebay.com/itm/${item.legacyItemId}` : null) ||
      (item.itemId ? `https://www.ebay.com/itm/${item.itemId}` : null);

    const upscale = (url) => String(url || '').replace(/\/s-l\d+(\.\w+)(\?.*)?$/, '/s-l1600$1$2');
    const initialUrls = [];
    if (item?.imageUrl) initialUrls.push(upscale(item.imageUrl));
    if (Array.isArray(item?.additionalImages)) {
      item.additionalImages.slice(0, 11).forEach((u) => initialUrls.push(upscale(u)));
    }
    if (initialUrls.length > 0) {
      setDisplayUrls(initialUrls);
      setEbayUrls(initialUrls);
    }

    if (!itemUrl) return;

    let cancelled = false;
    setLoadingSpecifics(true);

    ebayAPI
      .scrapeItemDetails(itemUrl)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};
        if (data.categoryId) setForm((prev) => ({ ...prev, categoryId: String(data.categoryId) }));
        if (Array.isArray(data.itemSpecifics) && data.itemSpecifics.length > 0) setItemSpecifics(data.itemSpecifics);
        if (Array.isArray(data.pictureUrls) && data.pictureUrls.length > 0) {
          setDisplayUrls(data.pictureUrls);
          setEbayUrls(data.pictureUrls);
          setSelectedImageIdx(0);
        }
      })
      .catch((err) => { console.warn('[ListOnEbayModal] scrapeItemDetails failed (non-fatal):', err?.message); })
      .finally(() => { if (!cancelled) setLoadingSpecifics(false); });

    return () => { cancelled = true; };
  }, [item, scrapedOverride]);

  // ── 3. Auto-fill policy IDs ───────────────────────────────────────────────
  useEffect(() => {
    const bpIds = sellerPolicies.businessPolicyIds || {};
    const paymentPolicyId = bpIds.paymentPolicyId || sellerPolicies.paymentPolicies[0]?.paymentPolicyId || '';
    const returnPolicyId = bpIds.returnPolicyId || sellerPolicies.returnPolicies[0]?.returnPolicyId || '';
    const fulfillmentPolicyId = bpIds.shippingPolicyId || sellerPolicies.fulfillmentPolicies[0]?.fulfillmentPolicyId || '';
    setForm((prev) => ({ ...prev, paymentPolicyId, returnPolicyId, fulfillmentPolicyId }));
  }, [sellerPolicies]);

  const handleImageEdited = ({ displayUrl, ebayUrl }) => {
    const idx = editingImageIdx;
    setDisplayUrls((prev) => {
      const next = [...prev];
      next[idx] = displayUrl;
      // Propagate to bucket if possible
      if (typeof onUpdateItem === 'function') {
        onUpdateItem({
          scrapedData: {
            ...scrapedOverride,
            pictureUrls: next,
          },
        });
      }
      return next;
    });
    setEbayUrls((prev) => {
      const next = [...prev];
      next[idx] = ebayUrl;
      // Propagate to bucket if possible
      if (typeof onUpdateItem === 'function') {
        onUpdateItem({
          scrapedData: {
            ...scrapedOverride,
            pictureUrls: next,
          },
        });
      }
      return next;
    });
    setEditingImageIdx(null);
    setSelectedImageIdx(idx);
  };

  const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      if (name === 'marketplaceId') {
        const selected = MARKETPLACE_OPTIONS.find(opt => opt.id === value);
        setForm((prev) => ({
          ...prev,
          marketplaceId: value,
          country: selected ? selected.country : '',
        }));
      } else {
        setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.title.trim()) return setError('Title is required');
    if (!form.price || Number(form.price) <= 0) return setError('Price must be a positive number');
    if (!form.categoryId.trim()) return setError('Category ID is required');

    if (isEditBucketItem) {
      // Save changes to bucket item only
      setSubmitting(true);
      try {
        const pictureUrlsHiRes = [...new Set(ebayUrls.filter(Boolean))];
        // Always build a new scrapedData object, never mutate or spread scrapedOverride
        const newScrapedData = {
          title: form.title.trim(),
          // Convert Markdown to plain text and wrap in CDATA for safety
          description: wrapDescriptionCdata(markdownToPlainText(form.description.trim() || form.title.trim())),
          price: Number(form.price),
          quantity: Math.max(1, Number(form.quantity) || 1),
          categoryId: form.categoryId.trim(),
          conditionId: Number(form.conditionId),
          freeShipping: form.freeShipping,
          dispatchTimeMax: Number(form.dispatchTimeMax) || 3,
          currency: 'USD',
          pictureUrls: pictureUrlsHiRes,
          itemSpecifics: Array.isArray(itemSpecifics) ? itemSpecifics.map(s => ({ ...s })) : [],
          paymentPolicyId: form.paymentPolicyId,
          returnPolicyId: form.returnPolicyId,
          fulfillmentPolicyId: form.fulfillmentPolicyId,
        };
        onUpdateItem({ scrapedData: newScrapedData });
        setSubmitting(false);
        onClose();
      } catch (err) {
        setError(err?.message || 'Failed to save changes');
        setSubmitting(false);
      }
      return;
    }

    // Normal listing flow
    try {
      setSubmitting(true);
      const pictureUrlsHiRes = [...new Set(ebayUrls.filter(Boolean))];
      const EXCLUDED_SPECIFICS = new Set(['condition', 'item condition']);
      const itemSpecificsMap = {};
      itemSpecifics.forEach(({ name, label, value }) => {
        const key = name || label;
        if (key && value && !EXCLUDED_SPECIFICS.has(String(key).toLowerCase().trim())) {
          itemSpecificsMap[key] = value;
        }
      });

      const res = await ebayAPI.quickList({
        title: form.title.trim(),
        // Convert Markdown to plain text and wrap in CDATA for safety
        description: wrapDescriptionCdata(markdownToPlainText(form.description.trim() || form.title.trim())),
        price: Number(form.price),
        quantity: Math.max(1, Number(form.quantity) || 1),
        categoryId: form.categoryId.trim(),
        conditionId: Number(form.conditionId),
        freeShipping: form.freeShipping,
        dispatchTimeMax: Number(form.dispatchTimeMax) || 3,
        currency: 'USD',
        pictureUrls: pictureUrlsHiRes,
        itemSpecifics: Object.keys(itemSpecificsMap).length > 0 ? itemSpecificsMap : null,
        ...(form.paymentPolicyId ? { paymentPolicyId: form.paymentPolicyId } : {}),
        ...(form.returnPolicyId ? { returnPolicyId: form.returnPolicyId } : {}),
        ...(form.fulfillmentPolicyId ? { fulfillmentPolicyId: form.fulfillmentPolicyId } : {}),
        marketplaceId: form.marketplaceId,
        country: form.country,
      });

      const listingResult = res?.data || {};
      setResult(listingResult);

      // ── Notify parent (bucket) of success ──
      if (listingResult.success && listingResult.itemId && typeof onSuccess === 'function') {
        onSuccess(listingResult);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to list on eBay');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const base = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
  }`;
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const divider = `border-t my-1 ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`;
  const sectionBox = `rounded-xl border p-4 space-y-3 ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className={`rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${base}`}>

          {/* Header */}
          <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-lg font-semibold">List on eBay</h2>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {scrapedOverride ? 'From your listing bucket · Using your active eBay account' : 'Using your active eBay account'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
          </div>

          {/* ── Success state ── */}
          {result ? (
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4">
                <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">✅ Listed successfully!</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Item ID: <span className="font-mono font-semibold">{result.itemId}</span>
                </p>
                {result.listingUrl && (
                  <a href={result.listingUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-blue-600 hover:underline font-medium">
                    View on eBay →
                  </a>
                )}
                {result.warnings?.length > 0 && (
                  <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    <p className="font-semibold">Warnings:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {result.warnings.map((w, i) => <li key={i}>{w?.message || String(w)}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2">Close</button>
                <button type="button" onClick={() => { setResult(null); setError(null); }} className="btn-primary flex-1 py-2">
                  List Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Image gallery */}
              {displayUrls.length > 0 && (
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="relative w-full aspect-square bg-black/10 group">
                    <img
                      src={displayUrls[selectedImageIdx] || displayUrls[0]}
                      alt={`Picture ${selectedImageIdx + 1} of ${displayUrls.length}`}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.src = displayUrls[0]; }}
                    />
                    <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-900/80 text-slate-300' : 'bg-white/80 text-slate-600'}`}>
                      {selectedImageIdx + 1} / {displayUrls.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingImageIdx(selectedImageIdx)}
                      title="Replace this image"
                      className={`
                        absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                        text-xs font-semibold shadow-md transition-all
                        opacity-0 group-hover:opacity-100 focus:opacity-100
                        ${isDark
                          ? 'bg-slate-800/90 text-slate-200 hover:bg-blue-600 hover:text-white border border-slate-600 hover:border-blue-600'
                          : 'bg-white/90 text-slate-700 hover:bg-blue-500 hover:text-white border border-slate-200 hover:border-blue-500'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Edit
                    </button>
                    {loadingSpecifics && displayUrls.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="text-xs text-white animate-pulse">Loading images…</span>
                      </div>
                    )}
                  </div>
                  {/* Thumbnail strip */}
                  {displayUrls.length > 1 && (
                    <div className="flex gap-1.5 p-2 overflow-x-auto">
                      {displayUrls.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedImageIdx(idx)}
                          className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageIdx === idx
                              ? 'border-blue-500 opacity-100'
                              : isDark ? 'border-slate-600 opacity-60 hover:opacity-100' : 'border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className={`rounded-xl border px-3 py-2.5 text-xs ${isDark ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                  {error}
                </div>
              )}

              {/* Basic fields */}
              <div className={sectionBox}>
                <div>
                  <label className={labelClass}>Title <span className="text-red-400">*</span></label>
                  <input type="text" name="title" value={form.title} onChange={handleChange} className={inputClass} maxLength={80} placeholder="Item title (max 80 chars)" disabled={submitting} />
                  <p className={`text-xs mt-0.5 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{form.title.length}/80</p>
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Item description" disabled={submitting} />
                </div>
              </div>

              <div className={divider} />

              {/* Pricing & inventory */}
              {/* Marketplace selection */}
              <div className={sectionBox}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Marketplace & Inventory</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Marketplace</label>
                    <select name="marketplaceId" value={form.marketplaceId} onChange={handleChange} className={inputClass} disabled={submitting}>
                      {MARKETPLACE_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Price (USD) <span className="text-red-400">*</span></label>
                    <input type="number" name="price" value={form.price} onChange={handleChange} min="0.01" step="0.01" className={inputClass} placeholder="0.00" disabled={submitting} />
                  </div>
                  <div>
                    <label className={labelClass}>Quantity</label>
                    <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" step="1" className={inputClass} disabled={submitting} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Category ID <span className="text-red-400">*</span></label>
                    <input type="text" name="categoryId" value={form.categoryId} onChange={handleChange} className={inputClass} placeholder="e.g. 9355" disabled={submitting} />
                  </div>
                  <div>
                    <label className={labelClass}>Condition</label>
                    <select name="conditionId" value={form.conditionId} onChange={handleChange} className={inputClass} disabled={submitting}>
                      {CONDITION_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Dispatch Time (days)</label>
                    <input type="number" name="dispatchTimeMax" value={form.dispatchTimeMax} onChange={handleChange} min="1" step="1" className={inputClass} disabled={submitting} />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="freeShipping" checked={form.freeShipping} onChange={handleChange} disabled={submitting} />
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Free Shipping</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={divider} />

              {/* Seller Policies */}
              <div className={sectionBox}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Seller Policies
                  {loadingPolicies && <span className="ml-1.5 font-normal text-blue-400 animate-pulse">loading…</span>}
                </p>
                {['paymentPolicyId', 'returnPolicyId', 'fulfillmentPolicyId'].map((policyKey) => {
                  const labels = { paymentPolicyId: 'Payment Policy', returnPolicyId: 'Return Policy', fulfillmentPolicyId: 'Shipping Policy' };
                  const lists = { paymentPolicyId: sellerPolicies.paymentPolicies, returnPolicyId: sellerPolicies.returnPolicies, fulfillmentPolicyId: sellerPolicies.fulfillmentPolicies };
                  const idKey = { paymentPolicyId: 'paymentPolicyId', returnPolicyId: 'returnPolicyId', fulfillmentPolicyId: 'fulfillmentPolicyId' };
                  const pList = lists[policyKey];
                  return (
                    <div key={policyKey}>
                      <label className={labelClass}>{labels[policyKey]}</label>
                      <select name={policyKey} value={form[policyKey]} onChange={handleChange} className={inputClass} disabled={submitting || loadingPolicies}>
                        <option value="">{pList.length === 0 ? 'No policies found — account default will apply' : `Select ${labels[policyKey]}`}</option>
                        {pList.map((p) => <option key={p[idKey[policyKey]]} value={p[idKey[policyKey]]}>{p.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Item Specifics */}
              {(loadingSpecifics || itemSpecifics.length > 0) && (
                <>
                  <div className={divider} />
                  <div>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Item Specifics
                      {loadingSpecifics && <span className="ml-1.5 font-normal text-blue-400 animate-pulse">fetching…</span>}
                    </p>
                    {loadingSpecifics && itemSpecifics.length === 0 ? (
                      <div className={`rounded-lg border px-3 py-2.5 text-xs ${isDark ? 'border-slate-700 bg-slate-800/40 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                        Loading item specifics from listing…
                      </div>
                    ) : (
                      <div className={`rounded-lg border overflow-hidden text-xs divide-y max-h-52 overflow-y-auto ${isDark ? 'border-slate-700 divide-slate-700' : 'border-slate-200 divide-slate-100'}`}>
                        {itemSpecifics.map((spec, i) => {
                          const specLabel = spec.name || spec.label || '';
                          const specValue = spec.value || '';
                          return (
                            <div key={`${specLabel}-${i}`} className={`grid grid-cols-2 gap-3 px-3 py-1.5 ${isDark ? 'bg-slate-800/50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{specLabel}</span>
                              <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{specValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Warning (only show in normal listing mode) */}
              {!isEditBucketItem && (
                <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-amber-800 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  ⚠️ This will create a <strong>live listing</strong> on your active eBay seller account immediately.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary flex-1 py-2.5 disabled:opacity-60">Cancel</button>
                {isEditBucketItem ? (
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Saving…
                      </>
                    ) : 'Save'}
                  </button>
                ) : (
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Listing…
                      </>
                    ) : 'List on eBay'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
      {/* Image Edit Sub-Modal */}
      {editingImageIdx !== null && (
        <ImageEditModal
          isDark={isDark}
          currentUrl={displayUrls[editingImageIdx]}
          imageIndex={editingImageIdx}
          onConfirm={handleImageEdited}
          onClose={() => setEditingImageIdx(null)}
        />
      )}
    </>
  );
}
