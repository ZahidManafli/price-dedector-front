import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, User, Receipt, Truck } from 'lucide-react';

export default function OrderDetailPage() {
  const { isDark } = useTheme();
  const location = useLocation();
  const order = location?.state?.order || null;

  const summary = useMemo(() => {
    if (!order) return {};
    const fulfillmentRaw = String(order?.orderFulfillmentStatus || '').toUpperCase();
    const shipmentStatus = fulfillmentRaw === 'NOT_STARTED' ? 'ORDER_CANCELLED' : (fulfillmentRaw || '-');
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

  if (!order) {
    return (
      <div className="page-shell">
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="mb-4">Order details are unavailable. Open this page from the Orders table.</p>
          <Link to="/orders" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Orders
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
          Back
        </Link>
      </div>

      <div className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Order Detail</h1>
        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{summary.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <User size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Buyer</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.buyer}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Email: {buyerDetails.email}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Phone: {buyerDetails.phone}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Product title: {buyerDetails.productTitle}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cancel reason: {buyerDetails.cancelReason}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cancel initiator: {buyerDetails.cancelInitiator}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cancel requested: {buyerDetails.cancelRequestedDate}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cancel completed: {buyerDetails.cancelCompletedDate}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Payment</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.payment}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Truck size={15} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Shipment</p>
          </div>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.shipment}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Order Total</p>
          <p className={`text-xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.total}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created: {summary.created}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last update: {summary.modified}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Line items ({summary.lineItems.length})</p>
          <div className="space-y-2 max-h-36 overflow-auto pr-1">
            {summary.lineItems.map((item) => (
              <div key={item.lineItemId} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title || item.lineItemId}</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Qty: {item.quantity || 0} • {item?.lineItemCost?.value || '-'} {item?.lineItemCost?.currency || ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Shipping & payment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ship to</p>
            <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{shipping.name || '—'}</p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {[shipping.line1, shipping.line2].filter(Boolean).join(' ')}
            </p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', ')}
            </p>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{shipping.country}</p>
            {shipping.phone && (
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Phone: {shipping.phone}</p>
            )}
            {shipping.service && (
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Service: {shipping.service}
              </p>
            )}
          </div>
          <div>
            <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Payment summary</p>
            {paymentSummary.method && (
              <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Method: <span className="font-semibold">{paymentSummary.method}</span>
              </p>
            )}
            {paymentSummary.reference && (
              <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Ref: <span className="font-mono text-xs">{paymentSummary.reference}</span>
              </p>
            )}
            {paymentSummary.totalDue && (
              <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Payout to seller: <span className="font-semibold">{paymentSummary.totalDue}</span>
              </p>
            )}
            {paymentSummary.fees && (
              <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Marketplace fees: <span className="font-semibold">{paymentSummary.fees}</span>
              </p>
            )}
            {paymentSummary.basis && (
              <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Fee basis: <span className="font-semibold">{paymentSummary.basis}</span>
              </p>
            )}
            {paymentSummary.refundedAmount && (
              <p className={`text-xs mt-1 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
                Refunded: {paymentSummary.refundedAmount}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

