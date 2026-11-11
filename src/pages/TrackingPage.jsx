import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Truck, Loader2, ExternalLink, AlertTriangle, MessageSquare, X, Trash2, Search, Copy, Pencil, Smartphone, ChevronLeft, ChevronRight,
  Check, ImageOff, MoreHorizontal, RefreshCcw, UploadCloud, Zap, Coins, Info, Store, PackageOpen, CalendarDays,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { ebayAPI, settingsAPI, API_BASE_URL } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import TutorialVideoButton from '../components/TutorialVideoButton';

// Amazon's tracking-page URL structure — mirrors buildAmazonTrackingUrl in
// backend-for-server/src/routes/ebay.js and extension/background.js. Always this
// one shape; the old "ship-track" redirect page is retired.
// The page 404s without an itemId param — but doesn't actually validate it against
// the order, so a fixed placeholder works for every order; only orderId matters.
const AMAZON_TRACKING_URL_PLACEHOLDER_ITEM_ID = 'jmslkuiptjosvop';
function buildAmazonTrackingUrl(amazonOrderId) {
  const params = new URLSearchParams({
    itemId: AMAZON_TRACKING_URL_PLACEHOLDER_ITEM_ID,
    ref: 'ppx_yo2ov_dt_b_fed_track_package',
    orderId: String(amazonOrderId || ''),
    _encoding: 'UTF8',
  });
  return `https://www.amazon.com/progress-tracker/package?${params.toString()}`;
}

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

// The mobile "Checkila" bookmarklet — a JS snippet bookmarked on a phone that,
// tapped on an Amazon order's "Track package" page, sends that page's HTML straight
// to POST /ebay/amazon-order-observed (the exact same pipeline the desktop Chrome
// extension already uses, see extension/amazon_update_tracking_button.js and
// resolveMobileTrackingAuth in backend routes/ebay.js). This is the only way to get
// that "one tap, tracking updates automatically" flow on a phone, since a mobile
// browser can't run a Chrome extension at all.
//
// Kept deliberately plain ASCII (no smart quotes/diacritics/checkmarks) in every
// string literal — this text round-trips through a phone's bookmark-edit URL field,
// which is exactly the kind of place non-ASCII characters are most likely to get
// silently mangled by some keyboard/app along the way.
function buildCheckilaBookmarklet(key) {
  const apiBase = String(API_BASE_URL || '').replace(/\/+$/, '');
  const src = `(function(){var K='${key}';var H='${apiBase}';if(!/amazon\\./.test(location.hostname)){alert('Checkila: this only works on an Amazon page.');return;}var b=document.createElement('div');b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#4f46e5;color:#fff;font:600 15px/1.45 -apple-system,Segoe UI,Arial,sans-serif;padding:14px 16px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.25)';b.textContent='Checkila: sending...';document.body.appendChild(b);var t=document.body.innerText||'';var id=(location.href.match(/\\d{3}-\\d{7}-\\d{7}/)||t.match(/\\d{3}-\\d{7}-\\d{7}/)||[])[0]||'';var p=JSON.stringify({amazonOrderId:id,orderLink:location.href.slice(0,600),html:document.documentElement.outerHTML.slice(0,1800000)});var u=H+'/ebay/amazon-order-observed?token='+K;function done(ok,m){b.style.background=ok?'#16a34a':'#dc2626';b.textContent='Checkila: '+m;setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b);},8000);}function viaForm(){var f=document.createElement('form');f.method='POST';f.action=u;f.target='_blank';var a=document.createElement('input');a.type='hidden';a.name='payload';a.value=p;f.appendChild(a);document.body.appendChild(f);f.submit();document.body.removeChild(f);done(true,'sent - check the new tab');}try{fetch(u,{method:'POST',headers:{'Content-Type':'text/plain'},body:p}).then(function(r){return r.json();}).then(function(d){done(Boolean(d&&d.success),(d&&d.matched)?'tracking updated!':(d&&d.success?'received, no exact order match yet':'failed - try again'));}).catch(viaForm);}catch(e){viaForm();}})();`;
  return `javascript:${src}`;
}

