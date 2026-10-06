import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { amazonAPI, ebayAPI, settingsAPI, dewisoAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import AutoListProgressStepper from '../components/AutoListProgressStepper';
import {
  buildAmazonProductUrl,
  extractAmazonAsin,
  formatCurrency,
  isValidAmazonAsin,
} from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Link as LinkIcon,
  Image as ImageIcon,
  Search as SearchIcon,
  Trash2,
  Settings as SettingsIcon,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

// Same field + aliases ListOnEbayModal.jsx checks for "Country/Region of
// Manufacture" — kept in sync so this behaves identically there.
const ITEM_ORIGIN_SPEC_ALIASES = new Set([
  'country/region of manufacture',
  'country of manufacture',
  'region of manufacture',
  'country of origin',
  'item origin',
]);
const ITEM_ORIGIN_SPEC_NAME = 'Country/Region of Manufacture';
const COUNTRY_OPTIONS = [
  'United States', 'China', 'United Kingdom', 'Canada', 'Germany', 'France', 'Italy',
  'Spain', 'Japan', 'South Korea', 'India', 'Vietnam', 'Mexico', 'Turkey', 'Australia',
  'Netherlands', 'Poland', 'Bangladesh', 'Indonesia', 'Thailand', 'Taiwan', 'Cambodia',
  'Portugal', 'Brazil', 'Switzerland', 'Unknown',
];

function useDebouncedAutoLookup({ amazonAsin, autoLookupEnabled, onLookup }) {
  const lastLookedUp = useRef(null);

  useEffect(() => {
    if (!autoLookupEnabled) return;
    if (!amazonAsin) return;
    const asin = extractAmazonAsin(amazonAsin);
    if (!isValidAmazonAsin(asin)) return;

    const t = setTimeout(() => {
      if (lastLookedUp.current === asin) return;
      lastLookedUp.current = asin;
      onLookup(asin, true);
    }, 800);

    return () => clearTimeout(t);
  }, [amazonAsin, autoLookupEnabled, onLookup]);

  return lastLookedUp;
}

export default function AmazonLookupPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [amazonAsin, setAmazonAsin] = useState('');
  const [autoLookupEnabled, setAutoLookupEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [result, setResult] = useState(null);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lookupQuota, setLookupQuota] = useState(null);
  const [history, setHistory] = useState([]);

  // eBay account + per-account Amazon Lookup auto-listing settings
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [autoListSettings, setAutoListSettings] = useState(null);
  const [dewisoTemplates, setDewisoTemplates] = useState([]);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Single-result "List on eBay" (the existing instant-preview card above)
  const [singleListingState, setSingleListingState] = useState(null); // { status, message, itemId, listingUrl, prepared }
  const [editableListing, setEditableListing] = useState(null); // user-editable copy of prepared.listingInput while awaiting confirmation
  const [newImageUrl, setNewImageUrl] = useState('');

  // Bulk auto-listing (paste multiple Amazon links)
  const [bulkLinksText, setBulkLinksText] = useState('');
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Profit planner
  const [targetProfit, setTargetProfit] = useState('');
  const [useSubscribedPrice, setUseSubscribedPrice] = useState(true);

  const canLookup = useMemo(() => {
    return isValidAmazonAsin(extractAmazonAsin(amazonAsin));
  }, [amazonAsin]);

  const isLookupQuotaReached =
    lookupQuota?.remainingThisWeek !== null &&
    lookupQuota?.remainingThisWeek !== undefined &&
    lookupQuota?.remainingThisWeek <= 0;

  const profitPlanner = useMemo(() => {
    const parsedTarget = parseFloat(targetProfit);
    const haveTarget = !Number.isNaN(parsedTarget) && parsedTarget >= 0;

    const amazonUsd = result?.price?.usd ?? 0;
    const subscribedUsd = result?.price?.subscribedUsd ?? null;

    const cogs = useSubscribedPrice && subscribedUsd != null ? subscribedUsd : amazonUsd;

    if (!haveTarget || !cogs || cogs <= 0) return { target: parsedTarget, cogs, ebayPrice: 0 };

    const FINAL_VALUE_FEE_RATE = 0.129;
    const TAX_RATE = 0;
    const AD_RATE = 0;
    const FIXED_FEE = 0.25;
    const denominator = 1 - (1 + TAX_RATE) * (FINAL_VALUE_FEE_RATE + AD_RATE);
    if (denominator <= 0) return { target: parsedTarget, cogs, ebayPrice: 0 };

    const ebayPrice = (cogs + parsedTarget + FIXED_FEE) / denominator;
    return {
      target: parsedTarget,
      cogs,
      ebayPrice: Math.round(ebayPrice * 100) / 100,
    };
  }, [result, targetProfit, useSubscribedPrice]);

  const downloadImageBestEffort = async (imageUrl, filename) => {
    if (!imageUrl) return;
    const safeName = (filename || 'image')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim()
      .slice(0, 80);

    try {
      const res = await fetch(imageUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      return true;
    } catch {
      // Some CDNs don't allow fetch() due to CORS; fallback to direct open.
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
      return false;
    }
  };

  const lookup = useCallback(async (asinValue, fromAuto = false) => {
    if (!asinValue) return;
    if (isLookupQuotaReached) {
      setAlert({
        type: 'warning',
        message: t('amazonLookupPage.quotaReached'),
      });
      return;
    }

    const normalizedAsin = extractAmazonAsin(asinValue);
    if (!isValidAmazonAsin(normalizedAsin)) {
      setAlert({ type: 'warning', message: t('amazonLookupPage.invalidAsin') });
      return;
    }

    setAlert(null);
    setLoading(true);
    try {
      const response = await amazonAPI.lookup(normalizedAsin);
      setResult(response.data || null);
      if (response?.data?.quota) {
        setLookupQuota(response.data.quota);
      }
      fetchHistory();
      setActiveImageIdx(0);
      setTargetProfit('');

      if (fromAuto) {
        setAlert(null);
      }
    } catch (error) {
      setResult(null);
      if (error?.response?.data?.quota) {
        setLookupQuota(error.response.data.quota);
      }
      setAlert({
        type: 'error',
        message:
          error.response?.data?.error ||
          error.message ||
          t('amazonLookupPage.failedLookup'),
      });
    } finally {
      setLoading(false);
    }
  }, [isLookupQuotaReached, t]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await amazonAPI.getHistory(20);
      setHistory(response?.data?.history || []);
    } catch (error) {
      console.warn('Failed to fetch lookup history:', error);
    }
  }, []);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const response = await settingsAPI.getLimits();
        const q = response?.data?.amazonLookup;
        if (q) {
          setLookupQuota({
            limitPerWeek: q.limitPerWeek,
            usedThisWeek: q.usedThisWeek,
            remainingThisWeek: q.remainingThisWeek,
            resetAt: q.resetAt,
          });
        }
      } catch (error) {
        console.warn('Failed to load lookup quota:', error);
      }
    };

    fetchLimits();
    fetchHistory();
  }, [fetchHistory]);

  // eBay connection + account, needed before any auto-listing call (settings
  // and listings are scoped per eBay account — see ListingsPage.jsx's
  // identical pattern).
  useEffect(() => {
    const loadEbayStatus = async () => {
      try {
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);
        setActiveEbayAccountId(status.activeEbayAccountId || null);
      } catch (error) {
        console.warn('Failed to load eBay status:', error);
      }
    };
    loadEbayStatus();
  }, []);

  useEffect(() => {
    if (!activeEbayAccountId) return;
    ebayAPI
      .getAmazonLookupSettings(activeEbayAccountId)
      .then((res) => setAutoListSettings(res?.data?.settings || null))
      .catch(() => {});
  }, [activeEbayAccountId]);

  useDebouncedAutoLookup({
    amazonAsin,
    autoLookupEnabled,
    onLookup: lookup,
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canLookup) {
      setAlert({ type: 'warning', message: t('amazonLookupPage.invalidAsin') });
      return;
    }
    lookup(extractAmazonAsin(amazonAsin));
  };

  const openSettingsModal = () => {
    setSettingsForm({
      previewBeforeList: autoListSettings?.previewBeforeList || false,
      defaultStockQty: String(autoListSettings?.defaultStockQty ?? 1),
      defaultProfitUsd: String(autoListSettings?.defaultProfitUsd ?? 5),
      adRatePercent: autoListSettings?.adRatePercent != null ? String(autoListSettings.adRatePercent) : '',
      defaultDewisoTemplateId: autoListSettings?.defaultDewisoTemplateId || '',
    });
    setSettingsModalOpen(true);
    if (!dewisoTemplates.length) {
      dewisoAPI
        .getHistory(50)
        .then((res) => setDewisoTemplates(Array.isArray(res?.data?.items) ? res.data.items : []))
        .catch(() => {});
    }
  };

  const saveSettings = async () => {
    if (!activeEbayAccountId || !settingsForm) return;
    setSavingSettings(true);
    try {
      const response = await ebayAPI.saveAmazonLookupSettings({
        ebayAccountId: activeEbayAccountId,
        previewBeforeList: settingsForm.previewBeforeList,
        defaultStockQty: Number(settingsForm.defaultStockQty) || 1,
        defaultProfitUsd: Number(settingsForm.defaultProfitUsd) || 0,
        adRatePercent: String(settingsForm.adRatePercent).trim() === '' ? null : Number(settingsForm.adRatePercent),
        defaultDewisoTemplateId: settingsForm.defaultDewisoTemplateId || null,
      });
      setAutoListSettings(response?.data?.settings || null);
      setSettingsModalOpen(false);
      setAlert({ type: 'success', message: t('amazonLookupPage.settingsSaved') });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error?.response?.data?.error || error.message || t('amazonLookupPage.settingsSaveFailed'),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Builds the full listing (ChatGPT copy, ZIK-sourced category/specifics,
  // composited cover image) for one ASIN, then either submits it immediately
  // or — when the active eBay account has "preview before listing" enabled —
  // stops and hands back the prepared draft so the caller can show it and
  // wait for an explicit confirm.
  const runAutoListPipeline = useCallback(
    async (asin, { onPhaseChange } = {}) => {
      if (!activeEbayAccountId) {
        return { status: 'error', message: t('amazonLookupPage.connectEbayFirst') };
      }
      try {
        onPhaseChange?.('prepare');
        const prepareRes = await ebayAPI.prepareAmazonAutoListing({ asin, ebayAccountId: activeEbayAccountId });
        const prepared = prepareRes?.data;

        // A malformed/empty response here must never be silently treated as
        // "no preview configured, go ahead and list" — that would submit a
        // listing built from nothing instead of showing the preview the
        // account is actually set up to require.
        if (!prepared?.listingInput?.title) {
          return { status: 'error', message: t('amazonLookupPage.failedAutoList') };
        }

        if (prepared?.settings?.previewBeforeList) {
          return { status: 'awaiting_confirmation', prepared };
        }

        onPhaseChange?.('confirm');
        const confirmRes = await ebayAPI.confirmAmazonAutoListing({
          asin,
          ebayAccountId: activeEbayAccountId,
          amazonPrice: prepared?.amazonPrice,
          listingInput: prepared?.listingInput,
        });
        const listed = confirmRes?.data;
        return {
          status: 'listed',
          itemId: listed?.itemId,
          listingUrl: listed?.listingUrl,
          addedToProducts: listed?.addedToProducts,
          adRateApplied: listed?.adRateApplied,
        };
      } catch (error) {
        return {
          status: 'error',
          message: error?.response?.data?.error || error.message || t('amazonLookupPage.failedAutoList'),
        };
      }
    },
    [activeEbayAccountId, t]
  );

  const confirmPreparedListing = useCallback(
    async (asin, prepared) => {
      try {
        const confirmRes = await ebayAPI.confirmAmazonAutoListing({
          asin,
          ebayAccountId: activeEbayAccountId,
          amazonPrice: prepared?.amazonPrice,
          listingInput: prepared?.listingInput,
        });
        const listed = confirmRes?.data;
        return {
          status: 'listed',
          itemId: listed?.itemId,
          listingUrl: listed?.listingUrl,
          addedToProducts: listed?.addedToProducts,
          adRateApplied: listed?.adRateApplied,
        };
      } catch (error) {
        return {
          status: 'error',
          message: error?.response?.data?.error || error.message || t('amazonLookupPage.failedAutoList'),
        };
      }
    },
    [activeEbayAccountId, t]
  );

  const handleSingleListOnEbay = useCallback(async () => {
    const asin = result?.asin || extractAmazonAsin(amazonAsin);
    if (!asin) {
      setAlert({ type: 'warning', message: t('amazonLookupPage.noAsinFound') });
      return;
    }
    setSingleListingState({ asin, status: 'preparing', phase: 'prepare' });
    const outcome = await runAutoListPipeline(asin, {
      onPhaseChange: (phase) => setSingleListingState((prev) => ({ ...prev, phase })),
    });
    setSingleListingState((prev) => ({ ...prev, ...outcome }));
    if (outcome.status === 'awaiting_confirmation') {
      setEditableListing(outcome.prepared?.listingInput || null);
    } else if (outcome.status === 'listed') {
      setAlert({ type: 'success', message: t('amazonLookupPage.listingCreated') });
    } else if (outcome.status === 'error') {
      setAlert({ type: 'error', message: outcome.message });
    }
  }, [amazonAsin, result, runAutoListPipeline, t]);

  const closeListingModal = useCallback(() => {
    setSingleListingState(null);
    setEditableListing(null);
    setNewImageUrl('');
  }, []);

  const confirmSingleListing = useCallback(async () => {
    if (!singleListingState?.prepared) return;
    setSingleListingState((prev) => ({ ...prev, status: 'preparing', phase: 'confirm' }));
    const preparedWithEdits = { ...singleListingState.prepared, listingInput: editableListing || singleListingState.prepared.listingInput };
    const outcome = await confirmPreparedListing(singleListingState.asin, preparedWithEdits);
    setSingleListingState((prev) => ({ ...prev, ...outcome }));
    if (outcome.status === 'listed') {
      setAlert({ type: 'success', message: t('amazonLookupPage.listingCreated') });
    } else if (outcome.status === 'error') {
      setAlert({ type: 'error', message: outcome.message });
    }
  }, [confirmPreparedListing, editableListing, singleListingState, t]);

  const handleBulkAutoList = useCallback(async () => {
    const lines = bulkLinksText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;

    setBulkProcessing(true);
    setBulkResults(lines.map((line, idx) => ({ id: `${idx}-${line}`, input: line, status: 'pending' })));

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const asin = extractAmazonAsin(line);

      if (!isValidAmazonAsin(asin)) {
        setBulkResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: 'error', message: t('amazonLookupPage.invalidAsin') } : r))
        );
        continue; // eslint-disable-line no-continue
      }

      setBulkResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, asin, status: 'looking_up' } : r)));

      // Consume the shared weekly Amazon-lookup quota for this link first —
      // the same quota /amazon/lookup already enforces everywhere else.
      try {
        const lookupRes = await amazonAPI.lookup(asin);
        if (lookupRes?.data?.quota) setLookupQuota(lookupRes.data.quota);
      } catch (error) {
        const quotaExceeded = error?.response?.status === 429;
        if (error?.response?.data?.quota) setLookupQuota(error.response.data.quota);
        setBulkResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: quotaExceeded ? 'quota_exceeded' : 'error',
                  message: error?.response?.data?.error || error.message,
                }
              : r
          )
        );
        if (quotaExceeded) {
          setBulkResults((prev) =>
            prev.map((r, idx) =>
              idx > i && r.status === 'pending'
                ? { ...r, status: 'quota_exceeded', message: t('amazonLookupPage.quotaReached') }
                : r
            )
          );
          break;
        }
        continue; // eslint-disable-line no-continue
      }

      setBulkResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'preparing', phase: 'prepare' } : r)));
      const outcome = await runAutoListPipeline(asin, {
        onPhaseChange: (phase) => setBulkResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, phase } : r))),
      });
      setBulkResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...outcome } : r)));
    }

    setBulkProcessing(false);
    fetchHistory();
  }, [bulkLinksText, fetchHistory, runAutoListPipeline, t]);

  const confirmBulkItem = useCallback(
    async (index) => {
      const item = bulkResults[index];
      if (!item?.prepared) return;
      setBulkResults((prev) => prev.map((r, idx) => (idx === index ? { ...r, status: 'preparing', phase: 'confirm' } : r)));
      const outcome = await confirmPreparedListing(item.asin, item.prepared);
      setBulkResults((prev) => prev.map((r, idx) => (idx === index ? { ...r, ...outcome } : r)));
    },
    [bulkResults, confirmPreparedListing]
  );

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="page-title">{t('amazonLookupPage.title')}</h1>
            <p className="page-subtitle">
              {t('amazonLookupPage.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoLookupEnabled}
                onChange={(e) => setAutoLookupEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-slate-700">{t('amazonLookupPage.autoLookup')}</span>
            </label>
            {ebayStatus.connected && (
              <button
                type="button"
                onClick={openSettingsModal}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                title={t('amazonLookupPage.autoListSettings')}
              >
                <SettingsIcon size={14} />
                {t('amazonLookupPage.autoListSettings')}
              </button>
            )}
          </div>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
              autoClose={false}
            />
          </div>
        )}

        <div
          className={`glass-card overflow-hidden relative ${isDark ? 'bg-slate-950 border-slate-800' : ''}`}
          data-tour="amazon-lookup-search"
        >
          <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 to-blue-900 text-white">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              <div className="flex-1">
                <div className="text-xs text-blue-100 flex items-center gap-2 mb-2">
                  <SearchIcon size={14} />
                  {t('amazonLookupPage.asinLabel')}
                </div>
                <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/95 px-3 py-2">
                    <LinkIcon size={16} className="text-slate-400" />
                    <input
                      value={amazonAsin}
                      onChange={(e) => setAmazonAsin(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Let submit handler run.
                        }
                      }}
                      placeholder={t('amazonLookupPage.inputPlaceholder')}
                      className="w-full bg-transparent outline-none text-slate-800 text-sm"
                      type="text"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || !canLookup || isLookupQuotaReached}
                      className="btn-primary flex items-center justify-center gap-2 px-5"
                    >
                      {loading ? (
                        <>
                          <span className="inline-block h-4 w-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                          {t('amazonLookupPage.checking')}
                        </>
                      ) : (
                        <>
                          {t('amazonLookupPage.check')}
                          <SearchIcon size={14} />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={loading || !amazonAsin}
                      onClick={() => {
                        setAmazonAsin('');
                        setResult(null);
                        setActiveImageIdx(0);
                        setAlert(null);
                      }}
                      className="btn-secondary flex items-center justify-center px-4"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </form>

                <div className="mt-2 text-xs text-slate-200">
                  {lookupQuota?.remainingThisWeek === null || lookupQuota?.remainingThisWeek === undefined ? (
                    <>{t('amazonLookupPage.quotaUnlimited')}</>
                  ) : (
                    <>
                      {t('amazonLookupPage.quotaLeft', { count: lookupQuota.remainingThisWeek })}
                      {lookupQuota.resetAt ? ` ${t('amazonLookupPage.quotaResets', { date: new Date(lookupQuota.resetAt).toLocaleString() })}` : ''}.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {loading && !result ? (
              <LoadingSpinner />
            ) : !result ? null : (
              <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-5">
                {/* Gallery */}
                <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        <ImageIcon size={16} className="text-blue-600" />
                        {t('amazonLookupPage.productImagesTitle')}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {result?.images?.length ? `${activeImageIdx + 1}/${result.images.length}` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    {result?.images?.length ? (
                      <div className="space-y-3">
                        <div className={`rounded-lg p-3 border ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                          <img
                            src={result.images[activeImageIdx]}
                            alt={result.title || t('amazonLookupPage.productImageAlt')}
                            className={`w-full h-[320px] object-contain rounded-md ${isDark ? 'bg-slate-900' : 'bg-white'}`}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center justify-center gap-2 px-4"
                            onClick={async () => {
                              const img = result.images[activeImageIdx];
                              const ok = await downloadImageBestEffort(
                                img,
                                `${(result.title || 'amazon-product').slice(0, 40)}-${activeImageIdx + 1}.jpg`
                              );
                              setAlert({
                                type: ok ? 'success' : 'warning',
                                message: ok ? t('amazonLookupPage.imageDownloadStarted') : t('amazonLookupPage.openedImageNewTab'),
                              });
                            }}
                          >
                            {t('amazonLookupPage.downloadActive')}
                          </button>

                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center justify-center gap-2 px-4"
                            onClick={async () => {
                              // Trigger downloads sequentially to avoid browser pop-up/connection limits.
                              try {
                                for (let i = 0; i < result.images.length; i += 1) {
                                  // eslint-disable-next-line no-await-in-loop
                                  await downloadImageBestEffort(
                                    result.images[i],
                                    `${(result.title || 'amazon-product').slice(0, 40)}-${i + 1}.jpg`
                                  );
                                }
                                setAlert({ type: 'success', message: t('amazonLookupPage.downloadingImages') });
                              } catch {
                                setAlert({ type: 'warning', message: t('amazonLookupPage.someDownloadsFailed') });
                              }
                            }}
                            disabled={!result.images.length}
                          >
                            {t('amazonLookupPage.downloadAll')}
                          </button>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {result.images.map((img, idx) => (
                            <button
                              key={`${img}-${idx}`}
                              type="button"
                              onClick={() => setActiveImageIdx(idx)}
                              className={`flex-none w-20 h-14 rounded-md border ${
                                idx === activeImageIdx
                                  ? 'border-blue-500 ring-2 ring-blue-100'
                                  : isDark
                                    ? 'border-slate-700 hover:border-slate-500'
                                    : 'border-slate-200 hover:border-slate-300'
                              } ${isDark ? 'bg-slate-900' : 'bg-white'} overflow-hidden`}
                            >
                              <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-contain" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={`text-center py-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t('amazonLookupPage.noImages')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className={`text-xl md:text-2xl font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {result.title}
                        </h2>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                          {t('amazonLookupPage.extractedFromAsin')}
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end">
                        <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('amazonLookupPage.amazonPrice')}</div>
                        <div className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {formatCurrency(result?.price?.usd ?? 0)}
                        </div>
                        {result?.price?.currency && result.price.currency !== 'USD' && (
                          <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {t('amazonLookupPage.raw')}{' '}{Number(result.price.raw).toFixed(2)} {result.price.currency}
                          </div>
                        )}

                        {result?.price?.subscribedUsd != null && (
                          <div className="mt-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                                {t('amazonLookupPage.subscribeAndSave')}
                              </span>
                              <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {formatCurrency(result.price.subscribedUsd)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={buildAmazonProductUrl(result?.asin || extractAmazonAsin(amazonAsin))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <LinkIcon size={14} />
                        {t('amazonLookupPage.openOnAmazon')}
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              buildAmazonProductUrl(result?.asin || extractAmazonAsin(amazonAsin))
                            );
                            setAlert({ type: 'success', message: t('amazonLookupPage.copied') });
                          } catch {
                            setAlert({
                              type: 'warning',
                              message: t('amazonLookupPage.couldNotCopy'),
                            });
                          }
                        }}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        {t('amazonLookupPage.copyUrl')}
                      </button>
                    </div>
                  </div>

                  <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
                    <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {t('amazonLookupPage.descriptionTitle')}
                    </h3>

                    {result.description ? (
                      <div className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {result.description}
                      </div>
                    ) : result.bullets?.length ? (
                      <ul className="space-y-2">
                        {result.bullets.map((b, idx) => (
                          <li key={`${b}-${idx}`} className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <span className="text-blue-600 font-bold mr-2">•</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t('amazonLookupPage.noDescription')}
                      </div>
                    )}
                  </div>

                    {/* Profit Planner */}
                    <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {t('amazonLookupPage.profitPlannerTitle')}
                      </h3>

                      <div className="flex flex-col gap-3">
                        <label className={`block text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                          {t('amazonLookupPage.targetProfitLabel')}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={targetProfit}
                          onChange={(e) => setTargetProfit(e.target.value)}
                          placeholder={t('amazonLookupPage.targetProfitPlaceholder')}
                          className="input-base"
                        />

                        <label className="flex items-center gap-2 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useSubscribedPrice}
                            onChange={(e) => setUseSubscribedPrice(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            disabled={result?.price?.subscribedUsd == null}
                          />
                          <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                            {t('amazonLookupPage.useSubscribedPrice')}
                          </span>
                        </label>

                        <div className={`rounded-lg p-3 border ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-[180px]">
                              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('amazonLookupPage.amazonCostUsed')}</p>
                              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {result?.price ? formatCurrency(profitPlanner.cogs || 0) : '—'}
                              </p>
                            </div>
                            <div className="min-w-[220px]">
                              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('amazonLookupPage.ebayListingPrice')}</p>
                              <p className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {profitPlanner.ebayPrice > 0 ? formatCurrency(profitPlanner.ebayPrice) : '—'}
                              </p>
                            </div>
                          </div>

                          {profitPlanner.ebayPrice > 0 ? (
                            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              {t('amazonLookupPage.basedOnFeeModel')}
                            </p>
                          ) : (
                            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              {t('amazonLookupPage.enterTargetProfit')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleSingleListOnEbay}
                      className="btn-primary inline-flex items-center justify-center gap-2"
                      disabled={!ebayStatus.connected || singleListingState?.status === 'preparing'}
                      title={!ebayStatus.connected ? t('amazonLookupPage.connectEbayFirst') : ''}
                    >
                      {singleListingState?.status === 'preparing' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {t('amazonLookupPage.listOnEbayButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAmazonAsin('');
                        setResult(null);
                        setActiveImageIdx(0);
                        setAlert(null);
                        closeListingModal();
                      }}
                      className="btn-secondary"
                    >
                      {t('amazonLookupPage.checkAnotherAsin')}
                    </button>
                    <RouterLink
                      to="/add-product"
                      className="btn-primary inline-flex items-center justify-center gap-2"
                      state={{
                        amazonAsin: result?.asin || extractAmazonAsin(amazonAsin),
                        amazonTitle: result.title,
                      }}
                    >
                      {t('amazonLookupPage.saveToTracking')}
                      <SearchIcon size={14} />
                    </RouterLink>
                  </div>
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className={`mt-4 rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {t('amazonLookupPage.recentSearches')}
                  </h3>
                  <button
                    type="button"
                    onClick={fetchHistory}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    {t('amazonLookupPage.refresh')}
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const historyAsin = item.amazonAsin || extractAmazonAsin(item.amazonUrlOriginal || '');
                        setAmazonAsin(historyAsin || '');
                        if (item.details) {
                          setResult(item.details);
                          setActiveImageIdx(0);
                        } else if (historyAsin) {
                          lookup(historyAsin);
                        }
                      }}
                      className={`w-full text-left rounded-lg border p-2.5 transition ${
                        isDark
                          ? 'border-slate-700 hover:bg-slate-800'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {item.title || item.amazonAsin || item.amazonUrlOriginal}
                          </p>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {item.amazonAsin || item.amazonUrlOriginal}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {item.priceUsd != null ? formatCurrency(item.priceUsd) : '—'}
                          </p>
                          <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                            {item.cached ? t('amazonLookupPage.cached') : t('amazonLookupPage.live')} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading && result && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
        </div>

        {ebayStatus.connected && (
          <div className={`glass-card mt-5 p-4 md:p-5 ${isDark ? 'bg-slate-950 border-slate-800' : ''}`}>
            <h2 className={`text-lg font-semibold mb-1 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Sparkles size={18} className="text-blue-600" />
              {t('amazonLookupPage.bulkTitle')}
            </h2>
            <p className={`text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('amazonLookupPage.bulkDescription')}
            </p>

            <textarea
              value={bulkLinksText}
              onChange={(e) => setBulkLinksText(e.target.value)}
              placeholder={t('amazonLookupPage.bulkPlaceholder')}
              rows={4}
              disabled={bulkProcessing}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/40 ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />

            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleBulkAutoList}
                disabled={bulkProcessing || !bulkLinksText.trim()}
                className="btn-primary inline-flex items-center gap-2"
              >
                {bulkProcessing && <Loader2 size={14} className="animate-spin" />}
                {t('amazonLookupPage.bulkSubmit')}
              </button>
              {autoListSettings && (
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {autoListSettings.previewBeforeList
                    ? t('amazonLookupPage.previewModeOn')
                    : t('amazonLookupPage.previewModeOff')}
                </span>
              )}
            </div>

            {bulkResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {bulkResults.map((item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {['pending', 'looking_up', 'preparing'].includes(item.status) && (
                      <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-blue-500" />
                    )}
                    {item.status === 'listed' && <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />}
                    {['error', 'quota_exceeded'].includes(item.status) && (
                      <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                    )}
                    {item.status === 'awaiting_confirmation' && (
                      <Sparkles size={15} className="mt-0.5 shrink-0 text-amber-500" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={`truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {item.prepared?.listingInput?.title || item.input}
                      </p>

                      {item.status === 'looking_up' && (
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('amazonLookupPage.lookingUpQuota')}
                        </p>
                      )}

                      {item.phase && (
                        <div className="mt-1">
                          <AutoListProgressStepper
                            phase={item.phase}
                            outcome={['listed', 'awaiting_confirmation', 'error'].includes(item.status) ? item.status : null}
                            t={t}
                            isDark={isDark}
                            variant="compact"
                          />
                        </div>
                      )}

                      {item.status === 'awaiting_confirmation' && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            ${Number(item.prepared?.listingInput?.price || 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => confirmBulkItem(index)}
                            className="btn-primary text-xs px-2.5 py-1"
                          >
                            {t('amazonLookupPage.confirmAndList')}
                          </button>
                        </div>
                      )}

                      {item.status === 'listed' && item.listingUrl && (
                        <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                          {item.listingUrl}
                        </a>
                      )}

                      {['error', 'quota_exceeded'].includes(item.status) && item.message && (
                        <p className="text-xs text-red-500">{item.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {singleListingState && (() => {
        const isPreview = singleListingState.status === 'awaiting_confirmation';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div
              className={`w-full ${isPreview ? 'max-w-4xl' : 'max-w-md'} max-h-full overflow-y-auto rounded-2xl border shadow-2xl transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <h2 className={`text-base font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <Sparkles size={15} />
                  </span>
                  {t('amazonLookupPage.autoListProgressTitle')}
                </h2>
                {singleListingState.status !== 'preparing' && (
                  <button
                    type="button"
                    onClick={closeListingModal}
                    className={`rounded-full p-1.5 transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="px-6 py-5">
                <AutoListProgressStepper
                  phase={singleListingState.phase}
                  outcome={['listed', 'awaiting_confirmation', 'error'].includes(singleListingState.status) ? singleListingState.status : null}
                  t={t}
                  isDark={isDark}
                  variant="full"
                />

                {singleListingState.status === 'error' && (
                  <div className={`mt-5 pt-5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className={`rounded-xl border p-3 flex items-start gap-2 ${isDark ? 'border-red-900 bg-red-950/30' : 'border-red-200 bg-red-50'}`}>
                      <XCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-300">{singleListingState.message}</p>
                    </div>
                    <button type="button" onClick={closeListingModal} className="btn-secondary text-xs mt-4">
                      {t('amazonLookupPage.cancel')}
                    </button>
                  </div>
                )}

                {isPreview && editableListing && (() => {
                  const li = editableListing;
                  const pictureUrls = Array.isArray(li.pictureUrls) ? li.pictureUrls : [];
                  const specEntries = li.itemSpecifics && typeof li.itemSpecifics === 'object' ? Object.entries(li.itemSpecifics) : [];
                  const policies = singleListingState.prepared?.policies || {};
                  const referenceFound = !!singleListingState.prepared?.referenceListingUrl;

                  const updateField = (field, value) => setEditableListing((prev) => ({ ...prev, [field]: value }));
                  const updateSpec = (name, value) =>
                    setEditableListing((prev) => ({ ...prev, itemSpecifics: { ...prev.itemSpecifics, [name]: value } }));
                  const removeImage = (idx) =>
                    setEditableListing((prev) => ({ ...prev, pictureUrls: prev.pictureUrls.filter((_, i) => i !== idx) }));
                  const addImageByUrl = () => {
                    const url = newImageUrl.trim();
                    if (!url) return;
                    setEditableListing((prev) => ({ ...prev, pictureUrls: [...(prev.pictureUrls || []), url].slice(0, 24) }));
                    setNewImageUrl('');
                  };

                  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
                    isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                  }`;

                  return (
                    <div className={`mt-5 pt-5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div
                        className={`flex items-start gap-2 rounded-xl border p-3 mb-5 text-sm ${
                          referenceFound
                            ? isDark
                              ? 'border-emerald-900 bg-emerald-950/30 text-emerald-200'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : isDark
                              ? 'border-amber-900 bg-amber-950/30 text-amber-200'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {referenceFound ? (
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        )}
                        <span>{singleListingState.prepared?.referenceNote}</span>
                      </div>

                      <div className="grid md:grid-cols-5 gap-6">
                        {/* Gallery */}
                        <div className="md:col-span-2 space-y-2">
                          {pictureUrls[0] && (
                            <div
                              className={`relative rounded-xl overflow-hidden border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}
                            >
                              <img src={pictureUrls[0]} alt={li.title || ''} className="w-full aspect-square object-contain" />
                              <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                {t('amazonLookupPage.coverImageBadge')}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeImage(0)}
                                className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full p-1"
                                title={t('amazonLookupPage.removeImage')}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                          {pictureUrls.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {pictureUrls.slice(1).map((url, idx) => (
                                <div
                                  key={`${url}-${idx}`}
                                  className={`relative group flex-none w-14 h-14 rounded-md overflow-hidden border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}
                                >
                                  <img src={url} alt={`${li.title || ''} ${idx + 2}`} className="w-full h-full object-contain" />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(idx + 1)}
                                    className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                    title={t('amazonLookupPage.removeImage')}
                                  >
                                    <X size={14} className="text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <input
                              value={newImageUrl}
                              onChange={(e) => setNewImageUrl(e.target.value)}
                              placeholder={t('amazonLookupPage.addImageUrlPlaceholder')}
                              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
                            />
                            <button type="button" onClick={addImageByUrl} className="btn-secondary text-xs px-2.5">
                              {t('amazonLookupPage.addImage')}
                            </button>
                          </div>
                          <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t('amazonLookupPage.previewGalleryTitle', { count: pictureUrls.length })}
                          </p>
                        </div>

                        {/* Details */}
                        <div className="md:col-span-3 space-y-4 min-w-0">
                          <div>
                            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {t('amazonLookupPage.previewTitleLabel')}
                            </label>
                            <input
                              value={li.title || ''}
                              onChange={(e) => updateField('title', e.target.value.slice(0, 80))}
                              maxLength={80}
                              className={inputCls}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={`block text-[11px] uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('amazonLookupPage.previewPriceLabel')}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={li.price}
                                onChange={(e) => updateField('price', Number(e.target.value))}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={`block text-[11px] uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('amazonLookupPage.previewStockLabel')}
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={li.quantity}
                                onChange={(e) => updateField('quantity', Math.max(1, Number(e.target.value) || 1))}
                                className={inputCls}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('amazonLookupPage.previewDescriptionTitle')}
                              </p>
                              {li.useRawDewisoHtml && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-950/50 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                                  {t('amazonLookupPage.dewisoTemplateBadge')}
                                </span>
                              )}
                            </div>
                            {li.useRawDewisoHtml ? (
                              <iframe
                                title="description-preview"
                                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:10px;font-size:13px;}</style></head><body>${li.description || ''}</body></html>`}
                                className={`w-full h-48 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                              />
                            ) : (
                              <textarea
                                value={li.description || ''}
                                onChange={(e) => updateField('description', e.target.value)}
                                rows={4}
                                className={`${inputCls} resize-none`}
                              />
                            )}
                          </div>

                          {specEntries.length > 0 && (
                            <div>
                              <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('amazonLookupPage.previewSpecificsTitle')}
                              </p>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {specEntries.map(([name, value]) => (
                                  <div key={name} className="grid grid-cols-5 gap-2 items-center">
                                    <span className={`col-span-2 text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={name}>
                                      {name}
                                    </span>
                                    {ITEM_ORIGIN_SPEC_ALIASES.has(name.trim().toLowerCase()) ? (
                                      <select
                                        value={value}
                                        onChange={(e) => updateSpec(name, e.target.value)}
                                        className={`col-span-3 rounded-md border px-2 py-1 text-xs ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
                                      >
                                        {COUNTRY_OPTIONS.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        value={value}
                                        onChange={(e) => updateSpec(name, e.target.value)}
                                        className={`col-span-3 rounded-md border px-2 py-1 text-xs ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {t('amazonLookupPage.previewPoliciesTitle')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {['shipping', 'payment', 'returns'].map((key) => (
                                <span
                                  key={key}
                                  className={`text-xs rounded-full px-2.5 py-1 border ${
                                    policies[key]
                                      ? isDark
                                        ? 'border-slate-700 bg-slate-800 text-slate-200'
                                        : 'border-slate-200 bg-slate-100 text-slate-700'
                                      : isDark
                                        ? 'border-amber-800 bg-amber-950/30 text-amber-300'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {t(`amazonLookupPage.previewPolicy_${key}`)}: {policies[key] || t('amazonLookupPage.previewPolicyNotSet')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={`flex justify-end gap-2 mt-6 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <button type="button" onClick={closeListingModal} className="btn-secondary text-sm px-4 py-2">
                          {t('amazonLookupPage.cancel')}
                        </button>
                        <button type="button" onClick={confirmSingleListing} className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                          <Sparkles size={14} />
                          {t('amazonLookupPage.confirmAndList')}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {singleListingState.status === 'listed' && (
                  <div className={`mt-5 pt-5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div
                      className={`rounded-xl border p-4 flex items-start gap-3 ${isDark ? 'border-emerald-900 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}
                    >
                      <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-emerald-500" />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>{t('amazonLookupPage.listingCreated')}</p>
                        {singleListingState.listingUrl && (
                          <a
                            href={singleListingState.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs underline break-all ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
                          >
                            {singleListingState.listingUrl}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {settingsModalOpen && settingsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t('amazonLookupPage.autoListSettings')}
              </h2>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.previewBeforeList}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, previewBeforeList: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {t('amazonLookupPage.previewBeforeListLabel')}
                </span>
              </label>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('amazonLookupPage.defaultStockQtyLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={settingsForm.defaultStockQty}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, defaultStockQty: e.target.value }))}
                  className="input-base"
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('amazonLookupPage.defaultProfitLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.defaultProfitUsd}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, defaultProfitUsd: e.target.value }))}
                  className="input-base"
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('amazonLookupPage.adRatePercentLabel')}
                </label>
                <input
                  type="number"
                  min="2"
                  max="100"
                  step="0.1"
                  placeholder={t('amazonLookupPage.adRatePercentPlaceholder')}
                  value={settingsForm.adRatePercent}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, adRatePercent: e.target.value }))}
                  className="input-base"
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('amazonLookupPage.defaultDewisoTemplateLabel')}
                </label>
                <select
                  value={settingsForm.defaultDewisoTemplateId}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, defaultDewisoTemplateId: e.target.value }))}
                  className="input-base"
                >
                  <option value="">{t('amazonLookupPage.defaultDewisoTemplateNone')}</option>
                  {dewisoTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setSettingsModalOpen(false)} className="btn-secondary text-sm" disabled={savingSettings}>
                {t('amazonLookupPage.cancel')}
              </button>
              <button type="button" onClick={saveSettings} className="btn-primary text-sm inline-flex items-center gap-1.5" disabled={savingSettings}>
                {savingSettings && <Loader2 size={14} className="animate-spin" />}
                {t('amazonLookupPage.saveSettings')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

