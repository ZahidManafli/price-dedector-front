import { ebayAPI } from '../services/api';

const DATE_PATTERN = /\b\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/;
const INTEGER_PATTERN = /^\d+$/;
const HISTORY_DATE_PATTERN = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})(am|pm)\s+([A-Za-z]{2,5})$/i;
const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isParseableDate(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (DATE_PATTERN.test(text)) return true;
  return !Number.isNaN(Date.parse(text));
}

function parseDateCandidate(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (!text || !isParseableDate(text)) continue;
    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return new Date(timestamp);
  }
  return null;
}

function parseHistoryDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const match = text.match(HISTORY_DATE_PATTERN);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = MONTH_INDEX[String(match[2]).slice(0, 3).toLowerCase()];
    const year = Number.parseInt(match[3], 10);
    let hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    const meridiem = String(match[7]).toLowerCase();
    const tz = String(match[8] || '').toUpperCase();

    if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
      return null;
    }

    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    const offsetHours = tz === 'PST' ? 8 : 7;
    const utcMs = Date.UTC(year, month, day, hour + offsetHours, minute, second);
    return new Date(utcMs);
  }

  const isoLike = text.replace(/\s+at\s+/i, ' ').replace(/(\d)(am|pm)\b/i, '$1 $2');
  const fallback = new Date(isoLike);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseQuantityCandidate(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (!text) continue;
    if (INTEGER_PATTERN.test(text)) {
      return Math.max(0, Number.parseInt(text, 10));
    }
    const match = text.match(/\b(\d+)\b/);
    if (match?.[1]) {
      return Math.max(0, Number.parseInt(match[1], 10));
    }
  }
  return 1;
}

function parseSoldCountCandidate(value) {
  const text = normalizeText(value);
  if (!text) return 1;
  if (INTEGER_PATTERN.test(text)) {
    return Math.max(0, Number.parseInt(text, 10));
  }
  const match = text.match(/\b(\d+)\b/);
  if (match?.[1]) {
    return Math.max(0, Number.parseInt(match[1], 10));
  }
  return 1;
}

function getPurchaseHistoryCacheKey(itemId) {
  const normalizedItemId = normalizeNumericItemId(itemId) || String(itemId || '').trim();
  return normalizedItemId ? `ebayPurchaseHistoryCache:${normalizedItemId}` : '';
}

function persistPurchaseHistoryCache(itemId, rows, meta = {}) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const cacheKey = getPurchaseHistoryCacheKey(itemId);
  if (!cacheKey) return;

  const payload = {
    itemId: normalizeNumericItemId(itemId) || String(itemId || '').trim(),
    rows: Array.isArray(rows) ? rows : [],
    soldQuantity7d: Number.isFinite(meta.soldQuantity7d)
      ? Number(meta.soldQuantity7d)
      : calculateLast7DaysSoldCount(rows),
    scrapedAt: meta.scrapedAt || new Date().toISOString(),
    expiresAt: meta.expiresAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    source: meta.source || 'extension-scrape',
  };

  window.localStorage.setItem(cacheKey, JSON.stringify(payload));
}

export function normalizeNumericItemId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{8,}$/.test(raw)) return raw;
  const parts = raw.split('|');
  if (parts.length >= 2 && /^\d{8,}$/.test(parts[1])) return parts[1];
  const match = raw.match(/\/itm\/(?:[^/]+\/)?(\d{8,})/);
  return match?.[1] ? String(match[1]) : '';
}

export function normalizePurchaseHistoryRow(row) {
  const buyer    = normalizeText(row?.buyer);
  const quantity = parseQuantityCandidate(row?.quantity, row?.price);    // ✅ Quantity from quantity or price field
  const soldAt   = parseHistoryDate(row?.date) || parseDateCandidate(row?.date); // ✅ Timestamp from date field
  const price    = normalizeText(row?.price || row?.quantity);         // ✅ Price text from price field when available

  return {
    buyer,
    quantity,
    date: soldAt ? soldAt.toLocaleString() : normalizeText(row?.date),
    price,
    soldAt,
  };
}

export function calculateLast7DaysSoldCount(rows, now = Date.now()) {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  return (Array.isArray(rows) ? rows : []).reduce((total, row) => {
    const normalized = normalizePurchaseHistoryRow(row);
    if (!normalized.soldAt || normalized.soldAt.getTime() < cutoff) {
      return total;
    }
    return total + normalized.quantity; // ✅ Add the parsed quantity
  }, 0);
}

export async function fetchPurchaseHistoryRows(itemId, { maxAttempts = 15, pollIntervalMs = 2000 } = {}) {
  const response = await ebayAPI.post('/ebay/extension-scrape', { itemId });
  const initialData = response?.data || {};

  if (initialData?.status === 'done' && Array.isArray(initialData?.data)) {
    persistPurchaseHistoryCache(itemId, initialData.data, initialData);
    return initialData.data;
  }

  const jobId = initialData?.jobId;
  if (!jobId) {
    throw new Error('Missing jobId from backend');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const pollRes = await ebayAPI.get(`/ebay/extension-scrape/${encodeURIComponent(jobId)}`);
    const { status, data, error } = pollRes?.data || {};

    if (status === 'done') {
      const rows = Array.isArray(data) ? data : [];
      persistPurchaseHistoryCache(itemId, rows, pollRes?.data || {});
      return rows;
    }

    if (status === 'error') {
      throw new Error(error || 'Scrape failed');
    }
  }

  throw new Error('Extension did not respond in time. Make sure the extension is installed and logged in.');
}
