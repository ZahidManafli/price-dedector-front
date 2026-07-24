import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  Gavel,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  MessageSquare,
  Truck,
  ExternalLink,
  Code2,
  ShieldCheck,
} from 'lucide-react';
import { casesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ─── FIELD HELPERS ──────────────────────────────────────────────────────────────
// eBay's Post-Order API wraps dates as DateTime objects ({ value, formattedValue })
// and money as Amount objects ({ value, currency, ... }) rather than raw
// strings/numbers — unwrap those precisely per each endpoint's documented schema.
function dateValue(dt) {
  if (!dt) return null;
  if (typeof dt === 'string') return dt;
  return dt.value || dt.formattedValue || null;
}

function amountText(amt) {
  if (amt === null || amt === undefined) return null;
  if (typeof amt === 'string' || typeof amt === 'number') return String(amt);
  if (amt.value === undefined || amt.value === null) return null;
  return amt.currency ? `${amt.value} ${amt.currency}` : String(amt.value);
}

function fmtDate(iso) {
  const value = dateValue(iso);
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (['CLOSED', 'RESOLVED', 'APPROVED', 'REFUNDED', 'COMPLETED', 'SUCCEEDED'].some((k) => s.includes(k))) return 'success';
  if (['DENIED', 'REJECTED', 'ESCALATED', 'FAILED'].some((k) => s.includes(k))) return 'danger';
  if (['WAITING', 'PENDING', 'OPEN', 'ACTION', 'IN_PROGRESS'].some((k) => s.includes(k))) return 'warning';
  return 'neutral';
}

function StatusPill({ status, isDark }) {
  const s = String(status || '').trim();
  if (!s) return <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>;
  const tone = statusTone(s);
  const cls = {
    success: isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-300',
    danger: isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-300',
    warning: isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300',
    neutral: isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300',
  }[tone];
  return <span className={`border text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{s.replace(/_/g, ' ')}</span>;
}

// ─── ACTION PROMPTS ─────────────────────────────────────────────────────────────
async function promptText(title, { label = 'Note', placeholder = '', required = false } = {}) {
  const { value } = await Swal.fire({
    title,
    input: 'textarea',
    inputLabel: label,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Submit',
    inputValidator: (v) => (required && !v ? 'This field is required' : undefined),
  });
  return value;
}

async function promptConfirm(title, text, confirmButtonText = 'Confirm') {
  const { isConfirmed } = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText,
    confirmButtonColor: '#4f46e5',
  });
  return isConfirmed;
}

// Reject Cancellation — per doc, `shipmentDate` and `trackingNumber` are both
// optional; if neither is given the request body must just be `{}`.
async function promptRejectCancellation() {
  const { value, isConfirmed } = await Swal.fire({
    title: 'Reject cancellation',
    html:
      '<input id="swal-tracking" class="swal2-input" placeholder="Tracking number (optional)">' +
      '<input id="swal-shipdate" type="date" class="swal2-input" placeholder="Shipment date (optional)">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Reject',
    confirmButtonColor: '#e11d48',
    preConfirm: () => ({
      trackingNumber: document.getElementById('swal-tracking')?.value?.trim() || undefined,
      shipmentDate: document.getElementById('swal-shipdate')?.value
        ? new Date(document.getElementById('swal-shipdate').value).toISOString()
        : undefined,
    }),
  });
  return isConfirmed ? value : null;
}

// Provide Inquiry Shipment Info — body fields per doc: shippingCarrierName,
// trackingNumber, shippingDate ({value}), shippedWithTracking.
async function promptShipmentInfo() {
  const { value, isConfirmed } = await Swal.fire({
    title: 'Provide shipment info',
    html:
      '<input id="swal-carrier" class="swal2-input" placeholder="Carrier (e.g. USPS)">' +
      '<input id="swal-tracking" class="swal2-input" placeholder="Tracking number">' +
      '<input id="swal-shipdate" type="date" class="swal2-input" placeholder="Shipping date">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Submit',
    preConfirm: () => {
      const shippingCarrierName = document.getElementById('swal-carrier')?.value?.trim();
      const trackingNumber = document.getElementById('swal-tracking')?.value?.trim();
      if (!shippingCarrierName || !trackingNumber) {
        Swal.showValidationMessage('Carrier and tracking number are required');
        return false;
      }
      const shipDateInput = document.getElementById('swal-shipdate')?.value;
      return {
        shippingCarrierName,
        trackingNumber,
        shippedWithTracking: true,
        shippingDate: shipDateInput ? new Date(shipDateInput).toISOString() : undefined,
      };
    },
  });
  return isConfirmed ? value : null;
}

// Check Cancellation Eligibility — standalone lookup by legacyOrderId, not tied to
// an existing cancellation row.
async function runCheckEligibility() {
  const { value: legacyOrderId, isConfirmed } = await Swal.fire({
    title: 'Check cancellation eligibility',
    input: 'text',
    inputLabel: 'Order ID (legacyOrderId)',
    inputPlaceholder: 'e.g. 110123456789-01234',
    showCancelButton: true,
    confirmButtonText: 'Check',
    inputValidator: (v) => (!v ? 'Order ID is required' : undefined),
  });
  if (!isConfirmed || !legacyOrderId) return;
  try {
    const res = await casesAPI.checkCancellationEligibility(legacyOrderId.trim());
    const data = res?.data || {};
    const eligible = !!data.eligible;
    await Swal.fire({
      title: eligible ? 'Eligible for cancellation' : 'Not eligible',
      icon: eligible ? 'success' : 'info',
      html: `<pre style="text-align:left;white-space:pre-wrap;font-size:12px;">${JSON.stringify(
        data.eligibleCancelReason || data.failureReason || data,
        null,
        2
      )}</pre>`,
    });
  } catch (err) {
    await Swal.fire({ title: 'Failed', text: err?.response?.data?.error || err.message, icon: 'error' });
  }
}

// ─── RESOURCE DEFINITIONS ───────────────────────────────────────────────────────
// Only the endpoints we have exact field-level docs for: Cancellations (Search,
// Get, Check Eligibility, Approve, Reject), Case management (Search, Get), and
// Inquiry (Search, Get, Send Message, Provide Shipment Info, Issue Refund).
const RESOURCES = {
  cancellations: {
    label: 'Cancellations',
    description: 'Buyer- or seller-initiated order cancellations. Search, review, approve, or reject.',
    lookupLabel: 'cancelId',
    columns: ['Cancel ID', 'Order', 'Buyer', 'Seller', 'Reason', 'Status', 'Amount', 'Requested', ''],
    search: (dateFrom, dateTo) =>
      casesAPI.searchCancellations({
        creation_date_range_from: dateFrom,
        creation_date_range_to: dateTo,
        role: 'SELLER',
        limit: 100,
      }),
    extractList: (data) => (Array.isArray(data?.cancellations) ? data.cancellations : []),
    rowId: (item) => item.cancelId,
    renderRow: (item) => [
      item.cancelId || '—',
      item.legacyOrderId || '—',
      item.buyerLoginName || '—',
      item.sellerLoginName || '—',
      item.cancelReason ? String(item.cancelReason).replace(/_/g, ' ') : '—',
      <StatusPillCell key="status" status={item.cancelStatus || item.cancelState} />,
      amountText(item.requestRefundAmount) || '—',
      fmtDate(item.cancelRequestDate),
    ],
    getDetail: async (id) => {
      const res = await casesAPI.getCancellation(id);
      return res?.data?.cancelDetail || null;
    },
    detailStatus: (d) => d.cancelStatus || d.cancelState,
    detailFields: (d) => [
      { label: 'State', value: d.cancelState || '—' },
      { label: 'Reason', value: d.cancelReason ? String(d.cancelReason).replace(/_/g, ' ') : '—' },
      { label: 'Order', value: d.legacyOrderId || '—' },
      { label: 'Buyer', value: d.buyerLoginName || '—' },
      { label: 'Seller', value: d.sellerLoginName || '—' },
      { label: 'Refund requested', value: amountText(d.requestRefundAmount) || '—' },
      { label: 'Payment status', value: d.paymentStatus || '—' },
      { label: 'Requested', value: fmtDate(d.cancelRequestDate) },
      { label: 'Closed', value: d.cancelCloseDate ? fmtDate(d.cancelCloseDate) : '—' },
      { label: 'Marketplace', value: d.marketplaceId || '—' },
    ],
    actions: (id, d, { runAction }) => [
      {
        key: 'approve',
        label: 'Approve',
        icon: CheckCircle2,
        tone: 'primary',
        run: async () => {
          const ok = await promptConfirm('Approve this cancellation?', 'This confirms the cancellation on eBay.', 'Approve');
          if (!ok) return;
          await runAction('Approve', () => casesAPI.approveCancellation(id));
        },
      },
      {
        key: 'reject',
        label: 'Reject',
        icon: XCircle,
        tone: 'danger',
        run: async () => {
          const payload = await promptRejectCancellation();
          if (!payload) return;
          await runAction('Reject', () => casesAPI.rejectCancellation(id, payload));
        },
      },
    ],
  },

  cases: {
    label: 'Cases',
    description: 'eBay Money Back Guarantee cases opened against your orders. Read-only lookup.',
    lookupLabel: 'caseId',
    columns: ['Case ID', 'Buyer', 'Seller', 'Item', 'Status', 'Claim amount', 'Created', 'Respond by', ''],
    search: (dateFrom, dateTo) =>
      casesAPI.searchCases({
        case_creation_date_range_from: dateFrom,
        case_creation_date_range_to: dateTo,
        limit: 100,
      }),
    extractList: (data) => (Array.isArray(data?.members) ? data.members : []),
    rowId: (item) => item.caseId,
    renderRow: (item) => [
      item.caseId || '—',
      item.buyer || '—',
      item.seller || '—',
      item.itemId || '—',
      <StatusPillCell key="status" status={item.caseStatusEnum} />,
      amountText(item.claimAmount) || '—',
      fmtDate(item.creationDate),
      fmtDate(item.respondByDate),
    ],
    getDetail: async (id) => {
      const res = await casesAPI.getCase(id);
      return res?.data || null;
    },
    detailStatus: (d) => d.status,
    detailFields: (d) => [
      { label: 'Type', value: d.caseType || '—' },
      { label: 'Item', value: d.itemId || '—' },
      { label: 'Transaction', value: d.transactionId || '—' },
      { label: 'Claim amount', value: amountText(d.claimAmount) || '—' },
      { label: 'Shipping fee', value: amountText(d.shippingFee) || '—' },
      { label: 'Initiator', value: d.initiator || '—' },
      { label: 'Created', value: fmtDate(d.creationDate) },
      { label: 'Last modified', value: fmtDate(d.lastModifiedDate) },
      { label: 'Return ID', value: d.returnId || '—' },
    ],
    actions: () => [],
  },

  inquiries: {
    label: 'Inquiries (INR)',
    description: '"Item not received" inquiries. Send messages, provide shipment info, or issue a full refund.',
    lookupLabel: 'inquiryId',
    columns: ['Inquiry ID', 'Buyer', 'Seller', 'Item', 'Status', 'Claim amount', 'Created', 'Respond by', ''],
    search: (dateFrom, dateTo) =>
      casesAPI.searchInquiries({
        inquiry_creation_date_range_from: dateFrom,
        inquiry_creation_date_range_to: dateTo,
        limit: 100,
      }),
    extractList: (data) => (Array.isArray(data?.members) ? data.members : []),
    rowId: (item) => item.inquiryId,
    renderRow: (item) => [
      item.inquiryId || '—',
      item.buyer || '—',
      item.seller || '—',
      item.itemId || '—',
      <StatusPillCell key="status" status={item.inquiryStatusEnum} />,
      amountText(item.claimAmount) || '—',
      fmtDate(item.creationDate),
      fmtDate(item.respondByDate),
    ],
    getDetail: async (id) => {
      const res = await casesAPI.getInquiry(id);
      return res?.data || null;
    },
    detailStatus: (d) => d.status,
    detailFields: (d) => [
      { label: 'State', value: d.state || '—' },
      { label: 'Item', value: d.itemDetails?.itemTitle || d.itemId || '—' },
      { label: 'Transaction', value: d.transactionId || '—' },
      { label: 'Claim amount', value: amountText(d.claimAmount) || '—' },
      { label: 'Shipping cost', value: amountText(d.shippingCost) || '—' },
      { label: 'Initiator', value: d.initiator || '—' },
      { label: 'Creation reason', value: d.creationReason || '—' },
      { label: 'Seller make-it-right by', value: fmtDate(d.sellerMakeItRightByDate) },
    ],
    actions: (id, d, { runAction }) => [
      {
        key: 'refund',
        label: 'Issue refund',
        icon: DollarSign,
        tone: 'primary',
        run: async () => {
          const ok = await promptConfirm(
            'Issue a full refund?',
            'This issues a full refund for this inquiry — eBay does not accept a partial amount for this action.',
            'Issue refund'
          );
          if (!ok) return;
          const comment = await promptText('Refund comment (optional)', { label: 'Comment', required: false });
          await runAction('Issue refund', () => casesAPI.issueInquiryRefund(id, comment ? { comments: comment } : {}));
        },
      },
      {
        key: 'shipment',
        label: 'Provide shipment info',
        icon: Truck,
        tone: 'default',
        run: async () => {
          const payload = await promptShipmentInfo();
          if (!payload) return;
          await runAction('Provide shipment info', () => casesAPI.provideInquiryShipmentInfo(id, payload));
        },
      },
      {
        key: 'message',
        label: 'Send message',
        icon: MessageSquare,
        tone: 'default',
        run: async () => {
          const content = await promptText('Send message to buyer', { required: true });
          if (!content) return;
          await runAction('Send message', () => casesAPI.sendInquiryMessage(id, { content }));
        },
      },
    ],
  },
};
const RESOURCE_ORDER = ['cancellations', 'cases', 'inquiries'];

function StatusPillCell({ status }) {
  // isDark is read from context at render time via the wrapping table's theme —
  // simplest to just default to light styling here since table rows already sit on
  // theme-aware backgrounds; StatusPill itself is theme-aware when used directly.
  return <StatusPillThemed status={status} />;
}

function StatusPillThemed({ status }) {
  const { isDark } = useTheme();
  return <StatusPill status={status} isDark={isDark} />;
}

// ─── DETAIL DRAWER ──────────────────────────────────────────────────────────────
function DetailDrawer({ resourceKey, id, isDark, onClose, onChanged }) {
  const resource = RESOURCES[resourceKey];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await resource.getDetail(id);
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey, id]);

  const runAction = async (label, fn) => {
    setBusyAction(label);
    try {
      await fn();
      await Swal.fire({ title: 'Done', text: `${label} succeeded.`, icon: 'success', timer: 1800, showConfirmButton: false });
      await load();
      onChanged?.();
    } catch (err) {
      const message = err?.response?.data?.error || err.message || `Failed to ${label.toLowerCase()}`;
      await Swal.fire({ title: 'Failed', text: message, icon: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const actions = useMemo(() => {
    if (!data) return [];
    return resource.actions(id, data, { runAction });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey, id, data]);

  const fields = data
    ? [{ label: 'Status', value: <StatusPill status={resource.detailStatus(data)} isDark={isDark} /> }, ...resource.detailFields(data)]
    : [];

  const btnToneCls = {
    primary: 'btn-primary',
    danger: isDark
      ? 'border border-rose-700 text-rose-300 hover:bg-rose-900/30 rounded-lg px-3 py-2 text-sm font-medium transition'
      : 'border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg px-3 py-2 text-sm font-medium transition',
    default: 'btn-secondary',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`h-full w-full max-w-lg shadow-2xl border-l flex flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-wide font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {resource.label}
            </p>
            <h2 className={`font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{id}</h2>
          </div>
          <button type="button" onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" size={26} />
            </div>
          ) : error ? (
            <div className={`rounded-lg border px-4 py-3 text-sm ${isDark ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
              {error}
            </div>
          ) : (
            <>
              <div className={`rounded-xl border divide-y ${isDark ? 'border-slate-700 divide-slate-800 bg-slate-800/30' : 'border-slate-200 divide-slate-100 bg-slate-50'}`}>
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{f.label}</span>
                    <span className={`font-medium text-right ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{f.value}</span>
                  </div>
                ))}
              </div>

              {actions.length > 0 && (
                <div>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={action.run}
                        disabled={!!busyAction}
                        className={`inline-flex items-center gap-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed ${btnToneCls[action.tone] || btnToneCls.default}`}
                      >
                        <action.icon size={14} />
                        {busyAction === action.label ? 'Working…' : action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Code2 size={13} />
                  {showRaw ? 'Hide raw response' : 'Show raw response'}
                </button>
                {showRaw && (
                  <pre
                    className={`mt-2 max-h-80 overflow-auto rounded-lg border p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {JSON.stringify(data, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── ROW ────────────────────────────────────────────────────────────────────────
function CaseRow({ resourceKey, item, isDark, onOpen }) {
  const resource = RESOURCES[resourceKey];
  const id = resource.rowId(item);
  const cells = resource.renderRow(item);
  return (
    <tr
      onClick={() => onOpen(id)}
      className={`cursor-pointer transition ${isDark ? 'bg-slate-900 hover:bg-slate-800/60' : 'bg-white hover:bg-slate-50'}`}
    >
      {cells.map((cell, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm whitespace-nowrap ${i === 0 ? 'font-medium' : ''} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
        >
          {cell}
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
      </td>
    </tr>
  );
}

// ─── PAGE ───────────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const { isDark } = useTheme();
  const [activeResource, setActiveResource] = useState('cancellations');
  const [itemsByResource, setItemsByResource] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(null); // { resourceKey, id }
  const [lookupId, setLookupId] = useState('');
  const [dateFrom] = useState(() => isoDaysAgo(90));
  const [dateTo] = useState(() => new Date().toISOString());

  const resource = RESOURCES[activeResource];

  const load = async (resourceKey) => {
    setLoading(true);
    setError('');
    try {
      const res = await RESOURCES[resourceKey].search(dateFrom, dateTo);
      setItemsByResource((prev) => ({ ...prev, [resourceKey]: RESOURCES[resourceKey].extractList(res?.data) }));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || `Failed to load ${RESOURCES[resourceKey]?.label.toLowerCase()}`);
      setItemsByResource((prev) => ({ ...prev, [resourceKey]: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeResource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResource]);

  const items = itemsByResource[activeResource] || [];

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [items, searchQuery]);

  const handleLookup = () => {
    const id = lookupId.trim();
    if (!id) return;
    setSelected({ resourceKey: activeResource, id });
    setLookupId('');
  };

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="page-title flex items-center gap-2">
          <Gavel size={18} />
          Cases
        </h1>
        <div className="flex items-center gap-2">
          {activeResource === 'cancellations' && (
            <button type="button" onClick={runCheckEligibility} className="btn-secondary text-sm flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Check eligibility
            </button>
          )}
          <button
            type="button"
            onClick={() => load(activeResource)}
            disabled={loading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{resource.description} Showing the last 90 days.</p>

      <div className={`mb-6 rounded-xl p-1 border inline-flex gap-1 flex-wrap ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        {RESOURCE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveResource(key)}
            className={`px-3 py-2 text-sm rounded-lg transition ${
              activeResource === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {RESOURCES[key].label}
            {Array.isArray(itemsByResource[key]) && itemsByResource[key].length > 0 ? ` (${itemsByResource[key].length})` : ''}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter results…"
            className={`w-full rounded-lg border pl-8 pr-3 py-2 text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder={`Open by ${resource.lookupLabel}…`}
            className={`rounded-lg border px-3 py-2 text-sm w-52 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
          />
          <button type="button" onClick={handleLookup} className="btn-secondary text-sm flex items-center gap-1.5">
            <ExternalLink size={14} />
            Open
          </button>
        </div>
      </div>

      {error && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${isDark ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
            <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
              <tr>
                {resource.columns.map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
              {loading ? (
                <tr>
                  <td colSpan={resource.columns.length} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={resource.columns.length} className={`px-4 py-10 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {items.length === 0 ? `No ${resource.label.toLowerCase()} in the last 90 days.` : 'Nothing matches your search.'}
                  </td>
                </tr>
              ) : (
                visibleItems.map((item, idx) => (
                  <CaseRow
                    key={resource.rowId(item) || idx}
                    resourceKey={activeResource}
                    item={item}
                    isDark={isDark}
                    onOpen={(id) => setSelected({ resourceKey: activeResource, id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DetailDrawer
          resourceKey={selected.resourceKey}
          id={selected.id}
          isDark={isDark}
          onClose={() => setSelected(null)}
          onChanged={() => load(selected.resourceKey)}
        />
      )}
    </div>
  );
}
