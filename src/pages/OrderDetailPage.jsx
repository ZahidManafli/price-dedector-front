import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Receipt, Truck } from 'lucide-react';
import { ebayAPI } from '../services/api';

export default function OrderDetailPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const order = location?.state?.order || null;
  const [tracking, setTracking] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [isRegisteringTracking, setIsRegisteringTracking] = useState(false);
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [isUploadingToEbay, setIsUploadingToEbay] = useState(false);
  const [isCreatingAquiline, setIsCreatingAquiline] = useState(false);
  const [isCancelingAquiline, setIsCancelingAquiline] = useState(false);
  const [selectedLineItems, setSelectedLineItems] = useState({});
  const [trackingForm, setTrackingForm] = useState({
    amazonTrackingNumber: '',
    ebayOrderId: '',
    order_number: '',
    destination_country_iso3: '',
    destination_postal_code: '',
    shippedDate: new Date().toISOString(),
  });
  const [aquilineForm, setAquilineForm] = useState({
    amazonOrderId: '',
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    city: '',
    postalCode: '',
    countryCode: '',
  });

  const summary = useMemo(() => {
    if (!order) return {};
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

  const handleAquilineInput = (field, value) => {
    setAquilineForm((prev) => ({ ...prev, [field]: value }));
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

  const handleCreateAquilineShipment = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsCreatingAquiline(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.createAquilineShipment(summary.id, {
        amazonOrderId: aquilineForm.amazonOrderId,
        ebayOrderId: summary.id,
        order_number: summary.id,
        recipientName: aquilineForm.recipientName,
        recipientPhone: aquilineForm.recipientPhone,
        addressLine1: aquilineForm.addressLine1,
        city: aquilineForm.city,
        postalCode: aquilineForm.postalCode,
        countryCode: aquilineForm.countryCode,
      });
      setTracking(response?.data?.tracking || null);
      setTrackingMessage(t('orderDetailPage.tracking.aquilineCreateSuccess', { defaultValue: 'Aquiline shipment created.' }));
    } catch (error) {
      setTrackingError(
        error?.response?.data?.error ||
          t('orderDetailPage.tracking.aquilineCreateFailed', { defaultValue: 'Failed to create Aquiline shipment.' })
      );
    } finally {
      setIsCreatingAquiline(false);
    }
  };

  const handleCancelAquilineShipment = async () => {
    if (!summary.id || summary.id === '-') return;

    setIsCancelingAquiline(true);
    setTrackingError('');
    setTrackingMessage('');
    try {
      const response = await ebayAPI.cancelAquilineShipment(summary.id);
      setTracking(response?.data?.tracking || tracking || null);
      setTrackingMessage(t('orderDetailPage.tracking.aquilineCancelSuccess', { defaultValue: 'Aquiline shipment cancelled.' }));
    } catch (error) {
      setTrackingError(
        error?.response?.data?.error ||
          t('orderDetailPage.tracking.aquilineCancelFailed', { defaultValue: 'Failed to cancel Aquiline shipment.' })
      );
    } finally {
      setIsCancelingAquiline(false);
    }
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
    setAquilineForm((prev) => ({
      ...prev,
      recipientName: prev.recipientName || shipping.name || '',
      recipientPhone: prev.recipientPhone || shipping.phone || '',
      addressLine1: prev.addressLine1 || shipping.line1 || '',
      city: prev.city || shipping.city || '',
      postalCode: prev.postalCode || shipping.postalCode || '',
      countryCode: prev.countryCode || shipping.country || '',
    }));
  }, [order, summary.id, summary.lineItems, shipping.postalCode, shipping.name, shipping.phone, shipping.line1, shipping.city, shipping.country]);

  useEffect(() => {
    loadTracking();
  }, [summary.id]);

  if (!order) {
    return (
      <div className="page-shell">
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="mb-4">{t('orderDetailPage.noOrder.unavailable')}</p>
          <Link to="/orders" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            {t('orderDetailPage.noOrder.backToOrders')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-4">
        <Link to="/orders" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          {t('orderDetailPage.back')}
        </Link>
      </div>

      <div className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('orderDetailPage.title')}</h1>
        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{summary.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <User size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.buyer')}</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.buyer}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.email')} {buyerDetails.email}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.phoneLabel')} {buyerDetails.phone}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.productTitle')} {buyerDetails.productTitle}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.cancelReason')} {buyerDetails.cancelReason}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.cancelInitiator')} {buyerDetails.cancelInitiator}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.cancelRequested')} {buyerDetails.cancelRequestedDate}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('orderDetailPage.cancelCompleted')} {buyerDetails.cancelCompletedDate}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.payment')}</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.payment}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2">
            <Truck size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.shipment')}</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.shipment}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.orderTotal')}</p>
          <p className={`text-xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.total}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.created')} {summary.created}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.modified')} {summary.modified}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.lineItems', { count: summary.lineItems.length })}</p>
          <div className="space-y-2 max-h-36 overflow-auto pr-1">
            {summary.lineItems.map((item) => (
              <div key={item.lineItemId} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title || item.lineItemId}</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('orderDetailPage.qty')} {item.quantity || 0} • {item?.lineItemCost?.value || '-'} {item?.lineItemCost?.currency || ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('orderDetailPage.shippingAndPayment')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.shipTo')}</p>
            <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{shipping.name || '—'}</p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {[shipping.line1, shipping.line2].filter(Boolean).join(' ')}
            </p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', ')}
            </p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{shipping.country}</p>
            {shipping.phone && (
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.phoneLabel')} {shipping.phone}</p>
            )}
            {shipping.service && (
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('orderDetailPage.serviceLabel')} {shipping.service}
              </p>
            )}
          </div>
          <div>
            <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('orderDetailPage.paymentSummary')}</p>
            {paymentSummary.method && (
                <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.method')} <span className="font-semibold">{paymentSummary.method}</span>
              </p>
            )}
            {paymentSummary.reference && (
                <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.ref')} <span className="font-mono text-xs">{paymentSummary.reference}</span>
              </p>
            )}
            {paymentSummary.totalDue && (
                <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.payout')} <span className="font-semibold">{paymentSummary.totalDue}</span>
              </p>
            )}
            {paymentSummary.fees && (
                <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.marketplaceFees')} <span className="font-semibold">{paymentSummary.fees}</span>
              </p>
            )}
            {paymentSummary.basis && (
                <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.feeBasis')} <span className="font-semibold">{paymentSummary.basis}</span>
              </p>
            )}
            {paymentSummary.refundedAmount && (
                <p className={`text-xs mt-1 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
                {t('orderDetailPage.refunded')} {paymentSummary.refundedAmount}
              </p>
            )}
          </div>
        </div>
      </div>

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

        {/* ── Aquiline shipment creation ── */}
        <div className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {t('orderDetailPage.tracking.aquilineTitle', { defaultValue: 'Aquiline Shipment' })}
          </h3>

          <div className="space-y-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className={`block mb-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('orderDetailPage.tracking.amazonOrderIdLabel', { defaultValue: 'Amazon Order ID' })}
                </span>
                <input
                  value={aquilineForm.amazonOrderId}
                  onChange={(e) => handleAquilineInput('amazonOrderId', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder={t('orderDetailPage.tracking.amazonOrderIdPlaceholder', { defaultValue: 'e.g. 111-2223334-5556667' })}
                />
              </label>
              <label className="text-sm">
                <span className={`block mb-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('orderDetailPage.tracking.recipientNameLabel', { defaultValue: 'Recipient name' })}
                </span>
                <input
                  value={aquilineForm.recipientName}
                  onChange={(e) => handleAquilineInput('recipientName', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </label>
            </div>

            <details className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
              <summary className={`cursor-pointer font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('orderDetailPage.tracking.aquilineAddressSummary', { defaultValue: 'Recipient address (pre-filled from eBay)' })}
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('orderDetailPage.tracking.recipientPhoneLabel', { defaultValue: 'Phone' })}
                  </span>
                  <input
                    value={aquilineForm.recipientPhone}
                    onChange={(e) => handleAquilineInput('recipientPhone', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </label>
                <label className="text-sm">
                  <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('orderDetailPage.tracking.addressLine1Label', { defaultValue: 'Address line 1' })}
                  </span>
                  <input
                    value={aquilineForm.addressLine1}
                    onChange={(e) => handleAquilineInput('addressLine1', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </label>
                <label className="text-sm">
                  <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('orderDetailPage.tracking.cityLabel', { defaultValue: 'City' })}
                  </span>
                  <input
                    value={aquilineForm.city}
                    onChange={(e) => handleAquilineInput('city', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </label>
                <label className="text-sm">
                  <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('orderDetailPage.tracking.postalCodeLabel')}
                  </span>
                  <input
                    value={aquilineForm.postalCode}
                    onChange={(e) => handleAquilineInput('postalCode', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </label>
                <label className="text-sm">
                  <span className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('orderDetailPage.tracking.countryCodeLabel', { defaultValue: 'Country code (ISO-2)' })}
                  </span>
                  <input
                    value={aquilineForm.countryCode}
                    onChange={(e) => handleAquilineInput('countryCode', e.target.value.toUpperCase())}
                    className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                    placeholder="US"
                  />
                </label>
              </div>
            </details>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateAquilineShipment}
              disabled={isCreatingAquiline || !aquilineForm.amazonOrderId}
              className="btn-primary"
            >
              {isCreatingAquiline
                ? t('orderDetailPage.tracking.aquilineCreating', { defaultValue: 'Creating…' })
                : t('orderDetailPage.tracking.aquilineCreate', { defaultValue: 'Create Aquiline Shipment' })}
            </button>
            <button
              type="button"
              onClick={handleCancelAquilineShipment}
              disabled={isCancelingAquiline || !tracking?.aquilineShipmentId}
              className="btn-secondary"
            >
              {isCancelingAquiline
                ? t('orderDetailPage.tracking.aquilineCanceling', { defaultValue: 'Cancelling…' })
                : t('orderDetailPage.tracking.aquilineCancel', { defaultValue: 'Cancel Aquiline Shipment' })}
            </button>
          </div>

          {tracking?.aquilineTrackingNumber && (
            <div className="mt-4">
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.aquilineNumberLabel', { defaultValue: 'Aquiline Tracking Number:' })}{' '}
                <span className="font-semibold">{tracking.aquilineTrackingNumber}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {t('orderDetailPage.tracking.aquilineStatusLabel', { defaultValue: 'Aquiline Status:' })}{' '}
                <span className="font-semibold">{tracking.aquilineStatus || '-'}</span>
              </p>
              {tracking.aquilineLabelUrl && (
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <a href={tracking.aquilineLabelUrl} target="_blank" rel="noreferrer" className="underline">
                    {t('orderDetailPage.tracking.aquilineLabelLink', { defaultValue: 'View shipping label' })}
                  </a>
                </p>
              )}

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
        </div>
      </div>
    </div>
  );
}

