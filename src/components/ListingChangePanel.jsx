import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Minus,
  PencilLine,
  Plus,
  Receipt,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import { ebayAPI } from '../services/api';
import { formatLongDate } from '../utils/dateFormat';

const TITLE_MAX = 80; // eBay's title length limit

// "GalleryPlusFee" -> "Gallery Plus"
function humanFeeName(name) {
  return String(name || '')
    .replace(/Fee$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function apiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  const ebayMessages = Array.isArray(data?.ebayErrors)
    ? data.ebayErrors.filter((e) => String(e?.severityCode || '').toLowerCase() !== 'warning').map((e) => e?.message).filter(Boolean)
    : [];
  if (ebayMessages.length) return [...new Set(ebayMessages)].slice(0, 3);
  return [data?.error || err?.message || fallback];
}

function Toggle({ checked, onChange, label, isDark, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/**
 * Edit an eBay listing's title, price, quantity and Best Offer, then either
 * revise it in place (active listing, Trading ReviseItem) or relist it (ended
 * listing, Trading RelistItem — new ItemID). Every change is pre-checked with
 * eBay (VerifyOnly / VerifyRelistItem) and shown with its fees before the
 * seller confirms.
 *
 * mode: 'revise' | 'relist'. Mode-specific copy lives under listingDetailPage.<mode>.
 */
const ListingChangePanel = forwardRef(function ListingChangePanel(
  {
    mode,
    listingId,
    isDark,
    currentTitle,
    currentPrice,
    currency = 'USD',
    defaultQuantity,
    bestOfferEnabled,
    titleLock = null, // revise: 'sold' | 'bids' | 'endingSoon' when eBay won't accept a new title
    deadline,
    endedAt,
    money,
    profitFor,
    onDone,
    onOpenRelisted,
  },
  ref
) {
  const { t, i18n } = useTranslation();
  const k = (key, options) => t(`listingDetailPage.${mode}.${key}`, options);
  const isRelist = mode === 'relist';
  const lang = i18n.language;
  const titleRef = useRef(null);
  const qtyRef = useRef(null);
  const rootRef = useRef(null);

  const minQty = isRelist ? 1 : 0;
  const initialQty = Math.max(minQty, Number(defaultQuantity) || 0);
  const initialBestOffer = Boolean(bestOfferEnabled);
  const [title, setTitle] = useState(currentTitle || '');
  const [price, setPrice] = useState(currentPrice != null ? String(currentPrice) : '');
  const [quantity, setQuantity] = useState(String(initialQty));
  const [bestOffer, setBestOffer] = useState(initialBestOffer);

  const [preview, setPreview] = useState(null); // { key, fees, totalFee, warnings, inventoryManaged }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // relist only: the new listing
  const [flash, setFlash] = useState(''); // revise only: "saved" note
  const [idCopied, setIdCopied] = useState(false);

  const resetDraft = () => {
    setTitle(currentTitle || '');
    setPrice(currentPrice != null ? String(currentPrice) : '');
    setQuantity(String(initialQty));
    setBestOffer(initialBestOffer);
    setPreview(null);
    setErrors([]);
  };

  // A new baseline (other listing, or the revision just saved) resets the form.
  useEffect(() => {
    resetDraft();
    setResult(null);
    setConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, currentTitle, currentPrice, initialQty, initialBestOffer]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(timer);
  }, [flash]);

  useImperativeHandle(ref, () => ({
    focus: (field = 'title') => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const target = field === 'quantity' || (field === 'title' && titleLock) ? qtyRef : titleRef;
      setTimeout(() => {
        target.current?.focus({ preventScroll: true });
        if (target === qtyRef) target.current?.select?.();
      }, 350);
    },
  }));

  const titleTrimmed = title.trim();
  const priceNumber = Number(price);
  const qtyNumber = Number(quantity);

  const validation = useMemo(() => {
    if (!titleTrimmed) return k('errTitle');
    if (titleTrimmed.length > TITLE_MAX) return k('errTitleLong', { max: TITLE_MAX });
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return k('errPrice');
    if (!Number.isInteger(qtyNumber) || qtyNumber < minQty) return k('errQty');
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleTrimmed, priceNumber, qtyNumber, minQty, t, mode]);

  const yesNo = (v) => (v ? t('listingDetailPage.ui.yes') : t('listingDetailPage.ui.no'));

  // Only what changed is sent — eBay keeps everything else as it is.
  const changes = useMemo(() => {
    const list = [];
    if (!titleLock && titleTrimmed && titleTrimmed !== String(currentTitle || '').trim()) {
      list.push({ key: 'title', label: k('fieldTitle'), from: currentTitle, to: titleTrimmed });
    }
    if (Number.isFinite(priceNumber) && priceNumber > 0 && Number(priceNumber.toFixed(2)) !== Number(currentPrice)) {
      list.push({ key: 'price', label: k('fieldPrice'), from: currentPrice != null ? money(currentPrice, currency) : '—', to: money(priceNumber, currency) });
    }
    if (Number.isInteger(qtyNumber) && qtyNumber !== initialQty) {
      list.push({ key: 'quantity', label: k('fieldQty'), from: String(initialQty), to: String(qtyNumber) });
    }
    if (bestOffer !== initialBestOffer) {
      list.push({ key: 'bestOffer', label: k('fieldBestOffer'), from: yesNo(initialBestOffer), to: yesNo(bestOffer) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleLock, titleTrimmed, currentTitle, priceNumber, currentPrice, qtyNumber, initialQty, bestOffer, initialBestOffer, currency, money, t, mode]);

  const payload = useMemo(() => {
    const body = { currency };
    changes.forEach((c) => {
      if (c.key === 'title') body.title = titleTrimmed;
      if (c.key === 'price') body.price = Number(priceNumber.toFixed(2));
      if (c.key === 'quantity') body.quantity = qtyNumber;
      if (c.key === 'bestOffer') body.bestOfferEnabled = bestOffer;
    });
    // A sold-out listing can't come back with 0 units, so a relist always sends the quantity.
    if (isRelist && body.quantity == null && Number.isInteger(qtyNumber)) body.quantity = qtyNumber;
    return body;
  }, [changes, titleTrimmed, priceNumber, qtyNumber, bestOffer, currency, isRelist]);
  const payloadKey = JSON.stringify(payload);
  const freshPreview = preview?.key === payloadKey ? preview : null;
  const nothingToSave = !isRelist && changes.length === 0;

  const draftProfit = profitFor ? profitFor(priceNumber) : null;
  const daysLeft = isRelist && deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 86400000)) : null;
  const call = isRelist ? ebayAPI.relistListing : ebayAPI.reviseListing;

  const runPreview = async () => {
    if (validation) {
      setErrors([validation]);
      return null;
    }
    if (nothingToSave) return null;
    setPreviewLoading(true);
    setErrors([]);
    try {
      const res = await call(listingId, { ...payload, verify: true });
      const data = res?.data || {};
      const next = {
        key: payloadKey,
        fees: data.fees || [],
        totalFee: data.totalFee || null,
        warnings: data.warnings || [],
        inventoryManaged: Boolean(data.inventoryManaged),
      };
      setPreview(next);
      return next;
    } catch (err) {
      setPreview(null);
      setErrors(apiErrorMessage(err, k('errVerify')));
      return null;
    } finally {
      setPreviewLoading(false);
    }
  };

  const openConfirm = () => {
    if (validation) {
      setErrors([validation]);
      return;
    }
    if (nothingToSave) return;
    setErrors([]);
    setConfirmOpen(true);
    if (!freshPreview) runPreview();
  };

  const submit = async () => {
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await call(listingId, payload);
      const data = res?.data || {};
      if (isRelist) {
        setResult(data);
      } else {
        setConfirmOpen(false);
        setFlash(k('successText', { count: changes.length }));
      }
      onDone?.(data, payload);
    } catch (err) {
      setErrors(apiErrorMessage(err, k('errSubmit')));
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setConfirmOpen(false);
  };

  useEffect(() => {
    if (!confirmOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen, submitting]);

  const copyNewId = async () => {
    try {
      await navigator.clipboard.writeText(String(result?.listingId || ''));
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    } catch {
      // clipboard blocked — the id stays visible
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const accentText = isDark ? 'text-indigo-300' : 'text-indigo-700';
  const subtleBox = isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50';
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const labelCls = `text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const secondaryBtn = `inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
  }`;
  const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
  const HeaderIcon = isRelist ? RotateCcw : PencilLine;
  const ActionIcon = isRelist ? RotateCcw : Check;

  const feeTotalText = (p) => {
    if (!p?.totalFee) return '—';
    return p.totalFee.amount > 0 ? money(p.totalFee.amount, p.totalFee.currency) : k('free');
  };

  const FeeBreakdown = ({ data }) =>
    data.inventoryManaged ? (
      <p className={`flex items-start gap-1.5 text-xs ${muted}`}>
        <Info size={12} className="mt-0.5 shrink-0" />
        {k('inventoryManaged')}
      </p>
    ) : (
      <div className="space-y-1.5">
        {data.fees.map((fee) => (
          <div key={fee.name} className="flex items-center justify-between gap-3 text-xs">
            <span className={muted}>{humanFeeName(fee.name)}</span>
            <span className={`font-semibold tabular-nums ${strong}`}>{money(fee.amount, fee.currency)}</span>
          </div>
        ))}
        <div className={`flex items-center justify-between gap-3 text-sm ${data.fees.length ? `border-t pt-1.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}` : ''}`}>
          <span className={`flex items-center gap-1.5 font-semibold ${strong}`}>
            <CheckCircle2 size={13} className="text-emerald-500" />
            {k('totalFees')}
          </span>
          <span className={`font-bold tabular-nums ${data.totalFee?.amount > 0 ? strong : 'text-emerald-500'}`}>{feeTotalText(data)}</span>
        </div>
        {data.warnings.length > 0 && (
          <ul className={`mt-2 space-y-1 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            {data.warnings.map((w) => (
              <li key={w} className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />{w}</li>
            ))}
          </ul>
        )}
      </div>
    );

  const ErrorList = () =>
    errors.length > 0 ? (
      <div role="alert" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">{errors.map((e) => <p key={e}>{e}</p>)}</div>
      </div>
    ) : null;

  const ChangeList = ({ compact = false }) => (
    <ul className="space-y-1.5">
      {changes.map((c) => (
        <li key={c.key} className={`rounded-lg border px-3 py-2 text-xs ${subtleBox}`}>
          <span className={`font-semibold ${strong}`}>{c.label}</span>
          {c.key === 'title' ? (
            <>
              {!compact && <p className={`mt-0.5 line-clamp-1 line-through ${muted}`}>{c.from}</p>}
              <p className={`mt-0.5 line-clamp-2 ${accentText}`}>{c.to}</p>
            </>
          ) : (
            <span className="ml-2 inline-flex items-center gap-1.5 tabular-nums">
              <span className={`line-through ${muted}`}>{c.from}</span>
              <ArrowRight size={11} className={muted} />
              <span className={`font-semibold ${accentText}`}>{c.to}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  const showForm = !(isRelist && result);

  return (
    <section
      ref={rootRef}
      className={`scroll-mt-4 rounded-2xl border p-5 shadow-sm ${
        isRelist
          ? isDark ? 'border-indigo-500/30 bg-slate-900/60' : 'border-indigo-200 bg-white'
          : isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/15' : 'bg-indigo-50'}`}>
          <HeaderIcon size={18} className="text-indigo-500" />
        </div>
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${strong}`}>{k('title')}</h2>
          <p className={`mt-0.5 text-xs leading-relaxed ${muted}`}>{k('subtitle')}</p>
        </div>
      </div>

      {flash && (
        <div role="status" className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          {flash}
        </div>
      )}

      {isRelist && result && !confirmOpen ? (
        <div className={`mt-5 rounded-xl border p-4 ${isDark ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
            <CheckCircle2 size={16} />
            {k('successTitle')}
          </p>
          <p className={`mt-1 text-xs ${isDark ? 'text-emerald-200/80' : 'text-emerald-700'}`}>
            {k('newIdIs', { id: result.listingId })}
          </p>
          <button type="button" onClick={() => onOpenRelisted?.(result, payload)} className={`${primaryBtn} mt-3 w-full`}>
            {k('openNew')}
            <ArrowRight size={15} />
          </button>
        </div>
      ) : null}

      {showForm && daysLeft !== null && (
        <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
          daysLeft <= 7
            ? isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-800'
            : isDark ? 'bg-slate-800/70 text-slate-300' : 'bg-slate-100 text-slate-600'
        }`}>
          <CalendarClock size={14} className="shrink-0" />
          <span>
            {k('daysLeft', { count: daysLeft })}
            {endedAt ? <span className="opacity-75"> · {k('endedOn', { date: formatLongDate(endedAt, lang) })}</span> : null}
          </span>
        </div>
      )}

      {showForm && <form
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          openConfirm();
        }}
      >
        {/* Title */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label htmlFor={`${mode}-title`} className={`inline-flex items-center gap-1 ${labelCls}`}>
              {titleLock ? <Lock size={11} /> : null}
              {k('fieldTitle')}
            </label>
            {!titleLock && (
              <span className={`text-[11px] font-semibold tabular-nums ${title.length > TITLE_MAX ? 'text-rose-500' : title.length > TITLE_MAX - 10 ? 'text-amber-500' : muted}`}>
                {title.length}/{TITLE_MAX}
              </span>
            )}
          </div>
          <textarea
            id={`${mode}-title`}
            ref={titleRef}
            rows={3}
            value={title}
            disabled={Boolean(titleLock)}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} resize-none leading-relaxed`}
          />
          {titleLock && <p className={`mt-1.5 text-xs ${muted}`}>{k(`titleLocked_${titleLock}`)}</p>}
        </div>

        {/* Price + quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${mode}-price`} className={`mb-1.5 block ${labelCls}`}>{k('fieldPrice')}</label>
            <div className="relative">
              <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>$</span>
              <input
                id={`${mode}-price`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${inputCls} pl-7 tabular-nums`}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${mode}-qty`} className={`mb-1.5 block ${labelCls}`}>{k('fieldQty')}</label>
            <div className={`flex items-center rounded-xl border transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>
              <button
                type="button"
                aria-label="-1"
                onClick={() => setQuantity(String(Math.max(minQty, (Number(quantity) || 0) - 1)))}
                className={`flex h-10 w-9 items-center justify-center rounded-l-xl transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Minus size={14} />
              </button>
              <input
                id={`${mode}-qty`}
                ref={qtyRef}
                type="number"
                inputMode="numeric"
                min={minQty}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none ${strong}`}
              />
              <button
                type="button"
                aria-label="+1"
                onClick={() => setQuantity(String((Number(quantity) || 0) + 1))}
                className={`flex h-10 w-9 items-center justify-center rounded-r-xl transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
        {draftProfit !== null && Number.isFinite(priceNumber) && priceNumber > 0 && (
          <p className={`-mt-3 text-xs font-medium ${draftProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {t('listingDetailPage.ui.priceProfitHint', { profit: `${draftProfit >= 0 ? '+' : '−'}${money(Math.abs(draftProfit))}` })}
          </p>
        )}
        {!isRelist && quantity !== '' && qtyNumber === 0 && (
          <p className={`-mt-3 flex items-start gap-1.5 text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {k('qtyZeroHint')}
          </p>
        )}

        {/* Best offer */}
        <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${subtleBox}`}>
          <div>
            <p className={`text-sm font-semibold ${strong}`}>{k('fieldBestOffer')}</p>
            <p className={`text-xs ${muted}`}>{k('bestOfferHint')}</p>
          </div>
          <Toggle checked={bestOffer} onChange={setBestOffer} label={k('fieldBestOffer')} isDark={isDark} />
        </div>

        {/* What will change */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>{k('changesTitle')}</p>
            {changes.length > 0 && (
              <button type="button" onClick={resetDraft} className={`inline-flex items-center gap-1 text-xs font-semibold transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                <Undo2 size={12} />
                {k('discard')}
              </button>
            )}
          </div>
          {changes.length ? (
            <ChangeList compact />
          ) : (
            <p className={`rounded-lg border border-dashed px-3 py-2 text-xs ${isDark ? 'border-slate-700' : 'border-slate-300'} ${muted}`}>
              {k('noChanges')}
            </p>
          )}
        </div>

        {/* Fee preview / eBay pre-check */}
        {!nothingToSave && (
          <div className={`rounded-xl border p-3.5 ${subtleBox}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`flex items-center gap-1.5 text-sm font-semibold ${strong}`}>
                <Receipt size={14} className="text-indigo-500" />
                {k('feesTitle')}
              </p>
              <button
                type="button"
                onClick={runPreview}
                disabled={previewLoading}
                className={`inline-flex items-center gap-1 text-xs font-semibold transition disabled:opacity-60 ${isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}
              >
                {previewLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                {freshPreview ? k('recheck') : k('checkFees')}
              </button>
            </div>
            <div className="mt-2.5">
              {freshPreview ? (
                <FeeBreakdown data={freshPreview} />
              ) : (
                <p className={`text-xs ${muted}`}>{preview ? k('feesStale') : k('feesHint')}</p>
              )}
            </div>
          </div>
        )}

        {!confirmOpen && <ErrorList />}

        <button type="submit" disabled={nothingToSave} className={`${primaryBtn} w-full py-3`}>
          <ActionIcon size={16} />
          {changes.length ? k('ctaWithChanges', { count: changes.length }) : k('cta')}
        </button>
      </form>}

      {/* Confirm (and, for a relist, success) dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${mode}-dialog-title`}
            className={`relative w-full max-w-lg overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
          >
            {isRelist && result ? (
              <div className="p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 size={30} className="text-emerald-500" />
                </div>
                <h3 id={`${mode}-dialog-title`} className={`mt-4 text-lg font-bold ${strong}`}>{k('successTitle')}</h3>
                <p className={`mt-1 text-sm ${muted}`}>{k('successText')}</p>

                <button
                  type="button"
                  onClick={copyNewId}
                  className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm transition ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  title={t('listingDetailPage.ui.copyId')}
                >
                  #{result.listingId}
                  {idCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>

                <dl className={`mt-5 divide-y rounded-xl border text-left text-sm ${isDark ? 'divide-slate-800 border-slate-800' : 'divide-slate-100 border-slate-200'}`}>
                  {[
                    [t('listingDetailPage.start'), formatLongDate(result.startTime, lang) || '—'],
                    [k('endsOn'), formatLongDate(result.endTime, lang) || '—'],
                    [k('totalFees'), feeTotalText(result)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className={muted}>{label}</dt>
                      <dd className={`font-semibold ${strong}`}>{value}</dd>
                    </div>
                  ))}
                </dl>

                {(result.carriedOver?.products > 0 || result.carriedOver?.autoStockRules > 0) && (
                  <p className={`mt-3 flex items-start gap-1.5 text-left text-xs ${muted}`}>
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {k('carriedOver')}
                  </p>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                  <a
                    href={`https://www.ebay.com/itm/${encodeURIComponent(result.listingId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${secondaryBtn} flex-1`}
                  >
                    {t('listingDetailPage.viewOnEbay')}
                    <ExternalLink size={14} />
                  </a>
                  <button type="button" onClick={() => onOpenRelisted?.(result, payload)} className={`${primaryBtn} flex-1`}>
                    {k('openNew')}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`flex items-start justify-between gap-3 border-b px-6 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div>
                    <h3 id={`${mode}-dialog-title`} className={`text-lg font-bold ${strong}`}>{k('confirmTitle')}</h3>
                    <p className={`mt-0.5 text-sm ${muted}`}>{k('confirmText')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    aria-label={k('cancel')}
                    className={`rounded-lg p-1.5 transition disabled:opacity-50 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
                  {isRelist ? (
                    <div className={`rounded-xl border p-4 ${subtleBox}`}>
                      <p className={`line-clamp-2 text-sm font-semibold ${strong}`}>{titleTrimmed}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        {[
                          [k('fieldPrice'), money(priceNumber, currency)],
                          [k('fieldQty'), qtyNumber],
                          [k('fieldBestOffer'), yesNo(bestOffer)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
                            <p className={`mt-0.5 text-sm font-bold tabular-nums ${strong}`}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ChangeList />
                  )}

                  {isRelist && changes.length > 0 && (
                    <p className={`text-xs ${muted}`}>
                      {k('changedFields', { fields: changes.map((c) => c.label).join(', ') })}
                    </p>
                  )}

                  <div className={`rounded-xl border p-4 ${subtleBox}`}>
                    <p className={`mb-2.5 flex items-center gap-1.5 text-sm font-semibold ${strong}`}>
                      <Receipt size={14} className="text-indigo-500" />
                      {k('feesTitle')}
                    </p>
                    {previewLoading ? (
                      <p className={`flex items-center gap-2 text-xs ${muted}`}>
                        <Loader2 size={13} className="animate-spin" />
                        {k('checkingFees')}
                      </p>
                    ) : freshPreview ? (
                      <FeeBreakdown data={freshPreview} />
                    ) : (
                      <p className={`text-xs ${muted}`}>{k('feesUnavailable')}</p>
                    )}
                  </div>

                  <p className={`flex items-start gap-1.5 text-xs ${muted}`}>
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {k('confirmNote')}
                  </p>

                  <ErrorList />
                </div>

                <div className={`flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button type="button" onClick={closeModal} disabled={submitting} className={secondaryBtn}>
                    {k('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || previewLoading || !freshPreview}
                    className={primaryBtn}
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <ActionIcon size={15} />}
                    {submitting ? k('submitting') : k('confirmCta')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
});

export default ListingChangePanel;