// GET /settings/amazon-tracking-key / POST .../generate — see settings.js. One
// lifetime key per user; regenerating replaces it outright (old bookmarklets start
// getting 401s, exactly like rotating any other leaked credential should behave).
function MobileTrackerModal({ isDark, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [keyValue, setKeyValue] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsAPI.getAmazonTrackingKey();
        if (!cancelled) setKeyValue(res?.data?.key || null);
      } catch {
        if (!cancelled) setError(t('trackingMobileTracker.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (generating) return;
    if (keyValue && !window.confirm(t('trackingMobileTracker.regenerateConfirm'))) {
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await settingsAPI.generateAmazonTrackingKey();
      setKeyValue(res?.data?.key || null);
      setCopied(false);
    } catch {
      setError(t('trackingMobileTracker.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const bookmarklet = keyValue ? buildCheckilaBookmarklet(keyValue) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can be unavailable (non-HTTPS, older browser) — the
      // textarea itself is still selectable/copyable by hand as a fallback.
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className={`rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 border max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <Smartphone size={18} /> {t('trackingMobileTracker.modalTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}
          >
            <X size={18} />
          </button>
        </div>

        <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('trackingMobileTracker.description')}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-rose-500 mb-3">{error}</p>}

            {!keyValue ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-60"
              >
                {generating ? t('trackingMobileTracker.generating') : t('trackingMobileTracker.generateButton')}
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('trackingMobileTracker.step1Label')}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-xs font-medium text-indigo-500 hover:text-indigo-400 inline-flex items-center gap-1"
                    >
                      <Copy size={12} /> {copied ? t('trackingMobileTracker.copied') : t('trackingMobileTracker.copyCode')}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={bookmarklet}
                    onFocus={(e) => e.target.select()}
                    rows={4}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-mono resize-none ${
                      isDark ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  />
                </div>

                <div className={`text-sm space-y-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <p>
                    <strong>{t('trackingMobileTracker.step2Label')}</strong> {t('trackingMobileTracker.step2Body')}
                  </p>
                  <p>
                    <strong>{t('trackingMobileTracker.step3Label')}</strong> {t('trackingMobileTracker.step3Body')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-secondary w-full py-2 text-xs disabled:opacity-60"
                >
                  {generating ? t('trackingMobileTracker.regenerating') : t('trackingMobileTracker.regenerateButton')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const CONVERT_TRACKING_CARRIERS = ['FEDEX', 'UPS', 'USPS'];

// "Convert tracking code" — the seller already has a real carrier tracking number in
// hand (not scraped off Amazon) and wants it turned into an Aquiline code. Unlike
// "Get Tracking"/"Update Labels" this is synchronous (no extension job/poll — the
// backend calls Aquiline directly) and, once submitted, deliberately does NOT push
// to eBay itself — the code is just shown here for the seller to review; "Send to
// eBay" (already on the row) is the separate, explicit action that uploads it.
function ConvertTrackingModal({ isDark, onClose, onSubmit }) {
  const [carrier, setCarrier] = useState(CONVERT_TRACKING_CARRIERS[0]);
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trackingCode.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const updated = await onSubmit({ carrier, trackingCode: trackingCode.trim() });
      setResult(updated);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to convert tracking code');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className={`rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Convert tracking code
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}
          >
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className={`block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Carrier</span>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {CONVERT_TRACKING_CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={`block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tracking code</span>
              <input
                autoFocus
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="e.g. 794612345678"
                className={`w-full rounded-lg border px-3 py-2 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </label>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary text-sm px-3 py-1.5">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !trackingCode.trim()}
                className="btn-primary text-sm px-3 py-1.5"
              >
                {loading ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Aquiline code obtained:</p>
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 font-mono text-sm ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <span>{result.aquilineTrackingNumber || '—'}</span>
              {result.aquilineTrackingNumber && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(result.aquilineTrackingNumber)}
                  className={isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}
                  title="Copy"
                >
                  <Copy size={14} />
                </button>
              )}
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Not sent to eBay yet — use "Send to eBay" on this row when you're ready.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="btn-secondary text-sm px-3 py-1.5">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// The "Amazon · change" control — lets the seller pin the exact Amazon tracking URL
// for one order. Once set, every navigation to Amazon for it (this order-number
// link, Update Labels, Get Tracking, the automatic checks) uses it verbatim instead
// of the auto-built tracking-page URL. Submitting an empty field clears the override.
function AmazonLinkModal({ isDark, currentUrl, onClose, onSubmit }) {
  const [url, setUrl] = useState(currentUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(url.trim());
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save the Amazon tracking link');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className={`rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 border ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Amazon tracking link
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className={`block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Amazon tracking URL
            </span>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.com/progress-tracker/package?..."
              className={`w-full rounded-lg border px-3 py-2 ${
                isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <span className={`block mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Leave empty to go back to the automatically built link.
            </span>
          </label>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm px-3 py-1.5">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-sm px-3 py-1.5">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
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

function TrackedRow({ row, isDark, onUpdated, onDeleted, imageUrl, title, buyerUsername, shipToFullName }) {
  const { t } = useTranslation();
  const [sendingToEbay, setSendingToEbay] = useState(false);
  const [getTrackingModal, setGetTrackingModal] = useState(null); // { phase, message }
  const [updateLabelsModal, setUpdateLabelsModal] = useState(null); // { phase, message }
  const [gettingManualTracking, setGettingManualTracking] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showAmazonLinkModal, setShowAmazonLinkModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleConvertTrackingCode = async ({ carrier, trackingCode }) => {
    const res = await ebayAPI.convertTrackingCode(row.ebayOrderId, { carrier, trackingCode });
    const updated = res?.data?.tracking;
    if (updated) onUpdated(updated);
    return updated;
  };

  const handleSetAmazonTrackingLink = async (amazonTrackingUrl) => {
    const res = await ebayAPI.setAmazonTrackingLink(row.ebayOrderId, amazonTrackingUrl);
    const updated = res?.data?.tracking;
    if (updated) onUpdated(updated);
    return updated;
  };

  // Offered at every fulfillment stage. The backend also removes every other
  // tracking row and unmatched-queue entry with the same Amazon order number.
  const handleDeleteTracking = async () => {
    if (deleting) return;
    const confirmText = row.amazonOrderId
      ? `Remove tracking for order ${row.ebayOrderId}? All tracking and unmatched records with Amazon order ${row.amazonOrderId} will also be removed. This can't be undone.`
      : `Remove tracking for order ${row.ebayOrderId}? This can't be undone.`;
    if (!window.confirm(confirmText)) return;
    setDeleting(true);
    setError('');
    try {
      const res = await ebayAPI.deleteOrderTracking(row.ebayOrderId);
      onDeleted?.(row.id, res?.data?.amazonOrderId || row.amazonOrderId || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to delete tracking');
      setDeleting(false);
    }
  };

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

  const [copied, setCopied] = useState('');
  const copyValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((cur) => (cur === value ? '' : cur)), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const secondaryBtn = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50 ${
    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
  }`;
  const primaryBtn = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50';

  // Which actions apply to this row — the same conditions as before, only grouped.
  const canGetTracking = Boolean(row.amazonOrderId) && row.fulfillmentStatus === 'ordered';
  const hasCode = Boolean(row.aquilineTrackingNumber || row.vdtrackNumber || (row.trackingNumber && row.trackingNumber !== row.amazonOrderId));
  const canSendToEbay = hasCode && !row.ebayFulfillmentId;
  const canUpdateLabels = Boolean(row.aquilineTrackingNumber) && !row.skipAmazonTrackingCheck;
  const canConvert = row.fulfillmentStatus !== 'delivered';
  const realCarrierNumber = !row.aquilineTrackingNumber && row.trackingNumber && row.trackingNumber !== row.amazonOrderId ? row.trackingNumber : null;

  const menuItems = [
    canGetTracking && { key: 'manual', label: gettingManualTracking ? 'Getting…' : 'Get Manual Tracking', icon: Zap, onClick: handleGetManualTracking, disabled: gettingManualTracking },
    canConvert && { key: 'convert', label: 'Convert tracking code', icon: RefreshCcw, onClick: () => setShowConvertModal(true) },
    row.amazonOrderId && { key: 'amazon', label: row.manualAmazonTrackingUrl ? 'Edit Amazon tracking link' : 'Set Amazon tracking link', icon: Pencil, onClick: () => setShowAmazonLinkModal(true) },
    { key: 'orders', label: 'Open Orders page', icon: ExternalLink, to: '/orders' },
    { key: 'delete', label: deleting ? 'Deleting…' : 'Delete tracking', icon: Trash2, onClick: handleDeleteTracking, danger: true, disabled: deleting },
  ].filter(Boolean);

  const codeLink = (code, tone = 'indigo', titleText) => (
    <span className="inline-flex items-center gap-1">
      <a
        href={`https://aquiline-tracking.com/app/track/${encodeURIComponent(code)}`}
        target="_blank"
        rel="noreferrer"
        title={titleText || 'Open on Aquiline'}
        className={`font-mono text-xs hover:underline ${
          tone === 'emerald'
            ? isDark ? 'text-emerald-300' : 'text-emerald-600'
            : isDark ? 'text-indigo-300' : 'text-indigo-600'
        }`}
      >
        {code}
      </a>
      <button type="button" onClick={() => copyValue(code)} title={copied === code ? 'Copied' : 'Copy'} className={`rounded p-0.5 ${faint} hover:opacity-80`}>
        {copied === code ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      </button>
    </span>
  );

  return (
    <tr className={`group align-middle transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/70'}`}>
      {/* eBay order */}
      <td className="px-4 py-3">
        <div className="flex min-w-[240px] max-w-[340px] items-center gap-3">
          <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
            {imageUrl ? (
              <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className={`flex h-full w-full items-center justify-center ${faint}`}><ImageOff size={16} /></span>
            )}
          </div>
          <div className="min-w-0">
            {title && <p className={`line-clamp-2 text-sm font-medium leading-snug ${strong}`} title={title}>{title}</p>}
            <p className={`mt-0.5 font-mono text-xs ${title ? muted : strong}`}>{row.ebayOrderId}</p>
          </div>
        </div>
      </td>

      {/* Customer: delivery name (who it goes to) + eBay username (account) */}
      <td className="px-4 py-3">
        <div className="min-w-[130px] max-w-[200px]">
          <p className={`truncate text-sm font-medium ${strong}`}>{shipToFullName || buyerUsername || '—'}</p>
          {shipToFullName && buyerUsername && <p className={`truncate text-xs ${muted}`}>@{buyerUsername}</p>}
        </div>
      </td>

      {/* Amazon order */}
      <td className="px-4 py-3">
        {row.amazonOrderId ? (
          <div className="flex flex-col items-start gap-0.5">
            <a
              href={row.manualAmazonTrackingUrl || buildAmazonTrackingUrl(row.amazonOrderId)}
              target="_blank"
              rel="noreferrer"
              title="Open Amazon tracking page"
              className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs hover:underline ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}
            >
              {row.amazonOrderId}
              <ExternalLink size={11} />
            </a>
            {row.manualAmazonTrackingUrl && <span className={`text-[11px] ${faint}`}>Custom link</span>}
          </div>
        ) : (
          <span className={`text-xs ${faint}`}>{row.amazonTrackingNumber || '—'}</span>
        )}
      </td>

      {/* Tracking: stage + code(s) + delivery problem */}
      <td className="px-4 py-3">
        <div className="flex min-w-[190px] flex-col items-start gap-1">
          <FulfillmentStepper status={row.fulfillmentStatus} isDark={isDark} />
          {row.aquilineTrackingNumber
            ? codeLink(row.aquilineTrackingNumber)
            : realCarrierNumber && (
                <span className="inline-flex items-center gap-1">
                  {row.slug && (
                    <span className={`rounded px-1 py-px text-[10px] font-bold uppercase ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{row.slug}</span>
                  )}
                  <span className={`font-mono text-xs ${muted}`}>{realCarrierNumber}</span>
                  <button type="button" onClick={() => copyValue(realCarrierNumber)} title={copied === realCarrierNumber ? 'Copied' : 'Copy'} className={`rounded p-0.5 ${faint} hover:opacity-80`}>
                    {copied === realCarrierNumber ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                </span>
              )}
          {/* "Convert tracking code" on an order that already had a code makes a
              separate Aquiline order — shown under the original, not replacing it. */}
          {row.manualAquilineTrackingNumber && codeLink(row.manualAquilineTrackingNumber, 'emerald', 'Manually converted tracking code')}
          {/* Amazon's tracking page reported a delivery problem (backend utils/deliveryIssue.js). */}
          {row.deliveryIssue && row.fulfillmentStatus !== 'delivered' && (
            <span
              title={row.deliveryIssue.message || ''}
              className={`mt-0.5 inline-flex max-w-[240px] items-start gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold leading-snug ${
                row.deliveryIssue.type === 'delay'
                  ? isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                  : isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
              }`}
            >
              <AlertTriangle size={12} className="mt-px shrink-0" />
              <span>
                {t(`trackingDeliveryIssue.${row.deliveryIssue.type}`, { defaultValue: t('trackingDeliveryIssue.delay') })}
                {row.deliveryIssue.estimatedDate ? ` · ${t('trackingDeliveryIssue.newDate', { date: row.deliveryIssue.estimatedDate })}` : ''}
              </span>
            </span>
          )}
        </div>
      </td>

      {/* eBay upload */}
      <td className="px-4 py-3">
        {row.ebayFulfillmentId ? (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
            <Check size={12} /> On eBay
          </span>
        ) : canSendToEbay ? (
          <button type="button" onClick={handleSendToEbay} disabled={sendingToEbay} className={`${secondaryBtn} ${isDark ? '!border-indigo-500/40 !text-indigo-300' : '!border-indigo-200 !text-indigo-700'}`}>
            {sendingToEbay ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
            {sendingToEbay ? 'Sending…' : 'Send to eBay'}
          </button>
        ) : (
          <span className={`text-xs ${faint}`}>Not yet</span>
        )}
      </td>

      {/* Updated */}
      <td className={`whitespace-nowrap px-4 py-3 text-xs ${muted}`} title={fmtDate(row.updatedAt)}>
        {fmtRelative(row.updatedAt)}
      </td>

      {/* Actions: one primary step + overflow menu */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {canGetTracking && (
            <button type="button" onClick={handleGetTracking} disabled={!!getTrackingModal} className={primaryBtn}>
              {getTrackingModal ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              {getTrackingModal ? 'Getting…' : 'Get Tracking'}
            </button>
          )}
          {canUpdateLabels && (
            <button type="button" onClick={handleUpdateLabels} disabled={!!updateLabelsModal} className={secondaryBtn}>
              <RefreshCcw size={13} />
              Update Labels
            </button>
          )}
          <RowMenu items={menuItems} isDark={isDark} />
        </div>
        {error && <p className="mt-1 max-w-[260px] text-right text-xs text-rose-500">{error}</p>}
      </td>
      {getTrackingModal && (
        <JobStatusModal phase={getTrackingModal.phase} message={getTrackingModal.message} isDark={isDark} />
      )}
      {updateLabelsModal && (
        <JobStatusModal phase={updateLabelsModal.phase} message={updateLabelsModal.message} isDark={isDark} />
      )}
      {showConvertModal && (
        <ConvertTrackingModal
          isDark={isDark}
          onClose={() => setShowConvertModal(false)}
          onSubmit={handleConvertTrackingCode}
        />
      )}
      {showAmazonLinkModal && (
        <AmazonLinkModal
          isDark={isDark}
          currentUrl={row.manualAmazonTrackingUrl}
          onClose={() => setShowAmazonLinkModal(false)}
          onSubmit={handleSetAmazonTrackingLink}
        />
      )}
    </tr>
  );
}

// "3h ago" style time for the Updated column (full date stays in the tooltip).
function fmtRelative(iso) {
  if (!iso) return '—';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

// "⋯" row menu. Rendered in a portal with fixed positioning so the table's
// horizontal scroll container never clips it.
function RowMenu({ items, isDark }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef(null);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 220;
      const estimatedHeight = items.length * 36 + 12;
      const top = rect.bottom + estimatedHeight > window.innerHeight ? rect.top - estimatedHeight - 4 : rect.bottom + 4;
      setPos({ top: Math.max(8, top), left: Math.max(8, rect.right - width) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
          open
            ? isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'
            : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{ top: pos.top, left: pos.left, width: 220 }}
              className={`fixed z-50 overflow-hidden rounded-xl border py-1 shadow-xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
            >
              {items.map((item) => {
                const Icon = item.icon;
                const cls = `flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                  item.danger
                    ? isDark ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
                    : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                }`;
                const content = (
                  <>
                    <Icon size={15} className="shrink-0 opacity-80" />
                    {item.label}
                  </>
                );
                return item.to ? (
                  <Link key={item.key} to={item.to} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={cls}
                    onClick={() => { setOpen(false); item.onClick(); }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function UnmatchedRow({ item, isDark, onResolved, onDeleted, orderMetaByEbayOrderId }) {
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
              {/* Two candidates that share the same address (this row's whole reason
                  for existing) used to be indistinguishable here — both just showed
                  their raw order id. Label by customer instead; the option's value
                  (what actually gets submitted) stays the order id either way. */}
              {item.candidateEbayOrderIds.map((id) => {
                const meta = orderMetaByEbayOrderId?.[id];
                const customerLabel = meta?.shipToFullName || meta?.buyerUsername || '';
                return (
                  <option key={id} value={id}>
                    {customerLabel ? `${customerLabel} — ${id}` : id}
                  </option>
                );
              })}
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

// Small on/off pill switch — used per message tab so the seller can turn any one of
// the three automatic buyer messages (ordered/shipped/delivered) off for this specific
// eBay store without losing the drafted template text underneath it.
function ToggleSwitch({ checked, onChange, isDark, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      {label && (
        <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      )}
    </label>
  );
}

// Sidebar for configuring the buyer-facing messages auto-sent when tracking is
// uploaded to eBay ("shipped") and when Amazon's own tracking page reports the
// package as delivered. Each connected eBay account (store) has its own pair of
// messages — this always edits whichever store is currently active (ebayAccountId),
// and reloads automatically when the user switches stores on the page (or while this
// sidebar is open). Loads that store's saved templates (or the crafted defaults if
// it hasn't customized one yet) and lets them edit + save either.
function MessageTemplatesSidebar({ isDark, onClose, ebayAccountId, accountLabel }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeMessageTab, setActiveMessageTab] = useState('ordered');
  const [defaults, setDefaults] = useState({ ordered: '', shipped: '', delivered: '' });
  const [orderedMessage, setOrderedMessage] = useState('');
  const [shippedMessage, setShippedMessage] = useState('');
  const [deliveredMessage, setDeliveredMessage] = useState('');
  const [orderedEnabled, setOrderedEnabled] = useState(true);
  const [shippedEnabled, setShippedEnabled] = useState(true);
  const [deliveredEnabled, setDeliveredEnabled] = useState(true);
  const [resolvedAccountId, setResolvedAccountId] = useState(ebayAccountId || null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await ebayAPI.getMessageTemplates(ebayAccountId);
        setOrderedMessage(res?.data?.orderedMessage || '');
        setShippedMessage(res?.data?.shippedMessage || '');
        setDeliveredMessage(res?.data?.deliveredMessage || '');
        setOrderedEnabled(res?.data?.orderedEnabled !== false);
        setShippedEnabled(res?.data?.shippedEnabled !== false);
        setDeliveredEnabled(res?.data?.deliveredEnabled !== false);
        setDefaults({
          ordered: res?.data?.defaultOrderedMessage || '',
          shipped: res?.data?.defaultShippedMessage || '',
          delivered: res?.data?.defaultDeliveredMessage || '',
        });
        // The backend resolves its own active account when none is passed (e.g. the
        // page's store filter is "All eBay stores") — keep whatever it settled on so
        // Save writes back to that same account instead of guessing again.
        setResolvedAccountId(res?.data?.ebayAccountId || ebayAccountId || null);
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Failed to load message templates');
      } finally {
        setLoading(false);
      }
    })();
  }, [ebayAccountId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await ebayAPI.saveMessageTemplates({
        orderedMessage,
        shippedMessage,
        deliveredMessage,
        orderedEnabled,
        shippedEnabled,
        deliveredEnabled,
        ebayAccountId: resolvedAccountId,
      });
      setOrderedMessage(res?.data?.orderedMessage || orderedMessage);
      setShippedMessage(res?.data?.shippedMessage || shippedMessage);
      setDeliveredMessage(res?.data?.deliveredMessage || deliveredMessage);
      setOrderedEnabled(res?.data?.orderedEnabled !== false);
      setShippedEnabled(res?.data?.shippedEnabled !== false);
      setDeliveredEnabled(res?.data?.deliveredEnabled !== false);
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
        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <MessageSquare size={16} />
              Buyer messages
            </h2>
            <button type="button" onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}>
              <X size={18} />
            </button>
          </div>
          {accountLabel && (
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Editing messages for <span className="font-medium">{accountLabel}</span>
            </p>
          )}
        </div>

        <div className={`flex gap-1 px-5 pt-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => setActiveMessageTab('ordered')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeMessageTab === 'ordered'
                ? 'border-indigo-500 text-indigo-500'
                : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
            }`}
          >
            Thank-you message
          </button>
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
          ) : activeMessageTab === 'ordered' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls.replace('mb-1.5', '')}>Sent when the order is matched to tracking</label>
                <ToggleSwitch
                  checked={orderedEnabled}
                  onChange={setOrderedEnabled}
                  isDark={isDark}
                  label={orderedEnabled ? 'Enabled' : 'Disabled'}
                />
              </div>
              <textarea
                value={orderedMessage}
                onChange={(e) => setOrderedMessage(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <div className="flex items-center justify-between">
                <p className={hintCls}>
                  Sent once per order, right when the Amazon purchase is matched to this eBay order.
                </p>
                <button
                  type="button"
                  onClick={() => setOrderedMessage(defaults.ordered)}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-400 whitespace-nowrap ml-2"
                >
                  Reset to default
                </button>
              </div>
            </div>
          ) : activeMessageTab === 'shipped' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls.replace('mb-1.5', '')}>Sent when tracking is uploaded (shipped)</label>
                <ToggleSwitch
                  checked={shippedEnabled}
                  onChange={setShippedEnabled}
                  isDark={isDark}
                  label={shippedEnabled ? 'Enabled' : 'Disabled'}
                />
              </div>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls.replace('mb-1.5', '')}>Sent when Amazon reports delivered</label>
                <ToggleSwitch
                  checked={deliveredEnabled}
                  onChange={setDeliveredEnabled}
                  isDark={isDark}
                  label={deliveredEnabled ? 'Enabled' : 'Disabled'}
                />
              </div>
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('tracked');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmatched, setUnmatched] = useState([]);
  const [unmatchedLoading, setUnmatchedLoading] = useState(true);
  const [deletingAllUnmatched, setDeletingAllUnmatched] = useState(false);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [ebayFilter, setEbayFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [messageSidebarOpen, setMessageSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingCredits, setTrackingCredits] = useState(null); // { limit, used, remaining } | null
  const [orderMetaByEbayOrderId, setOrderMetaByEbayOrderId] = useState({}); // ebayOrderId -> { imageUrl, title }
  const [showMobileTracker, setShowMobileTracker] = useState(false);
  // "Change only TBA": only Amazon TBA codes go through Aquiline; USPS/UPS/FedEx
  // numbers are posted to eBay as-is (backend utils/directCarrier.js).
  const [tbaOnly, setTbaOnly] = useState(false);
  const [tbaOnlySaving, setTbaOnlySaving] = useState(false);

  useEffect(() => {
    ebayAPI
      .getTrackingSettings()
      .then((res) => setTbaOnly(Boolean(res?.data?.tbaOnly)))
      .catch(() => {});
  }, []);

  const handleTbaOnlyChange = async (next) => {
    setTbaOnly(next);
    setTbaOnlySaving(true);
    try {
      await ebayAPI.updateTrackingSettings({ tbaOnly: next });
    } catch (err) {
      setTbaOnly(!next);
      setError(err?.response?.data?.error || err.message || 'Failed to save tracking settings');
    } finally {
      setTbaOnlySaving(false);
    }
  };

  // 2-week windows (backend GET /ebay/tracking?period=N): 0 = last 14 days,
  // 1 = the 14 days before that, ... Filters and search apply within the window.
  const [period, setPeriod] = useState(0);
  const [periodInfo, setPeriodInfo] = useState({ hasOlder: false, rangeFrom: null, rangeTo: null });

  const loadTracked = async (targetPeriod = period) => {
    setLoading(true);
    setError('');
    try {
      const res = await ebayAPI.listTracking({ period: targetPeriod });
      setRows(Array.isArray(res?.data?.tracking) ? res.data.tracking : []);
      setPeriodInfo({
        hasOlder: Boolean(res?.data?.hasOlder),
        rangeFrom: res?.data?.rangeFrom || null,
        rangeTo: res?.data?.rangeTo || null,
      });
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

  // Picking a store here doesn't just filter the list — it also switches the
  // system's active eBay account, same action Settings page's account switcher
  // performs (ebayAPI.setActiveAccount), so every other page's "active account"
  // stays in sync with whatever store the user is looking at here. "All eBay
  // stores" is just a view filter, not a real account, so it doesn't switch anything.
  const handleEbayFilterChange = async (value) => {
    setEbayFilter(value);
    if (value === 'ALL') return;
    try {
      await ebayAPI.setActiveAccount(value);
      window.dispatchEvent(new Event('ebay:updated'));
      // Orders/listings (used for the product-image column) are fetched against
      // whichever account is active — refresh them for the newly-active store.
      loadOrderImages();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to switch active eBay account');
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
          // Buyer identity (eBay username) vs. the delivery address's actual
          // name/surname — these commonly differ, which is exactly what makes
          // picking between two same-address candidates in "Needs Review" hard
          // without both shown.
          buyerUsername: String(order?.buyer?.username || '').trim(),
          shipToFullName: String(order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName || '').trim(),
        };
      });
      setOrderMetaByEbayOrderId(meta);
    } catch {
      setOrderMetaByEbayOrderId({});
    }
  };

  const goToPeriod = (next) => {
    if (next < 0 || next === period) return;
    setPeriod(next);
    loadTracked(next);
  };

  const formatPeriodDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const periodLabel = periodInfo.rangeFrom
    ? `${formatPeriodDate(periodInfo.rangeFrom)} – ${periodInfo.rangeTo ? formatPeriodDate(periodInfo.rangeTo) : 'Today'}`
    : '';

  useEffect(() => {
    loadTracked(0);
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
  const storeFilteredRows =
    ebayFilter === 'ALL' ? rows : rows.filter((r) => !r.ebayAccountId || r.ebayAccountId === ebayFilter);

  const statusFilteredRows =
    statusFilter === 'ALL'
      ? storeFilteredRows
      : storeFilteredRows.filter((r) => (r.fulfillmentStatus || 'ordered') === statusFilter);

  // Backend already returns rows ordered by created_at DESC — re-sort defensively here
  // too so the newest-first order holds even after row updates get merged in locally.
  const sortedRows = [...statusFilteredRows].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  // Single search box across buyer name, eBay order id, tracking number, and Amazon
  // order id — buyer name isn't on the tracking row itself, it comes from the same
  // orderMetaByEbayOrderId lookup the "Customer" column uses.
  const searchTerm = searchQuery.trim().toLowerCase();
  const visibleRows = !searchTerm
    ? sortedRows
    : sortedRows.filter((row) => {
        const meta = orderMetaByEbayOrderId[row.ebayOrderId];
        const haystack = [
          meta?.shipToFullName,
          meta?.buyerUsername,
          row.ebayOrderId,
          row.orderNumber,
          row.amazonOrderId,
          row.aquilineTrackingNumber,
          row.vdtrackNumber,
          row.trackingNumber,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return haystack.some((v) => v.includes(searchTerm));
      });

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

  const handleRowDeleted = (rowId, amazonOrderId) => {
    const amazonId = String(amazonOrderId || '').trim();
    setRows((prev) =>
      prev.filter((r) => r.id !== rowId && !(amazonId && String(r.amazonOrderId || '').trim() === amazonId))
    );
    if (amazonId) {
      setUnmatched((prev) => prev.filter((u) => String(u.amazonOrderId || '').trim() !== amazonId));
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const fieldCls = `rounded-lg border text-sm outline-none transition focus:ring-2 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/30'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-100'
  }`;
  const headerBtn = `inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  }`;

  // Status tabs count within the selected store (and loaded 2-week window).
  const statusCounts = storeFilteredRows.reduce(
    (acc, r) => {
      const s = r.fulfillmentStatus || 'ordered';
      if (acc[s] !== undefined) acc[s] += 1;
      return acc;
    },
    { ordered: 0, shipped: 0, delivered: 0 }
  );
  const issueCount = storeFilteredRows.filter((r) => r.deliveryIssue && r.fulfillmentStatus !== 'delivered').length;
  const tabs = [
    { key: 'ALL', label: 'All', count: storeFilteredRows.length },
    { key: 'ordered', label: 'Ordered', count: statusCounts.ordered, dot: 'bg-blue-500' },
    { key: 'shipped', label: 'Shipped', count: statusCounts.shipped, dot: 'bg-indigo-500' },
    { key: 'delivered', label: 'Delivered', count: statusCounts.delivered, dot: 'bg-emerald-500' },
  ];

  const creditsTone = !trackingCredits
    ? ''
    : trackingCredits.limit === null
    ? isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
    : trackingCredits.remaining <= 0
    ? isDark ? 'border-rose-700 bg-rose-900/30 text-rose-300' : 'border-rose-300 bg-rose-50 text-rose-700'
    : trackingCredits.remaining <= 5
    ? isDark ? 'border-amber-700 bg-amber-900/30 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-700'
    : isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 bg-white text-slate-600';

  const tabBtn = (active, warn) =>
    `-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition ${
      active
        ? warn
          ? 'border-amber-500 text-amber-600'
          : isDark ? 'border-indigo-400 text-slate-100' : 'border-indigo-600 text-slate-900'
        : `border-transparent ${muted} ${isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'}`
    }`;
  const countPill = (warn) =>
    `rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
      warn ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700') : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
    }`;

  return (
    <div className="page-shell">
      <div className="w-full space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
              <Truck size={22} />
            </span>
            <div>
              <h1 className={`text-2xl font-semibold tracking-tight ${strong}`}>Tracking</h1>
              <p className={`text-sm ${muted}`}>Amazon shipments, tracking codes and eBay uploads for every order</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {trackingCredits && (
              <span
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${creditsTone}`}
                title="Spent 3 credits each time a fresh Aquiline tracking code is obtained."
              >
                <Coins size={14} />
                {trackingCredits.limit === null ? 'Unlimited credits' : `${trackingCredits.remaining} credits left`}
              </span>
            )}
            <TutorialVideoButton />
            <button type="button" onClick={() => setShowMobileTracker(true)} title={t('trackingMobileTracker.buttonTitle')} className={headerBtn}>
              <Smartphone size={15} /> {t('trackingMobileTracker.buttonLabel')}
            </button>
            <button type="button" onClick={() => setMessageSidebarOpen(true)} className={headerBtn}>
              <MessageSquare size={15} /> Buyer messages
            </button>
          </div>
        </div>

        {messageSidebarOpen && (
          <MessageTemplatesSidebar
            isDark={isDark}
            onClose={() => setMessageSidebarOpen(false)}
            ebayAccountId={ebayFilter !== 'ALL' ? ebayFilter : null}
            accountLabel={ebayFilter !== 'ALL' ? accountFilterOptions.find((o) => o.id === ebayFilter)?.label || null : null}
          />
        )}

        {error && (
          <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-rose-700 bg-rose-900/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        )}

        <div className={`${card} overflow-hidden`}>
          {/* Tabs + "Change only TBA" */}
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex gap-1 overflow-x-auto" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'tracked' && statusFilter === tab.key}
                  onClick={() => { setActiveTab('tracked'); setStatusFilter(tab.key); }}
                  className={tabBtn(activeTab === 'tracked' && statusFilter === tab.key)}
                >
                  {tab.dot && <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} />}
                  {tab.label}
                  <span className={countPill(false)}>{loading ? '…' : tab.count}</span>
                </button>
              ))}
              <span className={`mx-1 my-2 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'unmatched'}
                onClick={() => setActiveTab('unmatched')}
                className={tabBtn(activeTab === 'unmatched', unmatched.length > 0)}
              >
                {unmatched.length > 0 && <AlertTriangle size={13} className="text-amber-500" />}
                Needs review
                <span className={countPill(unmatched.length > 0)}>{unmatchedLoading ? '…' : unmatched.length}</span>
              </button>
            </div>

            <label
              title={t('trackingTbaOnly.hint')}
              className={`mb-2 inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                tbaOnly
                  ? isDark ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200' : 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              } ${tbaOnlySaving ? 'opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={tbaOnly}
                disabled={tbaOnlySaving}
                onChange={(e) => handleTbaOnlyChange(e.target.checked)}
              />
              <span
                aria-hidden="true"
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 ${
                  tbaOnly ? 'bg-indigo-600' : isDark ? 'bg-slate-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition ${tbaOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              {t('trackingTbaOnly.label')}
              <Info size={12} className="opacity-60" />
            </label>
          </div>

          {activeTab === 'tracked' && (
            <>
              {/* Toolbar */}
              <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <label className="relative min-w-[220px] flex-1">
                  <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by buyer, order id or tracking number…"
                    className={`${fieldCls} w-full py-2 pl-9 pr-9`}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${faint} hover:opacity-80`}>
                      <X size={14} />
                    </button>
                  )}
                </label>
                {accountFilterOptions.length > 0 && (
                  <label className="relative">
                    <Store size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`} />
                    <select value={ebayFilter} onChange={(e) => handleEbayFilterChange(e.target.value)} className={`${fieldCls} py-2 pl-8 pr-8`}>
                      <option value="ALL">All eBay stores</option>
                      {accountFilterOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {issueCount > 0 && (
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                    <AlertTriangle size={13} />
                    {issueCount} with delivery issues
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                      {['eBay order', 'Customer', 'Amazon order', 'Tracking', 'eBay', 'Updated', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <Loader2 className="mx-auto animate-spin text-indigo-500" size={24} />
                        </td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                              {searchTerm ? <Search size={20} /> : <PackageOpen size={20} />}
                            </span>
                            <p className={`text-sm ${muted}`}>
                              {rows.length === 0
                                ? period === 0
                                  ? periodInfo.hasOlder
                                    ? 'No tracked orders in the last 2 weeks. Use "Older" below to see earlier ones.'
                                    : 'No tracked orders yet.'
                                  : 'No tracked orders in this period.'
                                : searchTerm
                                  ? 'No tracked orders match your search.'
                                  : statusFilter !== 'ALL'
                                    ? 'No orders with this status.'
                                    : 'No tracked orders for this eBay store.'}
                            </p>
                          </div>
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
                            onDeleted={handleRowDeleted}
                            imageUrl={meta?.imageUrl}
                            title={meta?.title}
                            buyerUsername={meta?.buyerUsername}
                            shipToFullName={meta?.shipToFullName}
                          />
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 2-week windows */}
              <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`inline-flex items-center gap-1.5 text-sm ${muted}`}>
                  <CalendarDays size={14} className={faint} />
                  <span className="font-medium">{periodLabel}</span>
                  {!loading && <span className={faint}>· {rows.length} tracked</span>}
                </span>
                {(period > 0 || periodInfo.hasOlder) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPeriod(period - 1)}
                      disabled={loading || period === 0}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <ChevronLeft size={14} /> Newer
                    </button>
                    <span className={`text-xs ${faint}`}>Page {period + 1}</span>
                    <button
                      type="button"
                      onClick={() => goToPeriod(period + 1)}
                      disabled={loading || !periodInfo.hasOlder}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      Older <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'unmatched' && (
            <>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <p className={`text-sm ${muted}`}>
                  Amazon orders the extension saw but couldn't match to exactly one eBay order. Link each one to its eBay order.
                </p>
                {unmatched.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllUnmatched}
                    disabled={deletingAllUnmatched}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-60 ${isDark ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}
                  >
                    <Trash2 size={14} />
                    {deletingAllUnmatched ? 'Deleting…' : 'Delete all'}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                      {['Amazon order', 'Ship-to', 'Observed', 'Link to eBay order'].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                    {unmatchedLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-16 text-center">
                          <Loader2 className="mx-auto animate-spin text-indigo-500" size={24} />
                        </td>
                      </tr>
                    ) : unmatched.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                              <Check size={20} />
                            </span>
                            <p className={`text-sm ${muted}`}>Nothing needs review — every observed Amazon order has been matched.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      unmatched.map((item) => (
                        <UnmatchedRow
                          key={item.id}
                          item={item}
                          isDark={isDark}
                          onResolved={handleResolved}
                          onDeleted={handleUnmatchedDeleted}
                          orderMetaByEbayOrderId={orderMetaByEbayOrderId}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showMobileTracker && <MobileTrackerModal isDark={isDark} onClose={() => setShowMobileTracker(false)} />}
    </div>
  );
}
