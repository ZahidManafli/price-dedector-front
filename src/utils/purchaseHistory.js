import { ebayAPI } from '../services/api';

const DATE_PATTERN = /\b\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/;
const INTEGER_PATTERN = /^\d+$/;

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
  const buyer = normalizeText(row?.buyer);
  const quantity = parseQuantityCandidate(row?.date, row?.quantity, row?.price);
  const soldAt = parseDateCandidate(row?.price, row?.date, row?.quantity);
  const price = normalizeText(row?.quantity || row?.price);

  return {
    buyer,
    quantity,
    date: soldAt ? soldAt.toLocaleString() : normalizeText(row?.price || row?.date),
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
    return total + Math.max(0, Number(normalized.quantity || 0));
  }, 0);
}

export async function fetchPurchaseHistoryRows(itemId, { maxAttempts = 15, pollIntervalMs = 2000 } = {}) {
  const response = await ebayAPI.post('/ebay/extension-scrape', { itemId });
  const jobId = response?.data?.jobId;
  if (!jobId) {
    throw new Error('Missing jobId from backend');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const pollRes = await ebayAPI.get(`/ebay/extension-scrape/${encodeURIComponent(jobId)}`);
    const { status, data, error } = pollRes?.data || {};

    if (status === 'done') {
      return Array.isArray(data) ? data : [];
    }

    if (status === 'error') {
      throw new Error(error || 'Scrape failed');
    }
  }

  throw new Error('Extension did not respond in time. Make sure the extension is installed and logged in.');
}
