import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Banknote, Clock, Download, Landmark, Lock, Repeat, Wallet } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import DailyFinanceFlowChart from './DailyFinanceFlowChart';
import { ebayAPI } from '../services/api';
import { SectionCard, StatTile, Dot, DetailModal, DataTable } from './dashboardUi';

// ─── status → color mappings ────────────────────────────────────────────────

const PAYOUT_STATUS_COLOR = {
  INITIATED: 'sky',
  SUCCEEDED: 'emerald',
  REVERSED: 'amber',
  RETRYABLE_FAILED: 'amber',
  TERMINAL_FAILED: 'rose',
};

const TX_STATUS_COLOR = {
  FUNDS_ON_HOLD: 'amber',
  FUNDS_PROCESSING: 'sky',
  FUNDS_AVAILABLE_FOR_PAYOUT: 'violet',
  PAYOUT: 'emerald',
  COMPLETED: 'emerald',
  FAILED: 'rose',
};

const BOOKING_COLOR = { CREDIT: 'emerald', DEBIT: 'rose' };

// Every category the eBay TransactionSummaryResponse can carry, always shown (even at zero)
// so the redesigned dashboard visibly surfaces the API's full breakdown, not just credits.
const TRANSACTION_CATEGORIES = [
  'credit', 'refund', 'dispute', 'loanRepayment', 'withdrawal', 'purchase',
  'shippingLabel', 'transfer', 'adjustment', 'balanceTransfer', 'onHold', 'nonSaleCharge',
];

function StatusBadge({ isDark, t, kind, value }) {
  if (!value) return <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>;
  const colorMap = kind === 'payout' ? PAYOUT_STATUS_COLOR : kind === 'tx' ? TX_STATUS_COLOR : BOOKING_COLOR;
  const nsMap = kind === 'payout' ? 'status' : kind === 'tx' ? 'txStatus' : 'booking';
  const color = colorMap[value] || 'slate';
  return <Dot isDark={isDark} color={color}>{t(`dashboard.finance.${nsMap}.${value}`, { defaultValue: value })}</Dot>;
}

function fmtDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── detail modals ───────────────────────────────────────────────────────────

function useDetailFetcher(fetchFn) {
  const [state, setState] = useState({ open: false, loading: false, error: null, data: null, id: null });
  const open = async (id) => {
    setState({ open: true, loading: true, error: null, data: null, id });
    try {
      const res = await fetchFn(id);
      setState({ open: true, loading: false, error: null, data: res?.data || null, id });
    } catch (err) {
      setState({ open: true, loading: false, error: err?.response?.data?.error || err?.message || 'Failed', data: null, id });
    }
  };
  const close = () => setState((s) => ({ ...s, open: false }));
  return [state, open, close];
}

function OrderEarningsDetailModal({ isDark, t, state, onClose, fmt }) {
  if (!state.open) return null;
  const d = state.data;
  const s = d?.orderEarningsSummary || {};
  return (
    <DetailModal isDark={isDark} title={t('dashboard.finance.detailOrderTitle')} onClose={onClose}>
      {state.loading ? (
        <div className="py-6 flex justify-center"><LoadingSpinner /></div>
      ) : state.error ? (
        <p className="text-sm text-rose-500">{state.error}</p>
      ) : d ? (
        <div className="space-y-2 text-sm">
          <Row label={t('dashboard.finance.colOrderId')} value={d.orderId} isDark={isDark} />
          <Row label={t('dashboard.finance.detailBuyer')} value={d.buyer?.username || '—'} isDark={isDark} />
          <Row label={t('dashboard.finance.detailOrderCreated')} value={fmtDate(d.orderCreationDate, true)} isDark={isDark} />
          <Row label={t('dashboard.finance.grossAmount')} value={fmt(s.grossAmount?.value, s.grossAmount?.currency)} isDark={isDark} />
          <Row label={t('dashboard.finance.expenses')} value={fmt(s.expenses?.value, s.expenses?.currency)} isDark={isDark} />
          <Row label={t('dashboard.finance.refunds')} value={fmt(s.refunds?.value, s.refunds?.currency)} isDark={isDark} />
          <Row label={t('dashboard.finance.netEarnings')} value={fmt(s.orderEarnings?.value, s.orderEarnings?.currency)} isDark={isDark} bold />
        </div>
      ) : null}
    </DetailModal>
  );
}

