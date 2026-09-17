import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ebayAPI } from '../services/api';
import {
  X,
  Loader2,
  AlertCircle,
  User,
  MapPin,
  CreditCard,
  Receipt,
  Package,
  Megaphone,
  Ban,
  Calendar,
  Hash,
} from 'lucide-react';

function fmtMoney(amount) {
  if (!amount) return null;
  const value = Number(amount?.value);
  if (!Number.isFinite(value)) return null;
  const currency = amount?.currency || 'USD';
  return `${value.toFixed(2)} ${currency}`;
}

function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanizeEnum(value) {
  if (!value) return null;
  return String(value)
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// Small labeled key/value row used throughout the detail sections.
function InfoRow({ label, value, mono = false, tone }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span
        className={`text-xs text-right ${mono ? 'font-mono' : 'font-medium'} ${
          tone === 'danger'
            ? 'text-rose-600 dark:text-rose-400'
            : tone === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-800 dark:text-slate-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, isDark, children, accent = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? isDark
            ? 'bg-indigo-950/40 border-indigo-800/60'
            : 'bg-indigo-50/60 border-indigo-200'
          : isDark
          ? 'bg-slate-900/50 border-slate-700'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className={isDark ? 'text-indigo-300' : 'text-indigo-600'} />
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Badge({ tone = 'neutral', isDark, children }) {
  const tones = {
    success: isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-300',
    warning: isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300',
    danger: isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-300',
    info: isDark ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700' : 'bg-indigo-50 text-indigo-700 border-indigo-300',
    neutral: isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

function fulfillmentTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FULFILLED') return 'success';
  if (s === 'IN_PROGRESS') return 'warning';
  return 'neutral';
}

function paymentTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'PARTIALLY_REFUNDED' || s === 'FULLY_REFUNDED') return 'warning';
  return 'neutral';
}

/**
 * Read-only, richly detailed view of a single eBay order — opened from the
 * Profit Table's "i" button. Always fetches the live order (GET /ebay/orders/:orderId)
 * rather than relying on cached list pages, since eBay only fully populates
 * cancelStatus.cancelRequests on the single-order call.
 *
 * Optional relatedFee/amazonPrice/count let the modal recompute this specific
 * order's net profit live, tying the Profit Table's numbers back to the real
 * order data they were derived from.
 */
export default function OrderDetailModal({ orderId, relatedFee = 0, amazonPrice = 0, count = 1, onClose }) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setOrder(null);
    ebayAPI
      .getOrderDetail(orderId)
      .then((res) => {
        if (cancelled) return;
        setOrder(res?.data?.order || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || t('orderDetailModal.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, t]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const firstLineItem = order?.lineItems?.[0];
  const soldViaAds = Boolean(firstLineItem?.properties?.soldViaAdCampaign);
  const shipTo = order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || order?.buyer?.buyerRegistrationAddress;
  const shippingStep = order?.fulfillmentStartInstructions?.[0]?.shippingStep;
  const fulfillmentInstructions = order?.fulfillmentStartInstructions?.[0];
  const firstPayment = order?.paymentSummary?.payments?.[0];
  const paymentHolds = firstPayment?.paymentHolds || [];
  const cancelStatus = order?.cancelStatus;
  const hasCancellation = cancelStatus && String(cancelStatus.cancelState || 'NONE_REQUESTED').toUpperCase() !== 'NONE_REQUESTED';

  // "Total eBay Paid" is what actually lands in the seller's pocket: eBay's own
  // totalDueSeller already nets out the Final Value Fee, but the Promoted
  // Listings ad fee is billed separately later and never reflected in that
  // figure — so it still has to be subtracted here, manually, when the order
  // was sold via an ad campaign.
  const liveDueSeller = Number(order?.paymentSummary?.totalDueSeller?.value);
  const adFeeAmount = soldViaAds ? Number(relatedFee || 0) : 0;
  const totalEbayPaid = Number.isFinite(liveDueSeller)
    ? Math.round((liveDueSeller - adFeeAmount) * 100) / 100
    : null;
  const hasProfitTieIn = totalEbayPaid !== null && (Number(amazonPrice) > 0 || adFeeAmount > 0);
  const amazonCostTotal = Number(amazonPrice || 0) * Math.max(1, Number(count) || 1);
  const netProfit = hasProfitTieIn ? Math.round((totalEbayPaid - amazonCostTotal) * 100) / 100 : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div
          className={`sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b backdrop-blur ${
            isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
        >
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('orderDetailModal.title')}
            </p>
            <p className={`text-lg font-bold font-mono truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {order?.orderId || orderId}
            </p>
            {order && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge tone={fulfillmentTone(order.orderFulfillmentStatus)} isDark={isDark}>
                  {humanizeEnum(order.orderFulfillmentStatus)}
                </Badge>
                <Badge tone={paymentTone(order.orderPaymentStatus)} isDark={isDark}>
                  {humanizeEnum(order.orderPaymentStatus)}
                </Badge>
                {hasCancellation && (
                  <Badge tone="danger" isDark={isDark}>
                    {humanizeEnum(cancelStatus.cancelState)}
                  </Badge>
                )}
                <Badge tone={soldViaAds ? 'info' : 'neutral'} isDark={isDark}>
                  {soldViaAds ? t('orderDetailModal.soldViaAds') : t('orderDetailModal.notSoldViaAds')}
                </Badge>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
            aria-label={t('orderDetailModal.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-indigo-500" size={28} />
            </div>
          )}

          {!loading && error && (
            <div
              className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
                isDark ? 'bg-rose-950/30 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!loading && !error && order && (
            <div className="space-y-4">
              {/* Financial summary — the headline section */}
              <SectionCard icon={Receipt} title={t('orderDetailModal.sectionFinancial')} isDark={isDark} accent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {[
                    [t('orderDetailModal.priceSubtotal'), fmtMoney(order.pricingSummary?.priceSubtotal)],
                    [t('orderDetailModal.shippingCost'), fmtMoney(order.pricingSummary?.deliveryCost)],
                    [t('orderDetailModal.tax'), fmtMoney(order.pricingSummary?.tax)],
                    [t('orderDetailModal.orderTotal'), fmtMoney(order.pricingSummary?.total)],
                  ].map(([label, value], i) => (
                    <div key={i} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value || '—'}</p>
                    </div>
                  ))}
                </div>

                <div className={`h-px my-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                <InfoRow label={t('orderDetailModal.feeBasisAmount')} value={fmtMoney(order.totalFeeBasisAmount)} />
                <InfoRow label={t('orderDetailModal.marketplaceFee')} value={fmtMoney(order.totalMarketplaceFee)} tone="danger" />
                <InfoRow
                  label={t('orderDetailModal.dueToSeller')}
                  value={fmtMoney(order.paymentSummary?.totalDueSeller)}
                />
                {soldViaAds && adFeeAmount > 0 && (
                  <InfoRow label={t('orderDetailModal.adFee')} value={`-${adFeeAmount.toFixed(2)} USD`} tone="danger" />
                )}

                {totalEbayPaid !== null && (
                  <div className="flex items-center justify-between pt-2 mt-1">
                    <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {t('orderDetailModal.totalEbayPaid')}
                    </span>
                    <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {totalEbayPaid.toFixed(2)} USD
                    </span>
                  </div>
                )}

                {hasProfitTieIn && (
                  <>
                    <div className={`h-px my-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <InfoRow label={t('orderDetailModal.amazonCost')} value={`-${amazonCostTotal.toFixed(2)} USD`} tone="danger" />
                    <div className="flex items-center justify-between pt-2 mt-1">
                      <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {t('orderDetailModal.netProfit')}
                      </span>
                      <span className={`text-lg font-bold ${netProfit >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>
                        {netProfit >= 0 ? '+' : ''}
                        {netProfit.toFixed(2)} USD
                      </span>
                    </div>
                  </>
                )}
              </SectionCard>

              {/* Line items */}
              <SectionCard icon={Package} title={t('orderDetailModal.sectionLineItems')} isDark={isDark}>
                <div className="space-y-3">
                  {(order.lineItems || []).map((item) => (
                    <div
                      key={item.lineItemId}
                      className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title}</p>
                        {item?.properties?.soldViaAdCampaign && (
                          <span className="shrink-0">
                            <Badge tone="info" isDark={isDark}>
                              <Megaphone size={10} className="inline mr-1 -mt-0.5" />
                              {t('orderDetailModal.ad')}
                            </Badge>
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 mt-2">
                        <InfoRow label={t('orderDetailModal.qty')} value={item.quantity} />
                        <InfoRow label={t('orderDetailModal.lineItemCost')} value={fmtMoney(item.lineItemCost)} />
                        <InfoRow label={t('orderDetailModal.lineItemTotal')} value={fmtMoney(item.total)} />
                        <InfoRow label={t('orderDetailModal.itemId')} value={item.legacyItemId} mono />
                        <InfoRow label={t('orderDetailModal.sku')} value={item.sku} mono />
                        <InfoRow
                          label={t('orderDetailModal.location')}
                          value={[item.itemLocation?.location, item.itemLocation?.countryCode].filter(Boolean).join(', ')}
                        />
                        <InfoRow label={t('orderDetailModal.soldFormat')} value={humanizeEnum(item.soldFormat)} />
                        <InfoRow label={t('orderDetailModal.fulfillmentStatus')} value={humanizeEnum(item.lineItemFulfillmentStatus)} />
                      </div>
                      {(item.taxes || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.taxes.map((tx, i) => (
                            <Badge key={i} tone="neutral" isDark={isDark}>
                              {humanizeEnum(tx.taxType)}: {fmtMoney(tx.amount)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Buyer & shipping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SectionCard icon={User} title={t('orderDetailModal.sectionBuyer')} isDark={isDark}>
                  <InfoRow label={t('orderDetailModal.buyerUsername')} value={order.buyer?.username} />
                  <InfoRow label={t('orderDetailModal.email')} value={order.buyer?.buyerRegistrationAddress?.email} />
                  <InfoRow label={t('orderDetailModal.phone')} value={order.buyer?.buyerRegistrationAddress?.primaryPhone?.phoneNumber} />
                </SectionCard>

                <SectionCard icon={MapPin} title={t('orderDetailModal.sectionShipping')} isDark={isDark}>
                  {shipTo ? (
                    <>
                      <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{shipTo.fullName}</p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {[shipTo.contactAddress?.addressLine1, shipTo.contactAddress?.addressLine2].filter(Boolean).join(', ')}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {[shipTo.contactAddress?.city, shipTo.contactAddress?.stateOrProvince, shipTo.contactAddress?.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p className={`text-xs mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{shipTo.contactAddress?.countryCode}</p>
                    </>
                  ) : null}
                  <InfoRow label={t('orderDetailModal.shippingService')} value={humanizeEnum(shippingStep?.shippingServiceCode)} />
                  <InfoRow
                    label={t('orderDetailModal.estimatedDelivery')}
                    value={
                      fulfillmentInstructions?.minEstimatedDeliveryDate
                        ? `${fmtDate(fulfillmentInstructions.minEstimatedDeliveryDate)} — ${fmtDate(fulfillmentInstructions.maxEstimatedDeliveryDate)}`
                        : null
                    }
                  />
                  <InfoRow
                    label={t('orderDetailModal.shipByDate')}
                    value={fmtDate(order.lineItems?.[0]?.lineItemFulfillmentInstructions?.shipByDate)}
                  />
                </SectionCard>
              </div>

              {/* Payment */}
              <SectionCard icon={CreditCard} title={t('orderDetailModal.sectionPayment')} isDark={isDark}>
                <InfoRow label={t('orderDetailModal.paymentMethod')} value={firstPayment?.paymentMethod} />
                <InfoRow label={t('orderDetailModal.paymentReference')} value={firstPayment?.paymentReferenceId} mono />
                <InfoRow label={t('orderDetailModal.paymentDate')} value={fmtDate(firstPayment?.paymentDate)} />
                {paymentHolds.map((hold, i) => (
                  <div key={i} className={`rounded-lg border p-2.5 mt-2 ${isDark ? 'border-amber-800/60 bg-amber-950/20' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar size={12} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                      <span className={`text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                        {t('orderDetailModal.paymentHold')}: {humanizeEnum(hold.holdState)}
                      </span>
                    </div>
                    <InfoRow label={t('orderDetailModal.holdReason')} value={humanizeEnum(hold.holdReason)} />
                    <InfoRow label={t('orderDetailModal.expectedRelease')} value={fmtDate(hold.expectedReleaseDate)} />
                    <InfoRow label={t('orderDetailModal.actualRelease')} value={fmtDate(hold.releaseDate)} />
                  </div>
                ))}
              </SectionCard>

              {/* Cancellation, only when relevant */}
              {hasCancellation && (
                <SectionCard icon={Ban} title={t('orderDetailModal.sectionCancel')} isDark={isDark}>
                  <InfoRow label={t('orderDetailModal.cancelState')} value={humanizeEnum(cancelStatus.cancelState)} tone="danger" />
                  {(cancelStatus.cancelRequests || []).map((req, i) => (
                    <div key={i} className={i > 0 ? `mt-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}` : ''}>
                      <InfoRow label={t('orderDetailModal.cancelReason')} value={req.cancelReason} />
                      <InfoRow label={t('orderDetailModal.cancelInitiator')} value={req.cancelInitiator} />
                      <InfoRow label={t('orderDetailModal.cancelRequested')} value={fmtDate(req.cancelRequestedDate)} />
                      <InfoRow label={t('orderDetailModal.cancelCompleted')} value={fmtDate(req.cancelCompletedDate)} />
                    </div>
                  ))}
                </SectionCard>
              )}

              {/* Order meta */}
              <SectionCard icon={Hash} title={t('orderDetailModal.sectionMeta')} isDark={isDark}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <InfoRow label={t('orderDetailModal.salesRecordRef')} value={order.salesRecordReference} mono />
                  <InfoRow label={t('orderDetailModal.marketplace')} value={order.lineItems?.[0]?.listingMarketplaceId} />
                  <InfoRow label={t('orderDetailModal.created')} value={fmtDate(order.creationDate)} />
                  <InfoRow label={t('orderDetailModal.modified')} value={fmtDate(order.lastModifiedDate)} />
                  <InfoRow
                    label={t('orderDetailModal.collectAndRemitTax')}
                    value={order.ebayCollectAndRemitTax ? t('orderDetailModal.yes') : t('orderDetailModal.no')}
                  />
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
