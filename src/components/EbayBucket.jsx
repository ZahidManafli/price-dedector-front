/**
 * EbayBucket.jsx
 *
 * A floating bucket panel for bulk eBay listing.
 *
 * Features:
 *  - Floating bucket icon with item count badge
 *  - Slide-in drawer showing all bucket items
 *  - Click item → open ListOnEbayModal with scraped data pre-filled
 *  - Edit / delete items in bucket
 *  - "List All" bulk button
 *  - Successful listing IDs panel — click to open eBay item in new tab
 */

import React, { useState, useCallback } from 'react';
import { ShoppingBasket, X, Trash2, ExternalLink, Loader2, CheckCircle2, Package, ChevronRight, AlertCircle } from 'lucide-react';
import ListOnEbayModal from './ListOnEbayModal';

// ─── useBucket hook ─────────────────────────────────────────────────────────────
// Exposes bucket state + actions. Import this in MarketAnalysisPage and pass down.

const BUCKET_STORAGE_KEY = 'checkilaEbayBucket:v1';
const SUCCESSFUL_LISTINGS_KEY = 'checkilaEbayBucketSuccess:v1';

function loadFromStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function useBucket() {
  const [items, setItems] = useState(() => loadFromStorage(BUCKET_STORAGE_KEY, []));
  const [successfulListings, setSuccessfulListings] = useState(() => loadFromStorage(SUCCESSFUL_LISTINGS_KEY, []));

  // Persist items to localStorage on change
  React.useEffect(() => {
    saveToStorage(BUCKET_STORAGE_KEY, items);
  }, [items]);

  React.useEffect(() => {
    saveToStorage(SUCCESSFUL_LISTINGS_KEY, successfulListings);
  }, [successfulListings]);

  const addToBucket = useCallback((item, scrapedData) => {
    setItems((prev) => {
      const exists = prev.find((b) => b.id === item.id);
      if (exists) {
        return prev.map((b) => b.id === item.id ? { ...b, scrapedData } : b);
      }
      return [
        ...prev,
        { id: item.id, item, scrapedData, addedAt: Date.now() },
      ];
    });
  }, []);

  const updateBucketItem = useCallback((id, updates) => {
    setItems((prev) =>
      prev.map((b) => b.id === id ? { ...b, ...updates } : b)
    );
  }, []);

  const removeFromBucket = useCallback((id) => {
    setItems((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBucket = useCallback(() => setItems([]), []);

  const addSuccessfulListing = useCallback((listing) => {
    setSuccessfulListings((prev) => [{ ...listing, addedAt: Date.now() }, ...prev]);
  }, []);

  return {
    items,
    successfulListings,
    addToBucket,
    updateBucketItem,
    removeFromBucket,
    clearBucket,
    addSuccessfulListing,
  };
}

// ─── BucketIcon button ───────────────────────────────────────────────────────────
// Floating action button shown on the page. Click → opens drawer.

export function BucketTrigger({ count, onClick, isDark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open Listing Bucket (${count} item${count !== 1 ? 's' : ''})`}
      className={`
        fixed bottom-6 right-6 z-40
        flex items-center gap-2
        px-4 py-3 rounded-2xl shadow-2xl
        font-semibold text-sm
        transition-all duration-200
        hover:scale-105 active:scale-95
        ${isDark
          ? 'bg-blue-600 hover:bg-blue-500 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
        }
      `}
      aria-label={`Listing bucket with ${count} items`}
    >
      <ShoppingBasket size={18} />
      <span>Bucket</span>
      {count > 0 && (
        <span className="
          inline-flex items-center justify-center
          min-w-[20px] h-5 px-1.5
          rounded-full bg-white text-blue-600
          text-xs font-bold leading-none
        ">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── AddToBucketButton ────────────────────────────────────────────────────────
// Small bucket icon button shown per row. Scrapes then adds to bucket.

export function AddToBucketButton({ item, onAdd, isDark, isInBucket, isScraping }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      title={isInBucket ? 'Already in bucket — click to re-scrape' : 'Add to listing bucket'}
      disabled={isScraping}
      className={`
        inline-flex items-center justify-center
        w-8 h-8 rounded-lg border
        transition-all duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
        ${isInBucket
          ? isDark
            ? 'bg-blue-900/60 border-blue-500 text-blue-300'
            : 'bg-blue-50 border-blue-400 text-blue-600'
          : isDark
            ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-blue-400 hover:text-blue-300'
            : 'bg-white border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'
        }
      `}
      aria-label={isInBucket ? 'Update bucket item' : 'Add to bucket'}
    >
      {isScraping ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <ShoppingBasket size={14} />
      )}
    </button>
  );
}

// ─── BucketDrawer ────────────────────────────────────────────────────────────────
// Full drawer component.

export function BucketDrawer({
  open,
  onClose,
  items,
  successfulListings,
  onRemove,
  onClear,
  onAddSuccessfulListing,
  onUpdateItem,
  isDark,
}) {
  const [activeModal, setActiveModal] = useState(null); // bucketEntry
  const [bulkListingIds, setBulkListingIds] = useState([]); // item ids currently being bulk listed
  const [bulkErrors, setBulkErrors] = useState({}); // id → error string

  // Open modal for a single bucket item
  const handleOpenItem = (entry) => {
    setActiveModal(entry);
  };

  // Called when ListOnEbayModal successfully lists an item (single)
  const handleSingleListSuccess = (entry, result) => {
    onAddSuccessfulListing({
      itemId: result.itemId,
      listingUrl: result.listingUrl,
      title: entry.item?.title || 'Listing',
    });
    onRemove(entry.id);
    setActiveModal(null);
  };

  // Bulk list all items sequentially
  const handleListAll = async () => {
    if (items.length === 0) return;
    const ids = items.map((e) => e.id);
    setBulkListingIds(ids);
    setBulkErrors({});

    for (const entry of items) {
      try {
        // Dynamically import the api to list — reuse same endpoint as ListOnEbayModal
        const { ebayAPI } = await import('../services/api');
        const scraped = entry.scrapedData || {};
        const itm = entry.item || {};

        // Normalize itemSpecifics to object (not array)
        let itemSpecificsObj = null;
        if (Array.isArray(scraped.itemSpecifics)) {
          const EXCLUDED_SPECIFICS = new Set(['condition', 'item condition']);
          itemSpecificsObj = {};
          scraped.itemSpecifics.forEach(({ name, label, value }) => {
            const key = name || label;
            if (key && value && !EXCLUDED_SPECIFICS.has(String(key).toLowerCase().trim())) {
              itemSpecificsObj[key] = value;
            }
          });
          if (Object.keys(itemSpecificsObj).length === 0) itemSpecificsObj = null;
        } else if (scraped.itemSpecifics && typeof scraped.itemSpecifics === 'object') {
          itemSpecificsObj = scraped.itemSpecifics;
        }

        const payload = {
          title: scraped.title || itm.title || '',
          description: scraped.description || itm.title || '',
          price: scraped.price ?? itm.priceValue ?? 0,
          quantity: scraped.quantity ?? 1,
          categoryId: scraped.categoryId || '',
          pictureUrls: scraped.pictureUrls || (itm.imageUrl ? [itm.imageUrl] : []),
          conditionId: scraped.conditionId ?? 1000,
          currency: scraped.currency || 'USD',
          itemSpecifics: itemSpecificsObj,
          freeShipping: scraped.freeShipping ?? true,
          dispatchTimeMax: scraped.dispatchTimeMax ?? 3,
          postalCode: scraped.postalCode || '',
        };

        const res = await ebayAPI.quickList(payload);
        const result = res?.data || {};

        if (result.success && result.itemId) {
          onAddSuccessfulListing({
            itemId: result.itemId,
            listingUrl: result.listingUrl,
            title: payload.title,
          });
          onRemove(entry.id);
        } else {
          setBulkErrors((prev) => ({
            ...prev,
            [entry.id]: result?.error || 'Listing failed',
          }));
        }
      } catch (err) {
        setBulkErrors((prev) => ({
          ...prev,
          [entry.id]: err?.response?.data?.error || err?.message || 'Error',
        }));
      } finally {
        setBulkListingIds((prev) => prev.filter((id) => id !== entry.id));
      }
    }
  };

  const isAnyBulkRunning = bulkListingIds.length > 0;

  const base = isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDark ? 'border-slate-700' : 'border-slate-200';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200';
  const dangerBtn = isDark
    ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30'
    : 'text-red-500 hover:text-red-700 hover:bg-red-50';

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 z-50
          h-full w-full max-w-md
          flex flex-col shadow-2xl
          ${base}
          border-l ${border}
          animate-[slideInRight_0.22s_ease-out]
        `}
        style={{ animation: 'slideInRight 0.22s ease-out' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border} shrink-0`}>
          <div className="flex items-center gap-2.5">
            <ShoppingBasket size={20} className="text-blue-500" />
            <div>
              <h2 className="font-bold text-base leading-tight">Listing Bucket</h2>
              <p className={`text-xs ${subText}`}>
                {items.length} item{items.length !== 1 ? 's' : ''} ready to list
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${dangerBtn}`}
                title="Clear all bucket items"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
              aria-label="Close bucket"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ── Bucket items ── */}
          {items.length === 0 && successfulListings.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-16 gap-3 ${subText}`}>
              <Package size={40} className="opacity-30" />
              <p className="text-sm text-center">
                Your bucket is empty.<br />
                Click the <ShoppingBasket size={13} className="inline-block" /> icon on any row to add items.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <section>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${subText}`}>
                Items to List ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((entry) => {
                  const isRunning = bulkListingIds.includes(entry.id);
                  const err = bulkErrors[entry.id];
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl border p-3 flex items-center gap-3 group ${cardBg}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
                        {entry.item?.imageUrl ? (
                          <img
                            src={entry.item.imageUrl}
                            alt={entry.item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                            N/A
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2 leading-snug">
                          {entry.item?.title || 'Untitled'}
                        </p>
                        <div className={`flex items-center gap-2 mt-0.5 text-xs ${subText}`}>
                          {entry.scrapedData?.price != null && (
                            <span className="font-semibold text-emerald-500">
                              ${Number(entry.scrapedData.price).toFixed(2)}
                            </span>
                          )}
                          {entry.scrapedData?.categoryName && (
                            <span className="truncate">{entry.scrapedData.categoryName}</span>
                          )}
                        </div>
                        {err && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                            <AlertCircle size={11} />
                            {err}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isRunning ? (
                          <Loader2 size={16} className="animate-spin text-blue-400" />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenItem(entry)}
                              title="Edit & list this item"
                              className={`
                                p-1.5 rounded-lg transition-colors
                                ${isDark
                                  ? 'hover:bg-blue-800/50 text-blue-400'
                                  : 'hover:bg-blue-50 text-blue-600'
                                }
                              `}
                            >
                              <ChevronRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemove(entry.id)}
                              title="Remove from bucket"
                              className={`
                                p-1.5 rounded-lg transition-colors
                                ${dangerBtn}
                              `}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Successful listings ── */}
          {successfulListings.length > 0 && (
            <section className="mt-2">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${subText}`}>
                ✅ Successfully Listed ({successfulListings.length})
              </p>
              <div className="space-y-2">
                {successfulListings.map((listing, idx) => (
                  <button
                    key={`${listing.itemId}-${idx}`}
                    type="button"
                    onClick={() => {
                      const url = listing.listingUrl || `https://www.ebay.com/itm/${listing.itemId}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    title="Open on eBay"
                    className={`
                      w-full text-left rounded-xl border p-3
                      flex items-center gap-3
                      transition-colors group
                      ${isDark
                        ? 'bg-emerald-950/30 border-emerald-800/50 hover:bg-emerald-900/30'
                        : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                      }
                    `}
                  >
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{listing.title}</p>
                      <p className={`text-xs font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        #{listing.itemId}
                      </p>
                    </div>
                    <ExternalLink
                      size={13}
                      className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDark ? 'text-emerald-400' : 'text-emerald-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer — List All */}
        {items.length > 0 && (
          <div className={`px-4 py-4 border-t ${border} shrink-0`}>
            <button
              type="button"
              onClick={handleListAll}
              disabled={isAnyBulkRunning}
              className="
                w-full py-3 rounded-xl
                bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-semibold text-sm
                flex items-center justify-center gap-2
                transition-colors
              "
            >
              {isAnyBulkRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Listing {bulkListingIds.length} remaining…
                </>
              ) : (
                <>
                  <ShoppingBasket size={16} />
                  List All ({items.length}) on eBay
                </>
              )}
            </button>
            <p className={`text-xs text-center mt-2 ${subText}`}>
              Items will be listed sequentially using your scraped data.
            </p>
          </div>
        )}
      </div>

      {/* Single-item ListOnEbayModal */}
      {activeModal && (
        <ListOnEbayModal
          item={activeModal.item}
          scrapedOverride={activeModal.scrapedData}
          isDark={isDark}
          onClose={() => setActiveModal(null)}
          onSuccess={(result) => handleSingleListSuccess(activeModal, result)}
          onUpdateItem={(updates) => {
            // Only update if there are changes
            if (updates && typeof onUpdateItem === 'function') {
              onUpdateItem(activeModal.id, updates);
            }
          }}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
