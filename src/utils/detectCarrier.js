// Mirrors backend utils/directCarrier.js (number-format part) so the Orders page
// can fill the carrier as the seller types. The backend re-detects on submit and
// is the source of truth.

export function isTbaTrackingNumber(trackingNumber) {
  return /^TBA\d+/i.test(String(trackingNumber || '').trim());
}

export function normalizeTrackingNumber(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

// Aquiline-issued codes look like "AQUAA2323581126YQ".
export function isAquilineTrackingNumber(trackingNumber) {
  return /^AQUA[A-Z0-9]{6,}$/.test(normalizeTrackingNumber(trackingNumber));
}

// Returns 'aquiline' | 'usps' | 'ups' | 'fedex' | null.
export function detectCarrierFromNumber(trackingNumber) {
  const number = normalizeTrackingNumber(trackingNumber);
  if (!number || isTbaTrackingNumber(number)) return null;
  if (isAquilineTrackingNumber(number)) return 'aquiline';
  if (/^1Z[0-9A-Z]{16}$/.test(number)) return 'ups';
  if (/^(9[2-5]\d{20}|9[2-5]\d{24}|82\d{8}|[A-Z]{2}\d{9}US)$/.test(number)) return 'usps';
  if (/^(\d{12}|\d{15}|\d{20}|96\d{20})$/.test(number)) return 'fedex';
  return null;
}

export const CARRIER_LABELS = { aquiline: 'Aquiline', usps: 'USPS', ups: 'UPS', fedex: 'FedEx' };
