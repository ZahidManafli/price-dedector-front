/**
 * Profit calculation function (frontend mirror)
 *
 * Conceptual formula:
 * Net Profit = Sale Price - COGS - [ (Sale Price * (1 + Sales Tax)) * (FVF + Ad Rate) ] - Fixed Fee
 *
 * - `ebayPrice` is treated as the sale price (what the buyer pays for the item itself, before tax & shipping).
 * - `amazonPrice` is treated as COGS (your item cost).
 *
 * Optional `options` parameter:
 * - taxRate: sales tax percentage as a decimal (default 0.06)
 * - fvfRate: final value fee percentage as a decimal (default 0.136)
 * - adRate: promoted listing percentage as a decimal (default 0)
 * - fixedFee: fixed transaction fee in USD (default 0.30)
 */
export const calculateProfit = (ebayPrice, amazonPrice, options = {}) => {
  const salePrice = parseFloat(ebayPrice) || 0; // Sale Price
  const cogs = parseFloat(amazonPrice) || 0; // COGS

  if (salePrice === 0 || cogs === 0) return 0;

  const taxRate = Number.isFinite(Number(options.taxRate)) ? Number(options.taxRate) : 0.06;
  const fvfRate = Number.isFinite(Number(options.fvfRate)) ? Number(options.fvfRate) : 0.136;
  const adRate = Number.isFinite(Number(options.adRate)) ? Number(options.adRate) : 0;
  const fixedFee = Number.isFinite(Number(options.fixedFee)) ? Number(options.fixedFee) : 0.30;

  const grossAmount = salePrice * (1 + taxRate);
  const feeTotal = grossAmount * (fvfRate + adRate) + fixedFee;
  const netProfit = salePrice - cogs - feeTotal;

  return Math.round(netProfit * 100) / 100; // Round to 2 decimal places
};

export const calculateRecommendedEbayPrice = (amazonPrice, targetProfit = 0, options = {}) => {
  const cost = parseFloat(amazonPrice) || 0;
  const desiredProfit = parseFloat(targetProfit) || 0;
  const taxRate = Number.isFinite(Number(options.taxRate)) ? Number(options.taxRate) : 0.06;
  const fvfRate = Number.isFinite(Number(options.fvfRate)) ? Number(options.fvfRate) : 0.136;
  const adRate = Number.isFinite(Number(options.adRate)) ? Number(options.adRate) : 0;
  const fixedFee = Number.isFinite(Number(options.fixedFee)) ? Number(options.fixedFee) : 0.3;

  const denominator = 1 - (1 + taxRate) * (fvfRate + adRate);
  if (cost <= 0 || denominator <= 0) return 0;

  return Math.round(((cost + desiredProfit + fixedFee) / denominator) * 100) / 100;
};

// Format currency
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Format date
export const formatDate = (date) => {
  if (!date) return 'N/A';

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

export const countryCodeToFlagEmoji = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return code
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
};

// Get profit status (profit, loss, neutral)
export const getProfitStatus = (profit) => {
  if (profit > 0) return 'profit';
  if (profit < 0) return 'loss';
  return 'neutral';
};

// Get profit color
export const getProfitColor = (profit) => {
  const status = getProfitStatus(profit);
  if (status === 'profit') return 'text-green-600';
  if (status === 'loss') return 'text-red-600';
  return 'text-gray-600';
};

// Extract product ID from URL (basic)
export const extractProductId = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').pop() || url;
  } catch {
    return url;
  }
};

// Validate URLs
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const extractAmazonAsin = (input) => {
  if (!input || typeof input !== 'string') return '';
  const value = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(value)) return value.toUpperCase();
  const patterns = [
    /\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /[?&]asin=([A-Z0-9]{10})(?:[&#]|$)/i,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  const fallback = value.match(/\b([A-Z0-9]{10})\b/i);
  return fallback?.[1]?.toUpperCase() || '';
};

export const isValidAmazonAsin = (input) => /^[A-Z0-9]{10}$/i.test(String(input || '').trim());

export const buildAmazonProductUrl = (asin) =>
  isValidAmazonAsin(asin) ? `https://www.amazon.com/dp/${String(asin).trim().toUpperCase()}` : '';
