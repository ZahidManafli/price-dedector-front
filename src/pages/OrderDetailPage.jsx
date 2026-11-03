import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  Copy,
  CreditCard,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  User,
  Truck,
} from 'lucide-react';
import { ebayAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TAB_KEYS } from '../utils/planAccess';
import { copyAddressToExtension } from '../utils/checkilaExtensionBridge';
import { buildOrderTimeline } from '../utils/orderTimeline';
import { StageStepper, TimelineList, formatMoney } from '../components/order/OrderTimeline';
import { formatLongDateTime } from '../utils/dateFormat';

export default function OrderDetailPage() {
  const { isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const { hasTabAccess } = useAuth();
  const canSeeTracking = hasTabAccess(TAB_KEYS.TRACKING);
  const location = useLocation();
  const { orderId: routeOrderId } = useParams();
  // Orders page passes the order in router state; a direct link (e.g. from the
  // dashboard's Action Center) only has the id, so the order is loaded then.
  const stateOrder = location?.state?.order || null;
  const [order, setOrder] = useState(stateOrder);
  const [orderLoading, setOrderLoading] = useState(!stateOrder && Boolean(routeOrderId));
  const [orderError, setOrderError] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [orderIdCopied, setOrderIdCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tracking, setTracking] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [isRegisteringTracking, setIsRegisteringTracking] = useState(false);
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [isUploadingToEbay, setIsUploadingToEbay] = useState(false);
  const [isSubmittingAmazonOrderId, setIsSubmittingAmazonOrderId] = useState(false);
  const [selectedLineItems, setSelectedLineItems] = useState({});
  const [trackingForm, setTrackingForm] = useState({
    amazonTrackingNumber: '',
    ebayOrderId: '',
    order_number: '',
    destination_country_iso3: '',
    destination_postal_code: '',
    shippedDate: new Date().toISOString(),
  });
  const [manualAmazonOrderId, setManualAmazonOrderId] = useState('');
  const [copyAddressStatus, setCopyAddressStatus] = useState(null); // null | 'copying' | 'success' | 'error' | 'unavailable'

  const summary = useMemo(() => {
    if (!order) return { lineItems: [] };
    const fulfillmentRaw = String(order?.orderFulfillmentStatus || '').toUpperCase();
    const cancellation = order?.cancelStatus || order?.orderCancelStatus || order?.cancellation || {};
    const cancelState = String(cancellation?.cancelState || '').toUpperCase();
    const isCancelled = cancelState === 'CANCELED' || cancelState === 'CANCELLED';
    const shipmentStatus =
      fulfillmentRaw === 'NOT_STARTED' && isCancelled ? 'ORDER_CANCELLED' : (fulfillmentRaw || '-');
    return {
      id: order?.orderId || '-',
      buyer: order?.buyer?.username || '-',
      payment: order?.orderPaymentStatus || '-',
      shipment: shipmentStatus,
      total: order?.pricingSummary?.total?.value
        ? `${order.pricingSummary.total.value} ${order.pricingSummary.total.currency || ''}`.trim()
        : '-',
      created: order?.creationDate ? new Date(order.creationDate).toLocaleString() : '-',
      modified: order?.lastModifiedDate ? new Date(order.lastModifiedDate).toLocaleString() : '-',
      lineItems: order?.lineItems || [],
    };
  }, [order]);

  const buyerDetails = useMemo(() => {
    const buyer = order?.buyer || {};
    const registration = buyer?.buyerRegistrationAddress || {};
    const cancellation = order?.cancelStatus || order?.orderCancelStatus || order?.cancellation || {};
    const cancelRequest =
      (Array.isArray(cancellation?.cancelRequests) && cancellation.cancelRequests[0]) ||
      (Array.isArray(cancellation?.cancellationRequests) && cancellation.cancellationRequests[0]) ||
      {};

    return {
      email: buyer?.email || registration?.email || '-',
      phone:
        registration?.primaryPhone?.phoneNumber ||
        registration?.secondaryPhone?.phoneNumber ||
        buyer?.phoneNumber ||
        '-',
      productTitle: order?.lineItems?.[0]?.title || '-',
      cancelReason: cancelRequest?.cancelReason || cancellation?.cancelReason || '-',
      cancelInitiator: cancelRequest?.cancelInitiator || cancellation?.cancelInitiator || '-',
      cancelRequestedDate:
        cancelRequest?.cancelRequestedDate || cancellation?.cancelRequestedDate || cancellation?.requestDate || '-',
      cancelCompletedDate:
        cancelRequest?.cancelCompletedDate || cancellation?.cancelCompletedDate || cancellation?.completedDate || '-',
    };
  }, [order]);

  const shipping = useMemo(() => {
    const step = order?.fulfillmentStartInstructions?.[0]?.shippingStep;
    const shipTo = step?.shipTo || order?.buyer?.buyerRegistrationAddress;
    return {
      name: shipTo?.fullName || '',
      line1: shipTo?.contactAddress?.addressLine1 || '',
      line2: shipTo?.contactAddress?.addressLine2 || '',
      city: shipTo?.contactAddress?.city || '',
      state: shipTo?.contactAddress?.stateOrProvince || '',
      postalCode: shipTo?.contactAddress?.postalCode || '',
      country: shipTo?.contactAddress?.countryCode || '',
      phone: shipTo?.primaryPhone?.phoneNumber || shipTo?.secondaryPhone?.phoneNumber || '',
      service: step?.shippingServiceCode || '',
    };
  }, [order]);

  const paymentSummary = useMemo(() => {
    const pay = order?.paymentSummary || {};
    const firstPayment = (pay.payments || [])[0] || {};
    const firstRefund = (pay.refunds || [])[0] || {};
    return {
      totalDue: pay?.totalDueSeller?.value
        ? `${pay.totalDueSeller.value} ${pay.totalDueSeller.currency || ''}`.trim()
        : null,
      fees: order?.totalMarketplaceFee?.value
        ? `${order.totalMarketplaceFee.value} ${order.totalMarketplaceFee.currency || ''}`.trim()
        : null,
      basis: order?.totalFeeBasisAmount?.value
        ? `${order.totalFeeBasisAmount.value} ${order.totalFeeBasisAmount.currency || ''}`.trim()
        : null,
      method: firstPayment?.paymentMethod || '',
      reference: firstPayment?.paymentReferenceId || '',
      refundedAmount: firstRefund?.amount?.value
        ? `${firstRefund.amount.value} ${firstRefund.amount.currency || ''}`.trim()
        : null,
    };
  }, [order]);

  const selectedLineItemsPayload = useMemo(() => {
    return summary.lineItems
      .filter((item) => selectedLineItems[item.lineItemId] !== false)
      .map((item) => ({
        lineItemId: item.lineItemId,
        quantity: Number(item.quantity || 1),
      }));
  }, [summary.lineItems, selectedLineItems]);

  const handleTrackingInput = (field, value) => {
    setTrackingForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadTracking = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsLoadingTracking(true);
    setTrackingError('');
    try {
      const response = await ebayAPI.getOrderTracking(summary.id);
      setTracking(response?.data?.tracking || null);
    } catch (error) {
      if (error?.response?.status !== 404) {
        setTrackingError(error?.response?.data?.error || t('orderDetailPage.tracking.loadFailed'));
      }
    } finally {
      setIsLoadingTracking(false);
    }
  };

  const handleRegisterTracking = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsRegisteringTracking(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.registerOrderTracking(summary.id, {
        amazonTrackingNumber: trackingForm.amazonTrackingNumber,
        ebayOrderId: trackingForm.ebayOrderId || summary.id,
        order_number: trackingForm.order_number,
        destination_country_iso3: trackingForm.destination_country_iso3,
        destination_postal_code: trackingForm.destination_postal_code,
      });
      setTracking(response?.data?.tracking || null);
      setTrackingMessage(t('orderDetailPage.tracking.registerSuccess'));
    } catch (error) {
      setTrackingError(error?.response?.data?.error || t('orderDetailPage.tracking.registerFailed'));
    } finally {
      setIsRegisteringTracking(false);
    }
  };

  const handleRefreshTracking = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsRefreshingTracking(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.refreshOrderTracking(summary.id);
      setTracking(response?.data?.tracking || null);
      setTrackingMessage(t('orderDetailPage.tracking.refreshSuccess'));
    } catch (error) {
      setTrackingError(error?.response?.data?.error || t('orderDetailPage.tracking.refreshFailed'));
    } finally {
      setIsRefreshingTracking(false);
    }
  };

  const handleUploadToEbay = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsUploadingToEbay(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.uploadOrderTrackingToEbay(summary.id, {
        trackingNumber: tracking?.aquilineTrackingNumber || tracking?.vdtrackNumber || tracking?.trackingNumber || trackingForm.amazonTrackingNumber,
        shippedDate: trackingForm.shippedDate,
        lineItems: selectedLineItemsPayload,
      });
      setTracking(response?.data?.tracking || tracking || null);
      setTrackingMessage(t('orderDetailPage.tracking.uploadSuccess'));
    } catch (error) {
      setTrackingError(error?.response?.data?.error || t('orderDetailPage.tracking.uploadFailed'));
    } finally {
      setIsUploadingToEbay(false);
    }
  };

  // Fallback for the rare case the extension misses capturing the Amazon order id
  // automatically — the seller pastes it in here. Kicks off the same
  // upsert -> HTML upload (skipped, no HTML here) -> assign pipeline Aquiline-side.
  const handleSubmitAmazonOrderId = async () => {
    if (!summary.id || summary.id === '-' || !manualAmazonOrderId.trim()) return;

    setIsSubmittingAmazonOrderId(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.submitAmazonOrderId(summary.id, {
        amazonOrderId: manualAmazonOrderId.trim(),
        order_number: summary.id,
        destination_country_iso3: trackingForm.destination_country_iso3,
        destination_postal_code: shipping.postalCode,
      });
      setTracking(response?.data?.tracking || null);
      setManualAmazonOrderId('');
      loadTimeline();
      setTrackingMessage(t('orderDetailPage.tracking.amazonOrderIdSuccess', { defaultValue: 'Amazon order synced to Aquiline.' }));
    } catch (error) {
      setTrackingError(
        error?.response?.data?.error ||
          t('orderDetailPage.tracking.amazonOrderIdFailed', { defaultValue: 'Failed to sync Amazon order to Aquiline.' })
      );
    } finally {
      setIsSubmittingAmazonOrderId(false);
    }
  };

  // Bridges the buyer's shipping address to the Checkila browser extension (see
  // extension/bridge.js + extension/background.js's CHECKILA_COPY_ADDRESS handler),
  // which stores it so the "Checkila Fill" button injected into Amazon's delivery
  // address form (extension/amazon_checkila_fill_button.js) can fill it in later.
  // bridge.js only runs on checkila.com/www.checkila.com, so this is a no-op (times
  // out to 'unavailable') when the extension isn't installed.
  const handleCopyAddress = async () => {
    if (!shipping.line1 && !shipping.name) return;

    setCopyAddressStatus('copying');
    const result = await copyAddressToExtension({
      orderId: summary.id !== '-' ? summary.id : null,
      shipTo: {
        fullName: shipping.name,
        phone: shipping.phone,
        addressLine1: shipping.line1,
        addressLine2: shipping.line2,
        city: shipping.city,
        postalCode: shipping.postalCode,
        stateOrProvince: shipping.state,
        country: shipping.country,
      },
    });
    setCopyAddressStatus(result.unavailable ? 'unavailable' : result.success ? 'success' : 'error');
  };

  useEffect(() => {
    if (!order) return;

    const nextSelection = {};
    for (const item of summary.lineItems) {
      nextSelection[item.lineItemId] = true;
    }
    setSelectedLineItems(nextSelection);
    setTrackingForm((prev) => ({
      ...prev,
      ebayOrderId: summary.id !== '-' ? summary.id : '',
      order_number: summary.id !== '-' ? summary.id : '',
      destination_postal_code: shipping.postalCode || '',
      destination_country_iso3: '',
    }));
  }, [order, summary.id, summary.lineItems, shipping.postalCode]);

  useEffect(() => {
    if (stateOrder?.orderId === routeOrderId || !routeOrderId) return undefined;
    let cancelled = false;
    setOrderLoading(true);
    ebayAPI
      .getOrderDetail(routeOrderId)
      .then((res) => {
        if (!cancelled) setOrder(res?.data?.order || null);
      })
      .catch((error) => {
        if (!cancelled) setOrderError(error?.response?.status === 404 ? '' : error?.response?.data?.error || error?.message || '');
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeOrderId, stateOrder?.orderId]);

  const loadTimeline = useCallback(async () => {
    if (!order?.orderId) return;
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const itemIds = (order.lineItems || []).map((item) => item?.legacyItemId).filter(Boolean).join(',');
      const res = await ebayAPI.getOrderTimeline(order.orderId, {
        legacyOrderId: order.legacyOrderId || '',
        itemIds,
        buyer: order?.buyer?.username || '',
      });
      setTimelineData(res?.data || null);
      setTracking(res?.data?.tracking || null);
    } catch (error) {
      setTimelineError(error?.response?.data?.error || error?.message || t('orderTimeline.loadFailed'));
    } finally {
      setTimelineLoading(false);
      setNow(Date.now());
    }
  }, [order, t]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const timeline = useMemo(() => buildOrderTimeline(order, timelineData || {}), [order, timelineData]);

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(summary.id);
      setOrderIdCopied(true);
      setTimeout(() => setOrderIdCopied(false), 1500);
    } catch {
      // clipboard blocked — the id is still visible to copy by hand
    }
  };

  if (orderLoading) {
    return (
      <div className="page-shell">
        <div className={`animate-pulse rounded-2xl border p-6 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
          <div className={`h-4 w-40 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`mt-4 h-7 w-2/3 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`mt-8 h-10 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-shell">
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="mb-4">{orderError || t('orderDetailPage.noOrder.unavailable')}</p>
          <Link to="/orders" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            {t('orderDetailPage.noOrder.backToOrders')}
          </Link>
        </div>
      </div>
    );
  }

  const card = `rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const statusTone = {
    cancelled: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700',
    complete: isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
  }[timeline.currentKey] || (isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700');
  const profitStage = timeline.stages.find((s) => s.key === 'profit');
  const firstTitle = summary.lineItems[0]?.title || summary.id;

  const purchaseAction = canSeeTracking ? (
    <div className={`mt-3 rounded-xl border p-3 ${isDark ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/50'}`}>
      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderTimeline.purchaseHint')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={manualAmazonOrderId}
          onChange={(e) => setManualAmazonOrderId(e.target.value)}
          placeholder={t('orderTimeline.amazonOrderIdPlaceholder')}
          aria-label={t('orderTimeline.amazonOrderId')}
          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-500 ${
            isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
          }`}
        />
        <button
          type="button"
          onClick={handleSubmitAmazonOrderId}
          disabled={isSubmittingAmazonOrderId || !manualAmazonOrderId.trim()}
          className="btn-primary whitespace-nowrap px-4 py-2 text-sm disabled:opacity-50"
        >
          {isSubmittingAmazonOrderId ? t('orderTimeline.linking') : t('orderTimeline.linkAmazonOrder')}
        </button>
      </div>
      {(trackingError || trackingMessage) && (
        <p className={`mt-2 text-xs ${trackingError ? 'text-rose-500' : 'text-emerald-500'}`}>{trackingError || trackingMessage}</p>
      )}
    </div>
  ) : null;

  return (
    <div className="page-shell">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/orders" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          {t('orderDetailPage.back')}
        </Link>
        <a
          href={`https://www.ebay.com/sh/ord/details?orderid=${encodeURIComponent(summary.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {t('orderTimeline.openOnEbay')}
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Hero */}
      <section className={`${card} relative mb-5 overflow-hidden p-5 sm:p-6`}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {t(`orderTimeline.status.${timeline.currentKey}`)}
              </span>
              {timeline.openCases > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                  <AlertTriangle size={12} />
                  {t('orderTimeline.openCases', { count: timeline.openCases })}
                </span>
              )}
            </div>
            <h1 className={`mt-3 line-clamp-2 text-xl font-bold sm:text-2xl ${strong}`}>{firstTitle}</h1>
            <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${muted}`}>
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="inline-flex items-center gap-1.5 font-mono transition hover:text-indigo-500"
                title={t('orderTimeline.copyOrderId')}
              >
                {summary.id}
                {orderIdCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <span className="inline-flex items-center gap-1.5"><User size={14} />{summary.buyer}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatLongDateTime(order?.creationDate, i18n.language) || summary.created}</span>
            </div>
          </div>
          <div className={`shrink-0 rounded-xl border px-4 py-3 lg:text-right ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`text-xs ${muted}`}>{t('orderDetailPage.orderTotal')}</p>
            <p className={`text-2xl font-bold tabular-nums ${strong}`}>{summary.total}</p>
          </div>
        </div>
        <div className={`relative mt-6 border-t pt-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <StageStepper timeline={timeline} isDark={isDark} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Timeline */}
        <section className={`${card} p-5 sm:p-6 lg:col-span-2`} aria-labelledby="order-timeline-title">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="order-timeline-title" className={`text-base font-semibold ${strong}`}>{t('orderTimeline.title')}</h2>
            <button
              type="button"
              onClick={loadTimeline}
              disabled={timelineLoading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <RefreshCw size={13} className={timelineLoading ? 'animate-spin' : ''} />
              {t('orderTimeline.refresh')}
            </button>
          </div>
          {timelineError && (
            <p className={`mb-4 rounded-lg px-3 py-2 text-xs ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{timelineError}</p>
          )}
          <TimelineList timeline={timeline} isDark={isDark} now={now} lang={i18n.language} actions={{ purchase: purchaseAction }} />
        </section>

        {/* Side column */}
        <aside className="space-y-5">
          <section className={`${card} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <CircleDollarSign size={16} className="text-emerald-500" />
              <h2 className={`text-sm font-semibold ${strong}`}>{t('orderTimeline.profitTitle')}</h2>
            </div>
            {profitStage?.profit !== null && profitStage?.profit !== undefined ? (
              <>
                <p className={`text-3xl font-bold tabular-nums ${profitStage.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {profitStage.profit >= 0 ? '+' : ''}{formatMoney(profitStage.profit, profitStage.currency)}
                </p>
                {profitStage.estimated && <p className={`mt-1 text-xs ${muted}`}>{t('orderTimeline.estimatedHint')}</p>}
              </>
            ) : (
              <p className={`text-sm ${muted}`}>{t('orderTimeline.profitPending')}</p>
            )}
            <dl className={`mt-4 space-y-2 border-t pt-3 text-sm ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex justify-between gap-3">
                <dt className={muted}>{t('orderTimeline.ebayPayout')}</dt>
                <dd className={`font-semibold tabular-nums ${strong}`}>{formatMoney(profitStage?.payout, profitStage?.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={muted}>{t('orderTimeline.amazonCost')}</dt>
                <dd className={`font-semibold tabular-nums ${strong}`}>{profitStage?.cost ? `−${formatMoney(profitStage.cost, profitStage.currency)}` : '—'}</dd>
              </div>
              {paymentSummary.fees && (
                <div className="flex justify-between gap-3">
                  <dt className={muted}>{t('orderTimeline.ebayFees')}</dt>
                  <dd className={`tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{paymentSummary.fees}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className={`${card} p-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-indigo-500" />
                <h2 className={`text-sm font-semibold ${strong}`}>{t('orderDetailPage.shipTo')}</h2>
              </div>
              {(shipping.line1 || shipping.name) && (
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  disabled={copyAddressStatus === 'copying'}
                  className="btn-secondary px-2.5 py-1 text-xs"
                >
                  {copyAddressStatus === 'copying' ? t('orderDetailPage.copyingAddress') : t('orderDetailPage.copyAddress')}
                </button>
              )}
            </div>
            <p className={`text-sm font-semibold ${strong}`}>{shipping.name || '—'}</p>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{[shipping.line1, shipping.line2].filter(Boolean).join(' ')}</p>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', ')}</p>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{shipping.country}</p>
            {shipping.phone && <p className={`mt-2 text-xs ${muted}`}>{t('orderDetailPage.phoneLabel')} {shipping.phone}</p>}
            {shipping.service && <p className={`mt-1 text-xs ${muted}`}>{t('orderDetailPage.serviceLabel')} {shipping.service}</p>}
            {copyAddressStatus && copyAddressStatus !== 'copying' && (
              <p className={`mt-2 text-xs ${copyAddressStatus === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {copyAddressStatus === 'success' && t('orderDetailPage.copyAddressSuccess')}
                {copyAddressStatus === 'error' && t('orderDetailPage.copyAddressError')}
                {copyAddressStatus === 'unavailable' && t('orderDetailPage.copyAddressUnavailable')}
              </p>
            )}
            {(buyerDetails.email !== '-' || buyerDetails.phone !== '-') && (
              <div className={`mt-3 space-y-1 border-t pt-3 text-xs ${isDark ? 'border-slate-800' : 'border-slate-100'} ${muted}`}>
                {buyerDetails.email !== '-' && <p>{t('orderDetailPage.email')} {buyerDetails.email}</p>}
                {buyerDetails.phone !== '-' && <p>{t('orderDetailPage.phoneLabel')} {buyerDetails.phone}</p>}
              </div>
            )}
          </section>

          <section className={`${card} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <Package size={16} className="text-violet-500" />
              <h2 className={`text-sm font-semibold ${strong}`}>{t('orderDetailPage.lineItems', { count: summary.lineItems.length })}</h2>
            </div>
            <ul className="space-y-2">
              {summary.lineItems.map((item) => (
                <li key={item.lineItemId} className={`rounded-xl border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`line-clamp-2 text-xs font-semibold ${strong}`}>{item.title || item.lineItemId}</p>
                  <p className={`mt-1 text-xs ${muted}`}>
                    {t('orderDetailPage.qty')} {item.quantity || 0} · {item?.lineItemCost?.value || '-'} {item?.lineItemCost?.currency || ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {(paymentSummary.method || paymentSummary.reference || paymentSummary.refundedAmount || buyerDetails.cancelReason !== '-') && (
            <section className={`${card} p-5 text-sm`}>
              <div className="mb-3 flex items-center gap-2">
                <CreditCard size={16} className="text-sky-500" />
                <h2 className={`text-sm font-semibold ${strong}`}>{t('orderDetailPage.paymentSummary')}</h2>
              </div>
              <dl className="space-y-1.5">
                {paymentSummary.method && (
                  <div className="flex justify-between gap-3"><dt className={muted}>{t('orderDetailPage.method')}</dt><dd className={strong}>{paymentSummary.method}</dd></div>
                )}
                {paymentSummary.reference && (
                  <div className="flex justify-between gap-3"><dt className={muted}>{t('orderDetailPage.ref')}</dt><dd className={`truncate font-mono text-xs ${strong}`}>{paymentSummary.reference}</dd></div>
                )}
                {paymentSummary.refundedAmount && (
                  <div className="flex justify-between gap-3"><dt className="text-rose-500">{t('orderDetailPage.refunded')}</dt><dd className="text-rose-500">{paymentSummary.refundedAmount}</dd></div>
                )}
                {buyerDetails.cancelReason !== '-' && (
                  <div className="flex justify-between gap-3"><dt className={muted}>{t('orderDetailPage.cancelReason')}</dt><dd className={strong}>{buyerDetails.cancelReason}</dd></div>
                )}
              </dl>
            </section>
          )}
        </aside>
      </div>

      {/* {canSeeTracking && (
      <div className={`rounded-2xl border p-4 mt-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          <Truck size={16} />
          {t('orderDetailPage.tracking.title')}
        </h2>

        {(trackingError || trackingMessage) && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${trackingError
            ? isDark
              ? 'border-rose-700 bg-rose-950/50 text-rose-200'
              : 'border-rose-200 bg-rose-50 text-rose-700'
            : isDark
              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
            {trackingError || trackingMessage}
          </div>
        )}

        <div className="space-y-3 mb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className={`block mb-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.tbaLabel')}</span>
              <input
                autoFocus
                value={trackingForm.amazonTrackingNumber}
                onChange={(e) => handleTrackingInput('amazonTrackingNumber', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                placeholder={t('orderDetailPage.tracking.tbaPlaceholder')}
              />
            </label>
            <label className="text-sm">
              <span className={`block mb-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.orderIdAuto')}</span>
              <input
                disabled
                value={trackingForm.ebayOrderId}
                className={`w-full rounded-lg border px-3 py-2 cursor-not-allowed ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'}`}
              />
            </label>
          </div>

          <details className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
            <summary className={`cursor-pointer font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('orderDetailPage.tracking.advancedSummary')}
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.orderNumberLabel')}</span>
                <input
                  value={trackingForm.order_number}
                  onChange={(e) => handleTrackingInput('order_number', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </label>
              <label className="text-sm">
                <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.destinationCountryLabel')}</span>
                <input
                  value={trackingForm.destination_country_iso3}
                  onChange={(e) => handleTrackingInput('destination_country_iso3', e.target.value.toUpperCase())}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder={t('orderDetailPage.tracking.destinationCountryPlaceholder', { defaultValue: 'e.g. USA' })}
                />
              </label>
              <label className="text-sm">
                <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.postalCodeLabel')}</span>
                <input
                  value={trackingForm.destination_postal_code}
                  onChange={(e) => handleTrackingInput('destination_postal_code', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </label>
              <label className="text-sm">
                <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('orderDetailPage.tracking.shippedDateLabel')}</span>
                <input
                  value={trackingForm.shippedDate}
                  onChange={(e) => handleTrackingInput('shippedDate', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder={t('orderDetailPage.tracking.shippedDatePlaceholder')}
                />
              </label>
            </div>
          </details>
        </div>

        <div className="mb-3">
          <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.tracking.selectItems')}</p>
          <div className="space-y-2">
            {summary.lineItems.map((item) => (
                  <label
                key={item.lineItemId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}
              >
                <span className={`text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {item.title || item.lineItemId} ({t('orderDetailPage.qty')} {item.quantity || 0})
                </span>
                <input
                  type="checkbox"
                  checked={selectedLineItems[item.lineItemId] !== false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedLineItems((prev) => ({ ...prev, [item.lineItemId]: checked }));
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRegisterTracking}
            disabled={isRegisteringTracking}
            className="btn-primary"
          >
            {isRegisteringTracking ? t('orderDetailPage.tracking.registering') : t('orderDetailPage.tracking.registerTracking')}
          </button>
          <button
            type="button"
            onClick={handleRefreshTracking}
            disabled={isRefreshingTracking || !tracking}
            className="btn-secondary"
          >
            {isRefreshingTracking ? t('orderDetailPage.tracking.refreshing') : t('orderDetailPage.tracking.refreshTracking')}
          </button>
          <button
            type="button"
            onClick={handleUploadToEbay}
            disabled={isUploadingToEbay || !tracking || selectedLineItemsPayload.length === 0}
            className="btn-secondary"
          >
            {isUploadingToEbay ? t('orderDetailPage.tracking.uploading') : t('orderDetailPage.tracking.uploadToEbay')}
          </button>
          <button
            type="button"
            onClick={loadTracking}
            disabled={isLoadingTracking}
            className="btn-secondary"
          >
            {isLoadingTracking ? t('orderDetailPage.tracking.loading') : t('orderDetailPage.tracking.reloadTracking')}
          </button>
        </div>

        <div className="mt-4">
          {tracking ? (
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.vdtrackNumberLabel', { defaultValue: 'VDTrack Number:' })} <span className="font-semibold">{tracking.vdtrackNumber || '-'}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.vdtrackStatusLabel', { defaultValue: 'VDTrack Status:' })} <span className="font-semibold">{tracking.vdtrackStatus || tracking.statusMessage || '-'}</span>
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('orderDetailPage.tracking.scrapedPageLabel', { defaultValue: 'Scraped page:' })} {tracking.sourceUrl || (tracking.trackingNumber ? `https://www.vdtrack.com/tracker/${tracking.trackingNumber}` : '-')}
              </p>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.statusLabel', { defaultValue: 'Status:' })} <span className="font-semibold">{tracking.statusMessage || '-'}</span>
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('orderDetailPage.tracking.trackingNumberLabel', { defaultValue: 'Tracking:' })} {tracking.trackingNumber || '-'} | {t('orderDetailPage.tracking.slugLabel', { defaultValue: 'Slug:' })} {tracking.slug || '-'}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('orderDetailPage.tracking.lastPollLabel', { defaultValue: 'Last poll:' })} {tracking.lastPolledAt || '-'} | {t('orderDetailPage.tracking.nextPollLabel', { defaultValue: 'Next poll:' })} {tracking.nextPollAt || '-'}
              </p>

              <div className="mt-3 space-y-2 max-h-48 overflow-auto pr-1">
                {(tracking.vdtrackCheckpoints?.length ? tracking.vdtrackCheckpoints : tracking.checkpoints || []).map((checkpoint, idx) => (
                  <div
                    key={`${checkpoint?.checkpoint_time || 'cp'}-${idx}`}
                    className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {checkpoint?.message || checkpoint?.tag || t('orderDetailPage.tracking.checkpointLabel', { defaultValue: 'Checkpoint' })}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {checkpoint?.checkpoint_time || checkpoint?.created_at || checkpoint?.event_time || '-'}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {[checkpoint?.location, checkpoint?.city, checkpoint?.state, checkpoint?.country_iso3].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                ))}
                {(!(tracking.vdtrackCheckpoints?.length) && (!tracking.checkpoints || tracking.checkpoints.length === 0)) && (
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.tracking.noCheckpoints')}</p>
                )}
              </div>
            </div>
          ) : (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('orderDetailPage.tracking.noTracking')}
            </p>
          )}
        </div>

        <div className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {t('orderDetailPage.tracking.aquilineTitle', { defaultValue: 'Aquiline' })}
          </h3>

          {tracking?.amazonOrderId ? (
            <div className="space-y-1 mb-3">
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.amazonOrderIdCapturedLabel', { defaultValue: 'Amazon Order ID:' })}{' '}
                <span className="font-semibold">{tracking.amazonOrderId}</span>
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('orderDetailPage.tracking.aquilineSyncedLabel', { defaultValue: 'Synced to Aquiline:' })}{' '}
                {tracking.aquilineSyncedAt || t('orderDetailPage.tracking.notYet', { defaultValue: 'not yet' })}
                {' · '}
                {t('orderDetailPage.tracking.aquilineHtmlLabel', { defaultValue: 'HTML uploaded:' })}{' '}
                {tracking.aquilineHtmlUploadedAt || t('orderDetailPage.tracking.notYet', { defaultValue: 'not yet' })}
                {' · '}
                {t('orderDetailPage.tracking.aquilineAssignedLabel', { defaultValue: 'Assigned:' })}{' '}
                {tracking.aquilineAssignedAt || t('orderDetailPage.tracking.notYet', { defaultValue: 'not yet' })}
              </p>
            </div>
          ) : (
            <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('orderDetailPage.tracking.awaitingAmazonOrderId', {
                defaultValue: 'No Amazon order captured yet — this fills in automatically once the order is placed via auto-order.',
              })}
            </p>
          )}

          {tracking?.aquilineTrackingNumber && (
            <div className="mb-3">
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.aquilineNumberLabel', { defaultValue: 'Aquiline Tracking Number:' })}{' '}
                <span className="font-semibold">{tracking.aquilineTrackingNumber}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.aquilineStatusLabel', { defaultValue: 'Aquiline Status:' })}{' '}
                <span className="font-semibold">{tracking.aquilineStatus || '-'}</span>
              </p>

              <div className="mt-3 space-y-2 max-h-48 overflow-auto pr-1">
                {(tracking.aquilineEvents || []).map((evt, idx) => (
                  <div
                    key={`${evt?.time || 'evt'}-${idx}`}
                    className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {evt?.content || t('orderDetailPage.tracking.checkpointLabel', { defaultValue: 'Checkpoint' })}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{evt?.time || '-'}</p>
                    {evt?.location && (
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{evt.location}</p>
                    )}
                  </div>
                ))}
                {!(tracking.aquilineEvents || []).length && (
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('orderDetailPage.tracking.noCheckpoints')}
                  </p>
                )}
              </div>
            </div>
          )}

          <details className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
            <summary className={`cursor-pointer font-medium text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('orderDetailPage.tracking.manualAmazonOrderIdSummary', { defaultValue: "Extension missed it? Paste the Amazon order id" })}
            </summary>
            <div className="mt-3 flex flex-wrap gap-2 items-end">
              <label className="text-sm flex-1 min-w-[220px]">
                <span className={`block mb-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('orderDetailPage.tracking.amazonOrderIdLabel', { defaultValue: 'Amazon Order ID' })}
                </span>
                <input
                  value={manualAmazonOrderId}
                  onChange={(e) => setManualAmazonOrderId(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder={t('orderDetailPage.tracking.amazonOrderIdPlaceholder', { defaultValue: 'e.g. 111-2223334-5556667' })}
                />
              </label>
              <button
                type="button"
                onClick={handleSubmitAmazonOrderId}
                disabled={isSubmittingAmazonOrderId || !manualAmazonOrderId.trim()}
                className="btn-primary"
              >
                {isSubmittingAmazonOrderId
                  ? t('orderDetailPage.tracking.aquilineCreating', { defaultValue: 'Syncing…' })
                  : t('orderDetailPage.tracking.aquilineCreate', { defaultValue: 'Sync to Aquiline' })}
              </button>
            </div>
          </details>
        </div>
      </div>
      )} */}
    </div>
  );
}
