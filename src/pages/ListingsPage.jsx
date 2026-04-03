import React, { useEffect, useMemo, useState } from 'react';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';
import { Loader2, Package, ChevronDown, ChevronUp, Link2 } from 'lucide-react';

export default function ListingsPage() {
  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(undefined);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [expanded, setExpanded] = useState({});
  const [paging, setPaging] = useState({ nextOffset: null });
  const [fetchingPage, setFetchingPage] = useState(false);

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

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const canPrev = page > 0;
  const canNext = items.length === limit && (paging.nextOffset === null ? true : paging.nextOffset >= (page + 1) * limit);

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
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} />
          Listings
        </h1>
        {ebayStatus.connected ? (
          <div className="text-sm text-slate-500">
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
          <div className="glass-card p-6 text-center">
            <p className="text-slate-600 mb-4">Connect your eBay account to view your listings.</p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} />
              Connect eBay
            </button>
          </div>
          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="glass-card w-full max-w-md p-6">
                <h2 className="text-lg font-semibold mb-2">eBay Sign-in Required</h2>
                <p className="text-sm text-slate-600 mb-4">
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
        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Listing ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((offer) => {
                  const key = offer.offerId || offer.listingId || offer?.listing?.listingId || Math.random().toString(36).slice(2);
                  const title = offer?.listing?.title || offer?.title || offer?.product?.title || '(no title)';
                  const price = offer?.pricingSummary?.price?.value
                    ? `${offer.pricingSummary.price.value} ${offer.pricingSummary.price.currency || ''}`.trim()
                    : '-';
                  const qty = typeof offer?.availableQuantity === 'number'
                    ? offer.availableQuantity
                    : (offer?.quantity ?? offer?.availability?.shipToLocationAvailability?.quantity ?? '-');
                  const status = offer?.status || offer?.marketplaceId || '-';
                  const listingId = offer?.listingId || offer?.listing?.listingId || offer?.listing?.legacyItemId || offer?.sku || '-';
                  const isOpen = !!expanded[key];
                  return (
                    <React.Fragment key={key}>
                      <tr className="bg-white">
                        <td className="px-4 py-3 text-sm text-slate-700">{title}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{listingId}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{price}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{qty}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{status}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(key)}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                          >
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-3">
                            <pre className="text-xs overflow-auto max-h-96">
{JSON.stringify(offer, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">
                      No listings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
            <div className="text-sm text-slate-500">
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
      )}
    </div>
  );
}

