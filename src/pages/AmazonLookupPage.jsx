import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { amazonAPI, ebayAPI, productAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import EbayListingDraftModal from '../components/EbayListingDraftModal';
import {
  buildAmazonProductUrl,
  extractAmazonAsin,
  formatCurrency,
  isValidAmazonAsin,
} from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import {
  Link as LinkIcon,
  Image as ImageIcon,
  Search as SearchIcon,
  Trash2,
} from 'lucide-react';

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
  const [amazonAsin, setAmazonAsin] = useState('');
  const [autoLookupEnabled, setAutoLookupEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [result, setResult] = useState(null);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lookupQuota, setLookupQuota] = useState(null);
  const [history, setHistory] = useState([]);
  const [listingDraft, setListingDraft] = useState(null);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [listingError, setListingError] = useState('');
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);
  const [isUpdatingDraft, setIsUpdatingDraft] = useState(false);
  const [listingSubmission, setListingSubmission] = useState(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

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
        message: 'Amazon lookup quota reached. Ask admin to increase your limit or wait for reset.',
      });
      return;
    }

    const normalizedAsin = extractAmazonAsin(asinValue);
    if (!isValidAmazonAsin(normalizedAsin)) {
      setAlert({ type: 'warning', message: 'Please enter a valid Amazon ASIN (10 characters).' });
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
          'Failed to lookup Amazon product. Please check the ASIN and try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [isLookupQuotaReached]);

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

  useDebouncedAutoLookup({
    amazonAsin,
    autoLookupEnabled,
    onLookup: lookup,
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canLookup) {
      setAlert({ type: 'warning', message: 'Please enter a valid Amazon ASIN (10 characters).' });
      return;
    }
    lookup(extractAmazonAsin(amazonAsin));
  };

  const openListingModal = useCallback(async () => {
    const asin = result?.asin || extractAmazonAsin(amazonAsin);
    if (!asin) {
      setAlert({ type: 'warning', message: 'No ASIN found for this result.' });
      return;
    }

    setListingError('');
    setListingSubmission(null);
    setListingDraft(null);
    setIsListingModalOpen(true);

    try {
      const amazonBasePrice = Number(result?.price?.usd || 0);
      const defaultPrice = amazonBasePrice > 0 ? Number((amazonBasePrice + 2).toFixed(2)) : undefined;
      const overrides = {};
      if (Number.isFinite(defaultPrice) && defaultPrice > 0) {
        overrides.price = defaultPrice;
      }

      const response = await ebayAPI.createListingDraft({
        asin,
        overrides,
        sourceProduct: result,
      });
      setListingDraft(response?.data?.draft || null);
    } catch (error) {
      setListingError(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to prepare eBay listing draft.'
      );
    }
  }, [amazonAsin, result]);

  const updateDraft = useCallback(async (updates) => {
    if (!listingDraft?.id) return;
    setIsUpdatingDraft(true);
    setListingError('');
    try {
      const response = await ebayAPI.updateListingDraft(listingDraft.id, updates || {});
      setListingDraft(response?.data?.draft || listingDraft);
    } catch (error) {
      setListingError(
        error?.response?.data?.error || error?.message || 'Failed to update listing draft.'
      );
    } finally {
      setIsUpdatingDraft(false);
    }
  }, [listingDraft]);

  const submitListing = useCallback(async () => {
    if (!listingDraft?.id) return;
    setListingError('');
    setIsSubmittingListing(true);
    try {
      const response = await ebayAPI.submitListingDraft(listingDraft.id);
      setListingSubmission(response?.data?.submission || null);
      setListingDraft((prev) => ({ ...prev, ...(response?.data?.payload || {}) }));
      setAlert({ type: 'success', message: 'eBay listing created successfully.' });
    } catch (error) {
      setListingError(
        error?.response?.data?.error || error?.message || 'Failed to submit listing to eBay.'
      );
    } finally {
      setIsSubmittingListing(false);
    }
  }, [listingDraft]);

  const addToProductsAfterListing = useCallback(async (email) => {
    const trimmedEmail = String(email || '').trim();
    if (!trimmedEmail) {
      setListingError('Email is required to add this listing to products.');
      return;
    }

    const asin = listingDraft?.asin || result?.asin || extractAmazonAsin(amazonAsin);
    const ebayItemId = String(listingSubmission?.itemId || '').match(/\d{9,15}/)?.[0] || '';
    if (!asin || !ebayItemId) {
      setListingError('Could not extract ASIN or eBay Item ID for product creation.');
      return;
    }

    const amazonPrice = Number(result?.price?.usd || 0);
    const ebayPrice = Number(listingDraft?.price || 0);
    if (!(amazonPrice > 0 && ebayPrice > 0)) {
      setListingError('Amazon and eBay prices must be greater than zero to add product.');
      return;
    }

    const formData = new FormData();
    formData.append('productName', String(listingDraft?.title || result?.title || `ASIN ${asin}`).slice(0, 120));
    formData.append('amazonAsin', asin);
    formData.append('ebayItemId', ebayItemId);
    formData.append('currentAmazonPrice', String(amazonPrice));
    formData.append('currentEbayPrice', String(ebayPrice));
    formData.append('userEmail', trimmedEmail);

    setIsAddingProduct(true);
    setListingError('');
    try {
      await productAPI.create(formData);
      setAlert({ type: 'success', message: 'Listing was added to products successfully.' });
      setIsListingModalOpen(false);
      setListingSubmission(null);
      setListingDraft(null);
    } catch (error) {
      setListingError(
        error?.response?.data?.error || error?.message || 'Failed to add listing to products.'
      );
    } finally {
      setIsAddingProduct(false);
    }
  }, [amazonAsin, listingDraft, listingSubmission, result]);

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="page-title">Amazon Lookup</h1>
            <p className="page-subtitle">
              Enter an Amazon ASIN to instantly get images, description, and price.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoLookupEnabled}
                onChange={(e) => setAutoLookupEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-slate-700">Auto lookup (paste)</span>
            </label>
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

        <div className={`glass-card overflow-hidden relative ${isDark ? 'bg-slate-950 border-slate-800' : ''}`}>
          <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 to-blue-900 text-white">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              <div className="flex-1">
                <div className="text-xs text-blue-100 flex items-center gap-2 mb-2">
                  <SearchIcon size={14} />
                  Amazon ASIN
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
                      placeholder="B09836X9RR"
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
                          Checking...
                        </>
                      ) : (
                        <>
                          Check
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
                    <>Lookup quota: Unlimited. Tip: Press Enter to check immediately.</>
                  ) : (
                    <>
                      Lookup quota: {lookupQuota.remainingThisWeek} left this week
                      {lookupQuota.resetAt ? ` (resets ${new Date(lookupQuota.resetAt).toLocaleString()})` : ''}.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {loading && !result ? (
              <LoadingSpinner />
            ) : !result ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-card p-4 md:p-5">
                  <div className="text-xs font-semibold text-blue-600 mb-2">
                    Instant Results
                  </div>
                  <p className="text-sm text-slate-600">
                    Enter an Amazon ASIN and the app extracts price, images, and description.
                  </p>
                </div>
                <div className="glass-card p-4 md:p-5">
                  <div className="text-xs font-semibold text-blue-600 mb-2">
                    Image Gallery
                  </div>
                  <p className="text-sm text-slate-600">
                    Choose different product images before saving or comparing.
                  </p>
                </div>
                <div className="glass-card p-4 md:p-5">
                  <div className="text-xs font-semibold text-blue-600 mb-2">
                    Price in Seconds
                  </div>
                  <p className="text-sm text-slate-600">
                    Live extraction with fallback parsing for varying Amazon layouts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-5">
                {/* Gallery */}
                <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        <ImageIcon size={16} className="text-blue-600" />
                        Product images
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
                            alt={result.title || 'Amazon product image'}
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
                                message: ok ? 'Image download started!' : 'Opened image in a new tab (save manually).',
                              });
                            }}
                          >
                            Download active
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
                                setAlert({ type: 'success', message: 'Downloading images...' });
                              } catch {
                                setAlert({ type: 'warning', message: 'Some downloads may have failed. Try single download.' });
                              }
                            }}
                            disabled={!result.images.length}
                          >
                            Download all
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
                        No images found for this ASIN.
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
                          Extracted from your Amazon ASIN
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end">
                        <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Amazon price</div>
                        <div className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {formatCurrency(result?.price?.usd ?? 0)}
                        </div>
                        {result?.price?.currency && result.price.currency !== 'USD' && (
                          <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Raw: {Number(result.price.raw).toFixed(2)} {result.price.currency}
                          </div>
                        )}

                        {result?.price?.subscribedUsd != null && (
                          <div className="mt-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                                Subscribe & Save
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
                        Open on Amazon
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              buildAmazonProductUrl(result?.asin || extractAmazonAsin(amazonAsin))
                            );
                            setAlert({ type: 'success', message: 'Link copied!' });
                          } catch {
                            setAlert({
                              type: 'warning',
                              message: 'Could not copy URL on this browser.',
                            });
                          }
                        }}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        Copy URL
                      </button>
                    </div>
                  </div>

                  <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
                    <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      Description
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
                        No description/bullets were found on this page.
                      </div>
                    )}
                  </div>

                    {/* Profit Planner */}
                    <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Profit Planner (eBay price)
                      </h3>

                      <div className="flex flex-col gap-3">
                        <label className={`block text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                          Target profit you want to make (USD)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={targetProfit}
                          onChange={(e) => setTargetProfit(e.target.value)}
                          placeholder="e.g. 20.00"
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
                            Use Subscribe &amp; Save price (if available)
                          </span>
                        </label>

                        <div className={`rounded-lg p-3 border ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-[180px]">
                              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Amazon cost used</p>
                              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {result?.price ? formatCurrency(profitPlanner.cogs || 0) : '—'}
                              </p>
                            </div>
                            <div className="min-w-[220px]">
                              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>eBay listing price (sale price)</p>
                              <p className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {profitPlanner.ebayPrice > 0 ? formatCurrency(profitPlanner.ebayPrice) : '—'}
                              </p>
                            </div>
                          </div>

                          {profitPlanner.ebayPrice > 0 ? (
                            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Based on fee model: final value fee + managed payment fee (shipping/ad/other costs assumed 0).
                            </p>
                          ) : (
                            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Enter a target profit to calculate the eBay price.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setAlert({ type: 'info', message: 'List on eBay is available soon.' })}
                      className="btn-primary"
                      disabled
                      title="Available soon"
                    >
                      List on eBay - Available soon
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAmazonAsin('');
                        setResult(null);
                        setActiveImageIdx(0);
                        setAlert(null);
                      }}
                      className="btn-secondary"
                    >
                      Check another ASIN
                    </button>
                    <RouterLink
                      to="/add-product"
                      className="btn-primary inline-flex items-center justify-center gap-2"
                      state={{
                        amazonAsin: result?.asin || extractAmazonAsin(amazonAsin),
                        amazonTitle: result.title,
                      }}
                    >
                      Save to tracking
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
                    Recent Amazon searches
                  </h3>
                  <button
                    type="button"
                    onClick={fetchHistory}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Refresh
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
                            {item.cached ? 'cached' : 'live'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
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
      </div>

      <EbayListingDraftModal
        isOpen={isListingModalOpen}
        draft={listingDraft}
        error={listingError}
        submitting={isSubmittingListing}
        updatingDraft={isUpdatingDraft}
        creatingProduct={isAddingProduct}
        submission={listingSubmission}
        onClose={() => {
          if (isSubmittingListing || isAddingProduct) return;
          setIsListingModalOpen(false);
          setListingError('');
          setListingSubmission(null);
          setListingDraft(null);
        }}
        onConfirm={submitListing}
        onUpdateDraft={updateDraft}
        onCreateProduct={addToProductsAfterListing}
      />
    </div>
  );
}

