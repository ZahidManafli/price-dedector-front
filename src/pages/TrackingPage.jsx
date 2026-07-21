import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Truck, Loader2, ExternalLink, AlertTriangle, MessageSquare, X, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { ebayAPI, settingsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// Same lookup as OrdersPage.jsx — eBay order line items never carry an image
// themselves, so it has to be joined in from the separate (cached) listings snapshot
// via the line item's legacyItemId.
function resolveListingId(listing) {
  return String(listing?.listingId || listing?.listing?.listingId || listing?.offerId || listing?.sku || '').trim();
}

function resolveListingImageUrl(listing) {
  const directImage =
    listing?.listing?.image?.imageUrl ||
    listing?.listing?.thumbnailImages?.[0]?.imageUrl ||
    listing?.imageUrl ||
    listing?.thumbnailUrl ||
    listing?.listing?.imageUrl ||
    '';
  if (directImage) return directImage;

  const pictureUrls = Array.isArray(listing?.pictureUrls) ? listing.pictureUrls : [];
  if (pictureUrls.length > 0 && pictureUrls[0]) return pictureUrls[0];

  if (listing?.rawXml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(listing.rawXml, 'text/xml');
      const firstPicture = doc.querySelector('PictureDetails > PictureURL')?.textContent?.trim();
      if (firstPicture) return firstPicture;
    } catch {
      return '';
    }
  }

  return '';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// Three-stage stepper (Ordered -> Shipped -> Delivered) driven by fulfillmentStatus —
// the one field that's always accurate (see upsertTrackingRecord's shipped/delivered
// stamping), unlike Aquiline's own status string which reflects Aquiline's view of the
// order, not necessarily what Amazon's tracking page has since reported. Completed
// stages are solid green; the current stage pulses blue; stages not reached yet stay
// gray — except once fully "delivered", every stage shows green.
function FulfillmentStepper({ status, isDark }) {
  const steps = [
    { key: 'ordered', label: 'Ordered' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const normalized = status === 'delivered' || status === 'shipped' ? status : 'ordered';
  const currentIndex = steps.findIndex((s) => s.key === normalized);
  const allDelivered = normalized === 'delivered';

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const isCompleted = allDelivered || i < currentIndex;
        const isCurrent = !allDelivered && i === currentIndex;
        const connectorGreen = allDelivered || i <= currentIndex;
        const dotCls = isCompleted
          ? 'bg-emerald-500'
          : isCurrent
          ? 'bg-blue-500'
          : isDark ? 'bg-slate-700' : 'bg-slate-300';
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`h-0.5 w-5 ${connectorGreen ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            )}
            <div className="relative flex h-3 w-3 shrink-0 items-center justify-center" title={step.label}>
              {isCurrent && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotCls}`} />
            </div>
          </div>
        );
      })}
      <span className={`ml-2 text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {steps[allDelivered ? 2 : currentIndex].label}
      </span>
    </div>
  );
}

// Loading → success/not-shipped/error modal shared by the "Get Tracking" and
// "Update Labels" flows. Both are extension-driven jobs that take a while (opening
// the Amazon tracking page in a real tab, waiting for it to render, scraping it),
// so this stays open with a spinner the whole time rather than a quick inline one.
function JobStatusModal({ phase, message, isDark }) {
  if (!phase) return null;
  // Rendered via a portal — this can be invoked from inside a <tr>, and a
  // fixed-position overlay div isn't valid HTML as a direct child of one (browsers
  // will otherwise hoist/misplace it out of the table in unpredictable ways).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className={`rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 border flex flex-col items-center gap-4 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {phase === 'loading' && (
          <>
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className={`text-sm font-medium text-center ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {message || 'Working…'}
            </p>
          </>
        )}
        {phase === 'success' && (
          <>
            <svg width="48" height="48" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
              <circle cx="26" cy="26" r="24" fill="#f0fff4" stroke="#22c55e" strokeWidth="2" />
              <polyline
                points="15,27 22,34 37,18"
                fill="none"
                stroke="#22c55e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{message || 'Done'}</p>
          </>
        )}
        {phase === 'not_shipped' && (
          <>
            <svg width="48" height="48" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
              <circle cx="26" cy="26" r="24" fill="#fffbeb" stroke="#f59e0b" strokeWidth="2" />
              <line x1="26" y1="16" x2="26" y2="29" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="26" cy="36" r="1.8" fill="#f59e0b" />
            </svg>
            <p className="text-sm font-medium text-center text-amber-500">{message || 'Not shipped yet'}</p>
          </>
        )}
        {phase === 'error' && (
          <>
            <svg width="48" height="48" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
              <circle cx="26" cy="26" r="24" fill="#fff0f0" stroke="#ef4444" strokeWidth="2" />
              <line x1="17" y1="17" x2="35" y2="35" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="35" y1="17" x2="17" y2="35" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium text-center text-rose-500">{message || 'Something went wrong'}</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// Polls an extension_scrape_jobs-backed job until it's done/error, same contract
// every job type (fast-mode search, update-labels, get-tracking) already uses.
async function pollExtensionJobUntilDone(jobId, { timeoutMs = 60_000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const pollRes = await ebayAPI.pollExtensionJob(jobId);
    if (pollRes?.data?.status === 'done') return { data: pollRes?.data?.data || null };
    if (pollRes?.data?.status === 'error') return { error: String(pollRes?.data?.error || 'Job failed') };
  }
  return { error: 'Timed out waiting for the extension' };
}

function TrackedRow({ row, isDark, onUpdated, imageUrl, title }) {
  const [sendingToEbay, setSendingToEbay] = useState(false);
  const [getTrackingModal, setGetTrackingModal] = useState(null); // { phase, message }
  const [updateLabelsModal, setUpdateLabelsModal] = useState(null); // { phase, message }
  const [gettingManualTracking, setGettingManualTracking] = useState(false);
  const [error, setError] = useState('');

  const handleGetTracking = async () => {
    setError('');
    setGetTrackingModal({ phase: 'loading', message: 'Opening the Amazon tracking page…' });
    try {
      const startRes = await ebayAPI.getTracking(row.ebayOrderId);
      const jobId = startRes?.data?.jobId;
      if (!jobId) throw new Error('Failed to start get-tracking');

      // Extension has to open a real Amazon tab and wait for it to render — give
      // this much longer than the ~20s used for the fast-mode search jobs.
      const { data: polled, error: pollFailure } = await pollExtensionJobUntilDone(jobId, { timeoutMs: 60_000 });
      if (pollFailure) throw new Error(pollFailure);

      if (polled?.status === 'not_shipped') {
        setGetTrackingModal({ phase: 'not_shipped', message: 'Not shipped yet' });
        setTimeout(() => setGetTrackingModal(null), 2000);
        return;
      }

      // polled is the normalized tracking row (spread alongside status: 'shipped')
      if (polled?.ebayOrderId) onUpdated(polled);
      setGetTrackingModal({ phase: 'success', message: 'Tracking updated' });
      setTimeout(() => setGetTrackingModal(null), 1400);

      if (polled?.aquilineTrackingNumber) {
        Swal.fire({
          title: 'Aquiline code',
          text: polled.aquilineTrackingNumber,
          icon: 'success',
          confirmButtonText: 'Copy',
        }).then((result) => {
          if (result.isConfirmed) {
            navigator.clipboard?.writeText(polled.aquilineTrackingNumber);
          }
        });
      }
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Failed to get tracking';
      setGetTrackingModal({ phase: 'error', message });
      setTimeout(() => setGetTrackingModal(null), 3000);
    }
  };

  // No extension round trip, no "is it actually shipped yet" check against Amazon's
  // page — just force Aquiline to assign/refresh a code right now, using whatever
  // ship-to/HTML is already on the tracking record. Synchronous (no job/poll needed).
  const handleGetManualTracking = async () => {
    setError('');
    setGettingManualTracking(true);
    try {
      const res = await ebayAPI.getManualTracking(row.ebayOrderId);
      const updated = res?.data?.tracking;
      if (updated) onUpdated(updated);

      if (updated?.aquilineTrackingNumber) {
        Swal.fire({
          title: 'Aquiline code',
          text: updated.aquilineTrackingNumber,
          icon: 'success',
          confirmButtonText: 'Copy',
        }).then((result) => {
          if (result.isConfirmed) {
            navigator.clipboard?.writeText(updated.aquilineTrackingNumber);
          }
        });
      } else {
        Swal.fire({ title: 'No Aquiline code returned', icon: 'warning' });
      }
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Failed to get manual tracking';
      setError(message);
      Swal.fire({ title: 'Failed to get manual tracking', text: message, icon: 'error' });
    } finally {
      setGettingManualTracking(false);
    }
  };

  const handleSendToEbay = async () => {
    setSendingToEbay(true);
    setError('');
    try {
      const res = await ebayAPI.uploadOrderTrackingToEbay(row.ebayOrderId, {});
      onUpdated(res?.data?.tracking);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to send to eBay');
    } finally {
      setSendingToEbay(false);
    }
  };

  const handleUpdateLabels = async () => {
    setError('');
    setUpdateLabelsModal({
      phase: 'loading',
      message: 'Updating labels… capturing the Amazon tracking page and syncing it to Aquiline.',
    });
    try {
      const startRes = await ebayAPI.updateLabels(row.ebayOrderId);
      const jobId = startRes?.data?.jobId;
      if (!jobId) throw new Error('Failed to start label update');

      // Extension has to open a real Amazon tab, wait for it to render, and scrape it —
      // give this much longer than the ~20s used for the fast-mode search jobs.
      const { data: polled, error: pollFailure } = await pollExtensionJobUntilDone(jobId, { timeoutMs: 60_000 });
      if (pollFailure) throw new Error(pollFailure);

      if (polled?.ebayOrderId) onUpdated(polled);
      setUpdateLabelsModal({ phase: 'success', message: 'Labels updated' });
      setTimeout(() => setUpdateLabelsModal(null), 1400);
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Failed to update labels';
      setUpdateLabelsModal({ phase: 'error', message });
      setTimeout(() => setUpdateLabelsModal(null), 3000);
    }
  };

  return (
    <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        <div className="flex items-center gap-3">
          <div
            className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border ${
              isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
            }`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={title || row.ebayOrderId} className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full w-full items-center justify-center text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No image
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{row.ebayOrderId}</div>
            {title && (
              <div className={`text-[10px] truncate max-w-[160px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {title}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.amazonOrderId || row.amazonTrackingNumber || '—'}</td>
      <td className="px-4 py-3">
        <FulfillmentStepper status={row.fulfillmentStatus} isDark={isDark} />
        {/* Aquiline number takes priority when both exist; otherwise show the real
            carrier tracking number "Get Tracking" captured directly (it only ever
            differs from the Amazon order id once that's actually happened). */}
        {(row.aquilineTrackingNumber || (row.trackingNumber && row.trackingNumber !== row.amazonOrderId)) && (
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {row.aquilineTrackingNumber || row.trackingNumber}
          </div>
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {row.ebayFulfillmentId ? 'Uploaded' : '—'}
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {fmtDate(row.updatedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {/* Once a tracking code has been obtained (fulfillmentStatus moves past
              "ordered") this must not show again — re-running "Get Tracking" is what
              caused a second, stale-slug row to get created for an order that already
              shipped. aquilineTrackingNumber alone isn't enough to gate on: a real
              carrier (USPS/UPS/...) captured directly off Amazon's delivery card never
              gets one. */}
          {row.amazonOrderId && row.fulfillmentStatus === 'ordered' && (
            <button
              type="button"
              onClick={handleGetTracking}
              disabled={!!getTrackingModal}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {getTrackingModal ? 'Getting…' : 'Get Tracking'}
            </button>
          )}
          {/* Manual override — skips the "is it actually shipped yet" check against
              Amazon's live page entirely and just force-assigns an Aquiline code right
              now. Not gated on fulfillmentStatus otherwise (it's an explicit escape
              hatch for when the automatic flow isn't cooperating), but once delivered
              there's nothing left to obtain. */}
          {row.amazonOrderId && row.fulfillmentStatus !== 'delivered' && (
            <button
              type="button"
              onClick={handleGetManualTracking}
              disabled={gettingManualTracking}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {gettingManualTracking ? 'Getting…' : 'Get Manual Tracking'}
            </button>
          )}
          {/* A real carrier (USPS/UPS/...) captured directly off Amazon's delivery
              card never gets an Aquiline number — it's usable for eBay on its own,
              so this can't gate on aquilineTrackingNumber alone. trackingNumber
              starts out as a placeholder equal to the Amazon order id right after
              matching (before any real tracking exists), so only count it once
              "Get Tracking" has actually replaced it with a real carrier number. */}
          {(row.aquilineTrackingNumber ||
            row.vdtrackNumber ||
            (row.trackingNumber && row.trackingNumber !== row.amazonOrderId)) &&
            !row.ebayFulfillmentId && (
            <button
              type="button"
              onClick={handleSendToEbay}
              disabled={sendingToEbay}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {sendingToEbay ? 'Sending…' : 'Send to eBay'}
            </button>
          )}
          {/* Aquiline-only — "Update Labels" refreshes an order's HTML on Aquiline's
              side, which only makes sense once the order actually exists there. Never
              show it for a real-carrier-direct shipment (no Aquiline order to refresh)
              to avoid ever calling this with a placeholder tracking number and
              clobbering the real carrier number already on the row. Also pointless
              once delivered — nothing left to refresh. */}
          {row.aquilineTrackingNumber && row.fulfillmentStatus !== 'delivered' && (
            <button
              type="button"
              onClick={handleUpdateLabels}
              disabled={!!updateLabelsModal}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Update Labels
            </button>
          )}
          {/* OrderDetailPage only renders with the full eBay order passed via router
              state (see OrdersPage's navigate(..., { state: { order } })) — this list
              only has the tracking row, not the full order, so send users to the Orders
              list to open the order rather than a dead-end deep link. */}
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-400"
          >
            <ExternalLink size={12} />
          </Link>
        </div>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      </td>
      {getTrackingModal && (
        <JobStatusModal phase={getTrackingModal.phase} message={getTrackingModal.message} isDark={isDark} />
      )}
      {updateLabelsModal && (
        <JobStatusModal phase={updateLabelsModal.phase} message={updateLabelsModal.message} isDark={isDark} />
      )}
    </tr>
  );
}

function UnmatchedRow({ item, isDark, onResolved, onDeleted }) {
  const [ebayOrderId, setEbayOrderId] = useState(item.candidateEbayOrderIds?.[0] || '');
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const resolve = async () => {
    if (!ebayOrderId.trim()) return;
    setResolving(true);
    setError('');
    try {
      await ebayAPI.resolveUnmatchedAmazonOrder(item.id, ebayOrderId.trim());
      onResolved(item.id);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove this Amazon order from your review queue?')) return;
    setDeleting(true);
    setError('');
    try {
      await ebayAPI.deleteUnmatchedAmazonOrder(item.id);
      onDeleted(item.id);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  return (
    <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        {item.amazonOrderLink ? (
          <a href={item.amazonOrderLink} target="_blank" rel="noreferrer" className="underline hover:text-indigo-400">
            {item.amazonOrderId}
          </a>
        ) : (
          item.amazonOrderId
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {[item.shipTo?.name, item.shipTo?.postalCode].filter(Boolean).join(' · ') || '—'}
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(item.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {Array.isArray(item.candidateEbayOrderIds) && item.candidateEbayOrderIds.length > 0 ? (
            <select
              value={ebayOrderId}
              onChange={(e) => setEbayOrderId(e.target.value)}
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              <option value="">Select order…</option>
              {item.candidateEbayOrderIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          ) : (
            <input
              value={ebayOrderId}
              onChange={(e) => setEbayOrderId(e.target.value)}
              placeholder="eBay order id"
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          )}
          <button
            type="button"
            onClick={resolve}
            disabled={resolving || !ebayOrderId.trim()}
            className="btn-primary text-xs px-3 py-1.5"
          >
            {resolving ? 'Linking…' : 'Link'}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            title="Remove from review queue"
            className={`p-1.5 rounded-lg border transition ${
              isDark ? 'border-slate-700 text-rose-400 hover:bg-rose-900/30' : 'border-slate-300 text-rose-500 hover:bg-rose-50'
            }`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      </td>
    </tr>
  );
}

// Sidebar for configuring the buyer-facing messages auto-sent when tracking is
// uploaded to eBay ("shipped") and when Amazon's own tracking page reports the
// package as delivered. Loads the user's saved templates (or the crafted defaults
// if they haven't customized one yet) and lets them edit + save either.
function MessageTemplatesSidebar({ isDark, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeMessageTab, setActiveMessageTab] = useState('shipped');
  const [defaults, setDefaults] = useState({ shipped: '', delivered: '' });
  const [shippedMessage, setShippedMessage] = useState('');
  const [deliveredMessage, setDeliveredMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await ebayAPI.getMessageTemplates();
        setShippedMessage(res?.data?.shippedMessage || '');
        setDeliveredMessage(res?.data?.deliveredMessage || '');
        setDefaults({
          shipped: res?.data?.defaultShippedMessage || '',
          delivered: res?.data?.defaultDeliveredMessage || '',
        });
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Failed to load message templates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await ebayAPI.saveMessageTemplates({ shippedMessage, deliveredMessage });
      setShippedMessage(res?.data?.shippedMessage || shippedMessage);
      setDeliveredMessage(res?.data?.deliveredMessage || deliveredMessage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save message templates');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = `block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`;
  const hintCls = `text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const textareaCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 ${
    isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
  }`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`h-full w-full max-w-md shadow-2xl border-l flex flex-col ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <MessageSquare size={16} />
            Buyer messages
          </h2>
          <button type="button" onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}>
            <X size={18} />
          </button>
        </div>

        <div className={`flex gap-1 px-5 pt-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => setActiveMessageTab('shipped')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeMessageTab === 'shipped'
                ? 'border-indigo-500 text-indigo-500'
                : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
            }`}
          >
            Shipping message
          </button>
          <button
            type="button"
            onClick={() => setActiveMessageTab('delivered')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeMessageTab === 'delivered'
                ? 'border-indigo-500 text-indigo-500'
                : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
            }`}
          >
            Delivery message
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Placeholders: <code>{'{buyerName}'}</code>, <code>{'{trackingNumber}'}</code>,{' '}
            <code>{'{orderNumber}'}</code> and <code>{'{storeName}'}</code> (your active eBay store) —
            all filled in automatically for each order.
          </p>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" size={22} />
            </div>
          ) : activeMessageTab === 'shipped' ? (
            <div>
              <label className={labelCls}>Sent when tracking is uploaded (shipped)</label>
              <textarea
                value={shippedMessage}
                onChange={(e) => setShippedMessage(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <div className="flex items-center justify-between">
                <p className={hintCls}>Sent once per order, right after tracking is sent to eBay.</p>
                <button
                  type="button"
                  onClick={() => setShippedMessage(defaults.shipped)}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-400 whitespace-nowrap ml-2"
                >
                  Reset to default
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Sent when Amazon reports delivered</label>
              <textarea
                value={deliveredMessage}
                onChange={(e) => setDeliveredMessage(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <div className="flex items-center justify-between">
                <p className={hintCls}>Sent once per order, detected automatically via "Update Labels".</p>
                <button
                  type="button"
                  onClick={() => setDeliveredMessage(defaults.delivered)}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-400 whitespace-nowrap ml-2"
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
          {saved && <p className="text-xs text-emerald-500">Saved.</p>}
        </div>

        <div className={`px-5 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="btn-primary w-full text-sm py-2"
          >
            {saving ? 'Saving…' : 'Save messages'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TrackingPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('tracked');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmatched, setUnmatched] = useState([]);
  const [unmatchedLoading, setUnmatchedLoading] = useState(true);
  const [deletingAllUnmatched, setDeletingAllUnmatched] = useState(false);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [ebayFilter, setEbayFilter] = useState('ALL');
  const [messageSidebarOpen, setMessageSidebarOpen] = useState(false);
  const [trackingCredits, setTrackingCredits] = useState(null); // { limit, used, remaining } | null
  const [orderMetaByEbayOrderId, setOrderMetaByEbayOrderId] = useState({}); // ebayOrderId -> { imageUrl, title }

  const loadTracked = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ebayAPI.listTracking();
      setRows(Array.isArray(res?.data?.tracking) ? res.data.tracking : []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load tracking records');
    } finally {
      setLoading(false);
    }
  };

  const loadUnmatched = async () => {
    setUnmatchedLoading(true);
    try {
      const res = await ebayAPI.listUnmatchedAmazonOrders();
      setUnmatched(Array.isArray(res?.data?.unmatched) ? res.data.unmatched : []);
    } catch {
      setUnmatched([]);
    } finally {
      setUnmatchedLoading(false);
    }
  };

  const loadEbayAccounts = async () => {
    try {
      const res = await ebayAPI.getStatus();
      const accounts = Array.isArray(res?.data?.ebayAccounts) ? res.data.ebayAccounts : [];
      setEbayAccounts(accounts);
      const activeId = res?.data?.activeEbayAccountId || null;
      if (activeId && accounts.some((a) => a.id === activeId)) {
        setEbayFilter(activeId);
      }
    } catch {
      setEbayAccounts([]);
    }
  };

  const loadTrackingCredits = async () => {
    try {
      const res = await settingsAPI.getLimits();
      const credits = res?.data?.trackingCredits;
      setTrackingCredits(credits ? { limit: credits.limit, used: credits.used, remaining: credits.remaining } : null);
    } catch {
      setTrackingCredits(null);
    }
  };

  // Same two-hop join OrdersPage uses: eBay order line items never carry an image, so
  // pull the (cached, same as Orders/Listings pages) orders + listings snapshots and
  // join order -> lineItem.legacyItemId -> listing image.
  const loadOrderImages = async () => {
    try {
      const [ordersRes, listingsRes] = await Promise.all([
        ebayAPI.getOrders(0, 200),
        ebayAPI.getListings(0, 200),
      ]);

      const listingImageById = new Map();
      const listings = Array.isArray(listingsRes?.data?.items) ? listingsRes.data.items : [];
      listings.forEach((listing) => {
        const listingId = resolveListingId(listing);
        if (!listingId || listingImageById.has(listingId)) return;
        const imageUrl = resolveListingImageUrl(listing);
        if (imageUrl) listingImageById.set(listingId, imageUrl);
      });

      const orders = Array.isArray(ordersRes?.data?.orders) ? ordersRes.data.orders : [];
      const meta = {};
      orders.forEach((order) => {
        const ebayOrderId = order?.orderId;
        if (!ebayOrderId) return;
        const legacyItemId = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
        meta[ebayOrderId] = {
          imageUrl: legacyItemId ? listingImageById.get(legacyItemId) || '' : '',
          title: order?.lineItems?.[0]?.title || '',
        };
      });
      setOrderMetaByEbayOrderId(meta);
    } catch {
      setOrderMetaByEbayOrderId({});
    }
  };

  useEffect(() => {
    loadTracked();
    loadUnmatched();
    loadEbayAccounts();
    loadTrackingCredits();
    loadOrderImages();
  }, []);

  const accountFilterOptions = ebayAccounts
    .map((a) => ({
      id: a.id,
      label: a.connectionName || a.username || a.profileUserId || 'eBay account',
    }))
    .filter((o) => o.id);

  // Rows created before this store-scoping feature shipped have no ebayAccountId yet —
  // always show them regardless of the selected store filter rather than hiding them.
  const visibleRows =
    ebayFilter === 'ALL' ? rows : rows.filter((r) => !r.ebayAccountId || r.ebayAccountId === ebayFilter);

  const handleResolved = (id) => {
    setUnmatched((prev) => prev.filter((u) => u.id !== id));
    loadTracked();
  };

  const handleUnmatchedDeleted = (id) => {
    setUnmatched((prev) => prev.filter((u) => u.id !== id));
  };

  const handleDeleteAllUnmatched = async () => {
    if (!unmatched.length) return;
    if (!window.confirm(`Remove all ${unmatched.length} item(s) from your review queue?`)) return;
    setDeletingAllUnmatched(true);
    try {
      await ebayAPI.deleteAllUnmatchedAmazonOrders();
      setUnmatched([]);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to delete all unmatched orders');
    } finally {
      setDeletingAllUnmatched(false);
    }
  };

  const handleRowUpdated = (updatedTracking) => {
    if (!updatedTracking) return;
    setRows((prev) => prev.map((r) => (r.id === updatedTracking.id ? updatedTracking : r)));
    // A "Get Tracking" run that went through Aquiline may have just spent credits.
    loadTrackingCredits();
  };

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="page-title flex items-center gap-2">
          <Truck size={18} />
          Tracking
        </h1>
        <div className="flex items-center gap-2">
          {trackingCredits && (
            <span
              className={`text-xs font-medium px-2.5 py-1.5 rounded-full border ${
                trackingCredits.limit === null
                  ? isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                  : trackingCredits.remaining <= 0
                    ? isDark ? 'bg-rose-900/40 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'
                    : trackingCredits.remaining <= 5
                      ? isDark ? 'bg-amber-900/40 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700'
                      : isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
              title="Spent 3 at a time whenever a fresh Aquiline tracking code is obtained — tracking captured directly from a real carrier (USPS/UPS/...) is always free."
            >
              {trackingCredits.limit === null ? 'Tracking credits: Unlimited' : `Tracking credits: ${trackingCredits.remaining} left`}
            </span>
          )}
          {accountFilterOptions.length > 0 && (
            <select
              value={ebayFilter}
              onChange={(e) => setEbayFilter(e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              <option value="ALL">All eBay stores</option>
              {accountFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setMessageSidebarOpen(true)}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <MessageSquare size={15} />
            Message
          </button>
        </div>
      </div>

      {messageSidebarOpen && (
        <MessageTemplatesSidebar isDark={isDark} onClose={() => setMessageSidebarOpen(false)} />
      )}

      <div className={`mb-6 rounded-xl p-1 border inline-flex gap-1 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setActiveTab('tracked')}
          className={`px-3 py-2 text-sm rounded-lg transition ${activeTab === 'tracked' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Tracked Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('unmatched')}
          className={`px-3 py-2 text-sm rounded-lg transition inline-flex items-center gap-1.5 ${activeTab === 'unmatched' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {unmatched.length > 0 && <AlertTriangle size={13} />}
          Needs Review{unmatched.length > 0 ? ` (${unmatched.length})` : ''}
        </button>
      </div>

      {error && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isDark ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
          {error}
        </div>
      )}

      {activeTab === 'tracked' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  {['eBay Order', 'Amazon Order ID', 'Status', 'Uploaded to eBay', 'Updated', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {rows.length === 0 ? 'No tracked orders yet.' : 'No tracked orders for this eBay store.'}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const meta = orderMetaByEbayOrderId[row.ebayOrderId];
                    return (
                      <TrackedRow
                        key={row.id}
                        row={row}
                        isDark={isDark}
                        onUpdated={handleRowUpdated}
                        imageUrl={meta?.imageUrl}
                        title={meta?.title}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'unmatched' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
          {unmatched.length > 0 && (
            <div className={`flex justify-end px-4 py-2.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={handleDeleteAllUnmatched}
                disabled={deletingAllUnmatched}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-400 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deletingAllUnmatched ? 'Deleting…' : 'Delete all'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  {['Amazon Order ID', 'Ship-to', 'Observed', 'Link to eBay order'].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {unmatchedLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                    </td>
                  </tr>
                ) : unmatched.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Nothing needs review — every observed Amazon order has been matched.
                    </td>
                  </tr>
                ) : (
                  unmatched.map((item) => (
                    <UnmatchedRow key={item.id} item={item} isDark={isDark} onResolved={handleResolved} onDeleted={handleUnmatchedDeleted} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
