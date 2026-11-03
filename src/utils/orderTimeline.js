// Builds the order detail page's timeline from the eBay order plus
// GET /ebay/orders/:orderId/timeline (tracking record, profit entry, cases).
// Stages, in order: ordered → purchased (Amazon) → shipped (tracking on eBay)
// → delivered → profit. Each stage is 'done' | 'current' | 'pending' |
// 'skipped' (order cancelled before reaching it).

export const STAGE_KEYS = ['ordered', 'purchased', 'shipped', 'delivered', 'profit'];

function time(value) {
  if (!value) return null;
  const raw = typeof value === 'object' && !(value instanceof Date) ? value.value : value;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function orderShipBy(order) {
  const times = (order?.lineItems || [])
    .map((line) => time(line?.lineItemFulfillmentInstructions?.shipByDate))
    .filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

export function isOrderCancelled(order) {
  const state = String(order?.cancelStatus?.cancelState || '').toUpperCase();
  return state === 'CANCELED' || state === 'CANCELLED';
}

export function buildOrderTimeline(order, timeline = {}) {
  const tracking = timeline?.tracking || null;
  const profit = timeline?.profit || null;
  const cases = Array.isArray(timeline?.cases) ? timeline.cases : [];
  const cancelled = isOrderCancelled(order);
  const fulfilled = String(order?.orderFulfillmentStatus || '').toUpperCase() === 'FULFILLED';

  const payment = (order?.paymentSummary?.payments || [])[0] || {};
  const payout = num(order?.paymentSummary?.totalDueSeller?.value);
  const amazonCost = num(tracking?.amazonTotalPrice);
  const currency = order?.pricingSummary?.total?.currency || 'USD';

  const purchasedAt = tracking?.amazonOrderId ? time(tracking.createdAt) : null;
  const shippedAt = time(tracking?.ebayUploadedAt) || (fulfilled ? time(order?.lastModifiedDate) : null);
  const delivered = String(tracking?.fulfillmentStatus || '').toLowerCase() === 'delivered';
  const deliveredAt = delivered ? time(tracking?.deliveredMessageSentAt) || time(tracking?.updatedAt) : null;

  const reached = {
    ordered: true,
    purchased: Boolean(tracking?.amazonOrderId) || fulfilled,
    shipped: Boolean(shippedAt) || fulfilled,
    delivered,
    profit: Boolean(profit),
  };

  const stages = STAGE_KEYS.map((key) => ({ key, state: reached[key] ? 'done' : 'pending' }));
  // The first not-reached stage is where the order is now — unless cancelled.
  const firstPending = stages.findIndex((s) => s.state !== 'done');
  if (cancelled) {
    stages.forEach((s) => {
      if (s.state !== 'done') s.state = 'skipped';
    });
  } else if (firstPending >= 0) {
    stages[firstPending].state = 'current';
  }

  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  Object.assign(byKey.ordered, {
    at: time(order?.creationDate),
    paidAt: time(payment?.paymentDate),
    paymentStatus: order?.orderPaymentStatus || null,
  });
  Object.assign(byKey.purchased, {
    at: purchasedAt,
    amazonOrderId: tracking?.amazonOrderId || null,
    amazonCost,
    buyerMessagedAt: time(tracking?.orderedMessageSentAt),
  });
  Object.assign(byKey.shipped, {
    at: shippedAt,
    trackingNumber: tracking?.aquilineTrackingNumber || tracking?.trackingNumber || null,
    early: Boolean(tracking?.aquilineEarlyAssignedAt),
    shipBy: orderShipBy(order),
    buyerMessagedAt: time(tracking?.shippedMessageSentAt),
  });
  const lastEvent = (tracking?.aquilineEvents || []).slice(-1)[0] || null;
  Object.assign(byKey.delivered, {
    at: deliveredAt,
    carrierStatus: tracking?.aquilineStatus || null,
    lastEvent: lastEvent ? { text: lastEvent.content || '', at: time(lastEvent.time), location: lastEvent.location || '' } : null,
    buyerMessagedAt: time(tracking?.deliveredMessageSentAt),
  });

  const estimated = !profit && payout && amazonCost ? Math.round((payout - amazonCost) * 100) / 100 : null;
  Object.assign(byKey.profit, {
    at: profit ? time(profit.createdAt) : null,
    profit: profit ? profit.profit : estimated,
    estimated: !profit && estimated !== null,
    payout: profit ? profit.ebayPayout : payout,
    cost: profit ? profit.amazonPrice : amazonCost,
    currency,
  });

  // Attach each case to the last stage reached before it was opened.
  const caseStageKey = (createdAt) => {
    let key = 'ordered';
    for (const stage of stages) {
      if (stage.state === 'done' && stage.at && createdAt && stage.at <= createdAt) key = stage.key;
    }
    return key;
  };
  for (const stage of stages) stage.cases = [];
  for (const entry of cases) byKey[caseStageKey(entry.createdAt)].cases.push(entry);

  const current = stages.find((s) => s.state === 'current') || null;
  return {
    stages,
    cancelled,
    currentKey: cancelled ? 'cancelled' : current ? current.key : 'complete',
    openCases: cases.filter((c) => c.open).length,
  };
}