function PayoutDetailModal({ isDark, t, state, onClose, fmt }) {
  if (!state.open) return null;
  const d = state.data;
  return (
    <DetailModal isDark={isDark} title={t('dashboard.finance.detailPayoutTitle')} onClose={onClose}>
      {state.loading ? (
        <div className="py-6 flex justify-center"><LoadingSpinner /></div>
      ) : state.error ? (
        <p className="text-sm text-rose-500">{state.error}</p>
      ) : d ? (
        <div className="space-y-2 text-sm">
          <Row label={t('dashboard.finance.colPayoutId')} value={d.payoutId} isDark={isDark} />
          <Row label={t('dashboard.finance.colStatus')} value={<StatusBadge isDark={isDark} t={t} kind="payout" value={d.payoutStatus} />} isDark={isDark} />
          <Row label={t('dashboard.finance.colAmount')} value={fmt(d.amount?.value, d.amount?.currency)} isDark={isDark} bold />
          <Row label={t('dashboard.finance.detailPayoutDate')} value={fmtDate(d.payoutDate, true)} isDark={isDark} />
          <Row label={t('dashboard.finance.colTxnCount')} value={d.transactionCount ?? 0} isDark={isDark} />
          <Row label={t('dashboard.finance.colInstrument')} value={`${d.payoutInstrument?.instrumentType || '—'} •••• ${d.payoutInstrument?.accountLastFourDigits || ''}`} isDark={isDark} />
          {d.bankReference && <Row label={t('dashboard.finance.detailBankReference')} value={d.bankReference} isDark={isDark} />}
        </div>
      ) : null}
    </DetailModal>
  );
}

