import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';
import { Loader2, Package, Link2, Search, SlidersHorizontal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ListingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(undefined);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [paging, setPaging] = useState({ nextOffset: null });
  const [fetchingPage, setFetchingPage] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const offset = useMemo(() => page * limit, [page, limit]);

  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);
        if (!status.connected) {
          setShowConnectModal(true);
          setLoading(false);
          return;
        }
        await loadPage(0);
      } catch (err) {
        // If disconnected or forbidden, trigger connect modal gracefully
        setShowConnectModal(true);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = async (pageIndex) => {
    try {
      setFetchingPage(true);
      const res = await ebayAPI.getListings(pageIndex * limit, limit);
      const data = res?.data || {};
      setItems(data.items || []);
      setTotal(typeof data.total === 'number' ? data.total : undefined);
      setPaging({ nextOffset: data.nextOffset ?? null, limit: data.limit, offset: data.offset });
      setPage(pageIndex);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to load eBay listings';
      setError(msg);
    } finally {
      setFetchingPage(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to start eBay connection';
      setError(msg);
    }
  };

  const canPrev = page > 0;
  const canNext = items.length === limit && (paging.nextOffset === null ? true : paging.nextOffset >= (page + 1) * limit);
  const normalizedItems = useMemo(
    () =>
      (items || []).map((offer) => {
        const id = offer?.offerId || offer?.listingId || offer?.listing?.listingId || offer?.sku || '-';
        const status = String(offer?.status || offer?.marketplaceId || '-');
        const title = offer?.listing?.title || offer?.title || offer?.product?.title || '(no title)';
        let rawQuantity = null;
        let rawSold = null;
        if (offer?.rawXml && typeof DOMParser !== 'undefined') {
          try {
            const doc = new DOMParser().parseFromString(offer.rawXml, 'text/xml');
            const getText = (selector) => doc.querySelector(selector)?.textContent?.trim() || '';
            const q = getText('Quantity');
            const s = getText('SellingStatus > QuantitySold');
            rawQuantity = q !== '' ? Number(q) : null;
            rawSold = s !== '' ? Number(s) : null;
          } catch {
            rawQuantity = null;
            rawSold = null;
          }
        }
        const fallbackQuantity =
          typeof offer?.availableQuantity === 'number'
            ? offer.availableQuantity
            : offer?.quantity ?? offer?.availability?.shipToLocationAvailability?.quantity ?? null;
        return { ...offer, _id: id, _status: status, _title: title };
      }),
    [items]
  );
  const filteredItems = useMemo(() => {
    return normalizedItems.filter((offer) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        offer._title.toLowerCase().includes(q) ||
        String(offer._id).toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || offer._status.toUpperCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [normalizedItems, query, statusFilter]);
  const activeCount = useMemo(
    () => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'ACTIVE').length,
    [normalizedItems]
  );
  const completedCount = useMemo(
    () => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'COMPLETED').length,
    [normalizedItems]
  );
  const getStatusPill = (statusRaw) => {
    const status = String(statusRaw || '-').toUpperCase();
    if (status.includes('ACTIVE')) {
      return isDark
        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status.includes('COMPLETE')) {
      return isDark
        ? 'bg-slate-800 text-slate-300 border-slate-700'
        : 'bg-slate-100 text-slate-700 border-slate-200';
    }
    return isDark
      ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800'
      : 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`page-title flex items-center gap-2 ${isDark ? 'text-slate-100' : ''}`}>
          <Package size={18} />
          Listings
        </h1>
        {ebayStatus.connected ? (
          <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {typeof total === 'number' ? `Total: ${total}` : null}
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {!ebayStatus.connected ? (
        <>
          {/* Fallback content in case modal is dismissed */}
          <div className={`rounded-xl p-6 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mb-4`}>Connect your eBay account to view your listings.</p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} />
              Connect eBay
            </button>
          </div>
          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className={`w-full max-w-md p-6 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'glass-card'}`}>
                <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-100' : ''}`}>eBay Sign-in Required</h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  You need to connect your eBay account to access your listings.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowConnectModal(false)}
                  >
                    Close
                  </button>
                  <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={handleConnect}>
                    <Link2 size={16} />
                    Connect eBay
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Showing</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{filteredItems.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{activeCount}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Completed</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{completedCount}</p>
          </div>
        </div>
        <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative md:col-span-2">
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or listing ID..."
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </label>
            <label className="relative">
              <SlidersHorizontal size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
          </div>
        </div>
        <div className={`p-0 overflow-hidden rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={`${isDark ? 'bg-slate-800/70' : 'bg-slate-50'}`}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Title</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Listing ID</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Price</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Quantity</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Sold</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={`${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
                {filteredItems.map((offer, idx) => {
                  const key = offer._id;
                  const title = offer._title;
                  const price = offer?.pricingSummary?.price?.value
                    ? `${offer.pricingSummary.price.value} ${offer.pricingSummary.price.currency || ''}`.trim()
                    : '-';
                  let qty = null;
                  let sold = null;
                  if (offer?.rawXml && typeof DOMParser !== 'undefined') {
                    try {
                      const doc = new DOMParser().parseFromString(offer.rawXml, 'text/xml');
                      const getText = (selector) => doc.querySelector(selector)?.textContent?.trim() || '';
                      const q = getText('Quantity');
                      const s = getText('SellingStatus > QuantitySold');
                      qty = q !== '' ? Number(q) : null;
                      sold = s !== '' ? Number(s) : null;
                    } catch {
                      qty = null;
                      sold = null;
                    }
                  }
                  if (qty == null) {
                    qty =
                      typeof offer?.availableQuantity === 'number'
                        ? offer.availableQuantity
                        : offer?.quantity ?? offer?.availability?.shipToLocationAvailability?.quantity ?? null;
                  }
                  if (sold == null) sold = '-';
                  const status = offer?._status || '-';
                  const listingId = offer?.listingId || offer?.listing?.listingId || offer?.listing?.legacyItemId || offer?.sku || '-';
                  return (
                    <React.Fragment key={`${key}-${idx}`}>
                      <tr className={`${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{listingId}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{price}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{qty ?? '-'}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sold}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getStatusPill(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/listings/${encodeURIComponent(String(listingId))}`, {
                                state: { listing: offer },
                              })
                            }
                            className={`inline-flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No listings found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              Page {page + 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canPrev && loadPage(page - 1)}
                disabled={!canPrev || fetchingPage}
                className="btn-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => canNext && loadPage(page + 1)}
                disabled={!canNext || fetchingPage}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