function TransferDetailModal({ isDark, t, state, onClose, fmt }) {
  if (!state.open) return null;
  const d = state.data;
  return (
    <DetailModal isDark={isDark} title={t('dashboard.finance.detailTransferTitle')} onClose={onClose}>
      {state.loading ? (
        <div className="py-6 flex justify-center"><LoadingSpinner /></div>
      ) : state.error ? (
        <p className="text-sm text-rose-500">{state.error}</p>
      ) : d ? (
        <div className="space-y-2 text-sm">
          <Row label={t('dashboard.finance.colTransferId')} value={d.transferId} isDark={isDark} />
          <Row label={t('dashboard.finance.colAmount')} value={fmt(d.transferAmount?.value, d.transferAmount?.currency)} isDark={isDark} bold />
          <Row label={t('dashboard.finance.colDate')} value={fmtDate(d.transactionDate, true)} isDark={isDark} />
          <Row label={t('dashboard.finance.detailFundingSource')} value={d.fundingSource?.type || '—'} isDark={isDark} />
          {d.transferDetail?.totalChargeNetAmount && (
            <Row label={t('dashboard.finance.detailTotalCharge')} value={fmt(d.transferDetail.totalChargeNetAmount.value, d.transferDetail.totalChargeNetAmount.currency)} isDark={isDark} />
          )}
          {(d.transferDetail?.charges || []).length > 0 && (
            <div className="pt-2">
              <p className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.finance.detailCharges')}</p>
              <div className="space-y-1.5">
                {d.transferDetail.charges.map((c, i) => (
                  <div key={i} className={`text-xs rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                    {c.orderId || c.refundId || c.returnId || c.caseId || '—'} · {fmt(c.chargeNetAmount?.value, c.chargeNetAmount?.currency)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </DetailModal>
  );
}

function Row({ label, value, isDark, bold }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${isDark ? 'text-slate-100' : 'text-slate-900'} text-right`}>{value ?? '—'}</span>
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export default function FinanceAnalyticsSection({ analytics, loading, error, isDark, days, onDaysChange }) {
  const { t } = useTranslation('system');
  const finance = analytics?.finance || null;

  const financeCurrency =
    finance?.summaries?.orderEarnings?.orderEarnings?.currency ||
    finance?.summaries?.sellerFunds?.availableFunds?.currency ||
    'USD';

  const fmt = (value, currency) => {
    const n = Number(value || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || financeCurrency || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0);
    } catch {
      return `${n.toFixed(2)} ${currency || financeCurrency}`;
    }
  };

  const [orderModal, openOrderModal, closeOrderModal] = useDetailFetcher(ebayAPI.getOrderEarningsDetail);
  const [payoutModal, openPayoutModal, closePayoutModal] = useDetailFetcher(ebayAPI.getPayoutDetail);
  const [transferModal, openTransferModal, closeTransferModal] = useDetailFetcher(ebayAPI.getTransferDetail);

  const orderEarnings = finance?.lists?.orderEarnings?.items || [];
  const payouts = finance?.lists?.payouts?.items || [];
  const transactions = finance?.lists?.transactions?.items || [];
  const billingActivities = finance?.lists?.billingActivities?.items || [];
  const transfers = finance?.lists?.transfers?.items || [];

  const orderSummary = finance?.summaries?.orderEarnings || {};
  const payoutSummary = finance?.summaries?.payout || {};
  const transactionSummary = finance?.summaries?.transaction || {};
  const sellerFunds = finance?.summaries?.sellerFunds || {};
  const balances = finance?.balances || {};

  // Upcoming payouts: scheduled payouts (payoutDate) landing within the next 7 days.
  const upcomingPayouts = useMemo(() => {
    const now = Date.now();
    const in7Days = now + 7 * 24 * 60 * 60 * 1000;
    return payouts
      .filter((p) => {
        if (!p?.payoutDate) return false;
        const ts = new Date(p.payoutDate).getTime();
        return Number.isFinite(ts) && ts >= now && ts <= in7Days;
      })
      .sort((a, b) => new Date(a.payoutDate) - new Date(b.payoutDate));
  }, [payouts]);
  const upcomingTotal = upcomingPayouts.reduce((s, p) => s + Number(p?.amount?.value || 0), 0);
  const upcomingCurrency = upcomingPayouts[0]?.amount?.currency || financeCurrency;

  const handleExportCsv = () => {
    const rows = [['Section', 'Field', 'Value', 'Currency', 'Extra']];
    rows.push(['Summary', t('dashboard.finance.netEarnings'), orderSummary?.orderEarnings?.value ?? 0, orderSummary?.orderEarnings?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.grossAmount'), orderSummary?.grossAmount?.value ?? 0, orderSummary?.grossAmount?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.expenses'), orderSummary?.expenses?.value ?? 0, orderSummary?.expenses?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.refunds'), orderSummary?.refunds?.value ?? 0, orderSummary?.refunds?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.availableFunds'), balances.availableFunds ?? 0, sellerFunds?.availableFunds?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.processingFunds'), balances.processingFunds ?? 0, sellerFunds?.processingFunds?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.onHoldFunds'), balances.fundsOnHold ?? 0, sellerFunds?.fundsOnHold?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.totalFunds'), balances.totalFunds ?? 0, sellerFunds?.totalFunds?.currency || financeCurrency, '']);
    rows.push(['Summary', t('dashboard.finance.payoutAmount'), payoutSummary?.amount?.value ?? 0, payoutSummary?.amount?.currency || financeCurrency, `${payoutSummary?.payoutCount ?? 0} payouts`]);
    for (const cat of TRANSACTION_CATEGORIES) {
      const amount = transactionSummary?.[`${cat}Amount`]?.value;
      const count = transactionSummary?.[`${cat}Count`];
      if (amount == null && !count) continue;
      rows.push(['Transaction category', t(`dashboard.finance.category.${cat}`), amount ?? 0, transactionSummary?.[`${cat}Amount`]?.currency || financeCurrency, `${count ?? 0} txns`]);
    }
    rows.push(['---', '', '', '', '']);
    for (const item of orderEarnings) {
      rows.push(['Order Earning', item.orderId || '', item?.orderEarningsSummary?.orderEarnings?.value || 0, item?.orderEarningsSummary?.orderEarnings?.currency || financeCurrency, `Gross ${item?.orderEarningsSummary?.grossAmount?.value || 0}`]);
    }
    for (const item of payouts) {
      rows.push(['Payout', item.payoutId || '', item?.amount?.value || 0, item?.amount?.currency || financeCurrency, `${item.payoutStatus || ''} • ${item.transactionCount || 0} txns`]);
    }
    for (const item of transactions) {
      rows.push(['Transaction', item.transactionId || '', item.amount || 0, item.currency || financeCurrency, `${item.transactionType || ''} • ${item.transactionStatus || ''}`]);
    }
    for (const item of billingActivities) {
      rows.push(['Billing Activity', item.billingTransactionId || '', item.amount || 0, item.currency || financeCurrency, item.feeTypeDescription || item.feeType || '']);
    }
    for (const item of transfers) {
      rows.push(['Transfer', item.transferId || '', item.amount || 0, item.currency || financeCurrency, fmtDate(item.transactionDate)]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkila-finance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-5">
        <div>
          <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dashboard.finance.title')}</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.finance.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center rounded-xl border p-0.5 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDaysChange?.(d)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t(`dashboard.finance.range${d}`)}
              </button>
            ))}
          </div>
          {finance && !finance.financeAccessDenied && (
            <button
              type="button"
              onClick={handleExportCsv}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                isDark ? 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              }`}
            >
              <Download size={14} />
              {t('dashboard.finance.exportCsv')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <p className={`text-sm rounded-xl border px-3 py-2 ${isDark ? 'border-rose-800/50 bg-rose-950/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />
            {error}
          </p>
        </div>
      )}

      {loading && !analytics && (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner />
        </div>
      )}

      {finance?.financeAccessDenied ? (
        <SectionCard isDark={isDark} className={`p-5 ${isDark ? 'border-indigo-800/50 bg-indigo-950/20' : 'border-indigo-200 bg-indigo-50/60'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-900/60' : 'bg-indigo-100'}`}>
              <Lock size={16} className={isDark ? 'text-indigo-300' : 'text-indigo-600'} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>{t('dashboard.finance.accessDeniedTitle')}</p>
              <p className={`text-xs ${isDark ? 'text-indigo-300/70' : 'text-indigo-700'}`}>
                {finance?.financeAccessErrorMessage || t('dashboard.finance.accessDeniedMessage')}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : finance && (
        <>
          {/* ── KPI strips ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
            <StatTile isDark={isDark} icon={Banknote} label={t('dashboard.finance.netEarnings')} value={fmt(orderSummary?.orderEarnings?.value, orderSummary?.orderEarnings?.currency)} sublabel={t('dashboard.finance.netEarningsHint')} accent="emerald" />
            <StatTile isDark={isDark} icon={Banknote} label={t('dashboard.finance.grossAmount')} value={fmt(orderSummary?.grossAmount?.value, orderSummary?.grossAmount?.currency)} sublabel={t('dashboard.finance.grossAmountHint')} accent="indigo" />
            <StatTile isDark={isDark} icon={Banknote} label={t('dashboard.finance.expenses')} value={fmt(orderSummary?.expenses?.value, orderSummary?.expenses?.currency)} sublabel={t('dashboard.finance.expensesHint')} accent="amber" />
            <StatTile isDark={isDark} icon={Banknote} label={t('dashboard.finance.refunds')} value={fmt(orderSummary?.refunds?.value, orderSummary?.refunds?.currency)} sublabel={t('dashboard.finance.refundsHint')} accent="rose" />
            <StatTile isDark={isDark} icon={Repeat} label={t('dashboard.finance.orderCount')} value={orderSummary?.orderCount ?? 0} accent="sky" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
            <StatTile isDark={isDark} icon={Wallet} label={t('dashboard.finance.availableFunds')} value={fmt(balances.availableFunds, sellerFunds?.availableFunds?.currency)} sublabel={t('dashboard.finance.availableFundsHint')} accent="sky" />
            <StatTile isDark={isDark} icon={Clock} label={t('dashboard.finance.processingFunds')} value={fmt(balances.processingFunds, sellerFunds?.processingFunds?.currency)} sublabel={t('dashboard.finance.processingFundsHint')} accent="violet" />
            <StatTile isDark={isDark} icon={Lock} label={t('dashboard.finance.onHoldFunds')} value={fmt(balances.fundsOnHold, sellerFunds?.fundsOnHold?.currency)} sublabel={t('dashboard.finance.onHoldFundsHint')} accent="amber" />
            <StatTile isDark={isDark} icon={Landmark} label={t('dashboard.finance.totalFunds')} value={fmt(balances.totalFunds, sellerFunds?.totalFunds?.currency)} sublabel={t('dashboard.finance.totalFundsHint')} accent="indigo" />
            <StatTile isDark={isDark} icon={Banknote} label={t('dashboard.finance.payoutAmount')} value={fmt(payoutSummary?.amount?.value, payoutSummary?.amount?.currency)} sublabel={`${payoutSummary?.payoutCount ?? 0} ${t('dashboard.finance.payoutCount').toLowerCase()}`} accent="emerald" />
          </div>

          {/* ── Transaction category breakdown ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.categoryBreakdownTitle')}</p>
            <p className={`text-[11px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.categoryBreakdownHint')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {TRANSACTION_CATEGORIES.map((cat) => {
                const amount = transactionSummary?.[`${cat}Amount`];
                const count = transactionSummary?.[`${cat}Count`];
                const isEmpty = amount?.value == null && !count;
                return (
                  <div
                    key={cat}
                    className={`rounded-lg border p-2.5 ${isEmpty ? 'opacity-40' : ''} ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t(`dashboard.finance.category.${cat}`)}</p>
                    <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{fmt(amount?.value, amount?.currency)}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{count ?? 0}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Upcoming payouts ── */}
          <SectionCard isDark={isDark} className={`p-4 mb-4 ${isDark ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50/60'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className={`text-xs uppercase tracking-widest font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{t('dashboard.finance.upcomingTitle')}</p>
                <p className={`mt-1 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(upcomingTotal, upcomingCurrency)}</p>
                <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {upcomingPayouts.length === 0
                    ? t('dashboard.finance.noUpcoming')
                    : t('dashboard.finance.upcomingPayoutsCount', { count: upcomingPayouts.length })}
                </p>
              </div>
            </div>
            {upcomingPayouts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {upcomingPayouts.map((p) => {
                  const daysUntil = Math.ceil((new Date(p.payoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={p.payoutId} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isDark ? 'border-emerald-800/40 bg-emerald-950/30' : 'border-emerald-200 bg-white'}`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{p.payoutId || '—'}</p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(p.payoutDate)} · {p.transactionCount ?? 0} txns</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <strong className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmt(p?.amount?.value, p?.amount?.currency)}</strong>
                        <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.finance.inDays', { count: daysUntil })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* ── Hero chart ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <DailyFinanceFlowChart isDark={isDark} t={t} finance={finance} currencyFormatter={(v) => fmt(v)} />
          </SectionCard>

          {/* ── Order earnings ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.orderEarningsTitle')}</h3>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.showingCount', { shown: orderEarnings.length, total: finance?.lists?.orderEarnings?.total ?? orderEarnings.length })}</span>
            </div>
            <DataTable
              isDark={isDark}
              keyField="orderId"
              defaultVisible={6}
              emptyMessage={t('dashboard.finance.noOrderEarnings')}
              showAllLabel={t('dashboard.finance.showAll')}
              showLessLabel={t('dashboard.showLess')}
              onRowClick={(row) => openOrderModal(row.orderId)}
              rows={orderEarnings}
              columns={[
                { key: 'date', header: t('dashboard.finance.colDate'), render: (r) => fmtDate(r.orderCreationDate) },
                { key: 'orderId', header: t('dashboard.finance.colOrderId'), render: (r) => <span className="font-medium">{r.orderId}</span> },
                { key: 'gross', header: t('dashboard.finance.colGross'), align: 'right', render: (r) => fmt(r?.orderEarningsSummary?.grossAmount?.value, r?.orderEarningsSummary?.grossAmount?.currency) },
                { key: 'expenses', header: t('dashboard.finance.expenses'), align: 'right', render: (r) => fmt(r?.orderEarningsSummary?.expenses?.value, r?.orderEarningsSummary?.expenses?.currency) },
                { key: 'refunds', header: t('dashboard.finance.refunds'), align: 'right', render: (r) => fmt(r?.orderEarningsSummary?.refunds?.value, r?.orderEarningsSummary?.refunds?.currency) },
                { key: 'net', header: t('dashboard.finance.colNet'), align: 'right', render: (r) => <strong>{fmt(r?.orderEarningsSummary?.orderEarnings?.value, r?.orderEarningsSummary?.orderEarnings?.currency)}</strong> },
              ]}
            />
          </SectionCard>

          {/* ── Payouts ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.payoutsTitle')}</h3>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.showingCount', { shown: payouts.length, total: finance?.lists?.payouts?.total ?? payouts.length })}</span>
            </div>
            <DataTable
              isDark={isDark}
              keyField="payoutId"
              defaultVisible={6}
              emptyMessage={t('dashboard.finance.noPayouts')}
              showAllLabel={t('dashboard.finance.showAll')}
              showLessLabel={t('dashboard.showLess')}
              onRowClick={(row) => openPayoutModal(row.payoutId)}
              rows={payouts}
              columns={[
                { key: 'date', header: t('dashboard.finance.colDate'), render: (r) => fmtDate(r.payoutDate) },
                { key: 'payoutId', header: t('dashboard.finance.colPayoutId'), render: (r) => <span className="font-medium">{r.payoutId}</span> },
                { key: 'status', header: t('dashboard.finance.colStatus'), render: (r) => <StatusBadge isDark={isDark} t={t} kind="payout" value={r.payoutStatus} /> },
                { key: 'txns', header: t('dashboard.finance.colTxnCount'), align: 'right', render: (r) => r.transactionCount ?? 0 },
                { key: 'amount', header: t('dashboard.finance.colAmount'), align: 'right', render: (r) => <strong>{fmt(r?.amount?.value, r?.amount?.currency)}</strong> },
              ]}
            />
          </SectionCard>

          {/* ── Transactions ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.transactionsTitle')}</h3>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.showingCount', { shown: transactions.length, total: finance?.lists?.transactions?.total ?? transactions.length })}</span>
            </div>
            <DataTable
              isDark={isDark}
              keyField="transactionId"
              defaultVisible={8}
              emptyMessage={t('dashboard.finance.noTransactions')}
              showAllLabel={t('dashboard.finance.showAll')}
              showLessLabel={t('dashboard.showLess')}
              rows={transactions}
              columns={[
                { key: 'date', header: t('dashboard.finance.colDate'), render: (r) => fmtDate(r.transactionDate) },
                { key: 'type', header: t('dashboard.finance.colType'), render: (r) => r.transactionType || '—' },
                { key: 'status', header: t('dashboard.finance.colStatus'), render: (r) => <StatusBadge isDark={isDark} t={t} kind="tx" value={r.transactionStatus} /> },
                { key: 'entry', header: t('dashboard.finance.colBooking'), render: (r) => <StatusBadge isDark={isDark} t={t} kind="booking" value={r.bookingEntry} /> },
                { key: 'ref', header: t('dashboard.finance.colListingOrder'), render: (r) => r.orderId || r.payoutId || r.transferId || '—' },
                { key: 'amount', header: t('dashboard.finance.colAmount'), align: 'right', render: (r) => <strong>{fmt(r.amount, r.currency)}</strong> },
              ]}
            />
          </SectionCard>

          {/* ── Billing activity ── */}
          <SectionCard isDark={isDark} className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.billingActivityTitle')}</h3>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.showingCount', { shown: billingActivities.length, total: finance?.lists?.billingActivities?.total ?? billingActivities.length })}</span>
            </div>
            <DataTable
              isDark={isDark}
              keyField="billingTransactionId"
              defaultVisible={6}
              emptyMessage={t('dashboard.finance.noBillingActivity')}
              showAllLabel={t('dashboard.finance.showAll')}
              showLessLabel={t('dashboard.showLess')}
              rows={billingActivities}
              columns={[
                { key: 'date', header: t('dashboard.finance.colDate'), render: (r) => fmtDate(r.billingTransactionDate) },
                { key: 'feeType', header: t('dashboard.finance.colFeeType'), render: (r) => r.feeTypeDescription || r.feeType || '—' },
                { key: 'entry', header: t('dashboard.finance.colBooking'), render: (r) => <StatusBadge isDark={isDark} t={t} kind="booking" value={r.bookingEntry} /> },
                { key: 'ref', header: t('dashboard.finance.colListingOrder'), render: (r) => r.listingId || r.orderId || '—' },
                { key: 'amount', header: t('dashboard.finance.colAmount'), align: 'right', render: (r) => <strong>{fmt(r.amount, r.currency)}</strong> },
              ]}
            />
          </SectionCard>

          {/* ── Transfers ── */}
          <SectionCard isDark={isDark} className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.finance.transfersTitle')}</h3>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{transfers.length}</span>
            </div>
            <DataTable
              isDark={isDark}
              keyField="transferId"
              defaultVisible={6}
              emptyMessage={t('dashboard.finance.noTransfers')}
              showAllLabel={t('dashboard.finance.showAll')}
              showLessLabel={t('dashboard.showLess')}
              onRowClick={(row) => openTransferModal(row.transferId)}
              rows={transfers}
              columns={[
                { key: 'date', header: t('dashboard.finance.colDate'), render: (r) => fmtDate(r.transactionDate) },
                { key: 'transferId', header: t('dashboard.finance.colTransferId'), render: (r) => <span className="font-medium">{r.transferId}</span> },
                { key: 'source', header: t('dashboard.finance.detailFundingSource'), render: (r) => r.fundingSource?.type || '—' },
                { key: 'charges', header: t('dashboard.finance.colCharges'), align: 'right', render: (r) => (r.charges || []).length },
                { key: 'amount', header: t('dashboard.finance.colAmount'), align: 'right', render: (r) => <strong>{fmt(r.amount, r.currency)}</strong> },
              ]}
            />
          </SectionCard>
        </>
      )}

      <OrderEarningsDetailModal isDark={isDark} t={t} state={orderModal} onClose={closeOrderModal} fmt={fmt} />
      <PayoutDetailModal isDark={isDark} t={t} state={payoutModal} onClose={closePayoutModal} fmt={fmt} />
      <TransferDetailModal isDark={isDark} t={t} state={transferModal} onClose={closeTransferModal} fmt={fmt} />
    </div>
  );
}
