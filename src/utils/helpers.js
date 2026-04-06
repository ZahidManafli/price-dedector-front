/**
 * Profit calculation function (frontend mirror)
 *
 * Conceptual formula:
 * Net Profit = (Sale Price + Shipping)
 *   - (COGS + eBay Final Value Fee + Managed Payment Fee + Ad Fee + Other Costs [+ optional Sales Tax])
 *
 * - `ebayPrice` is treated as the sale price (what the buyer pays for the item itself, before tax & shipping).
 * - `amazonPrice` is treated as COGS (your item cost).
 *
 * Optional `options` parameter:
 * - taxAmount: amount of sales tax collected on the transaction
 * - subtractTax: if true, taxAmount will be subtracted from profit (for sellers who remit tax themselves)
 */
export const calculateProfit = (ebayPrice, amazonPrice, options = {}) => {
  const salePrice = parseFloat(ebayPrice) || 0; // Sale Price
  const cogs = parseFloat(amazonPrice) || 0; // COGS

  // Currently we don't have explicit inputs for these; default to 0.
  const shipping = 0;
  const adFee = 0;
  const otherCosts = 0;

  // Optional tax handling
  const taxAmount = parseFloat(options.taxAmount) || 0;
  const subtractTax = !!options.subtractTax;

  if (salePrice === 0 || cogs === 0) return 0;

  // Fee configuration (keep in sync with backend)
  const FINAL_VALUE_FEE_RATE = 0.129; // 12.9% of (salePrice + shipping)
  const MANAGED_PAYMENT_RATE = 0.027; // 2.7% of (salePrice + shipping)
  const MANAGED_PAYMENT_FIXED = 0.25; // + $0.25 per transaction

  const totalRevenue = salePrice + shipping;
  const finalValueFee = totalRevenue * FINAL_VALUE_FEE_RATE;
  const managedPaymentFee =
    totalRevenue * MANAGED_PAYMENT_RATE + MANAGED_PAYMENT_FIXED;

  let netProfit =
    totalRevenue -
    (cogs + finalValueFee + managedPaymentFee + adFee + otherCosts);

  if (subtractTax && taxAmount > 0) {
    netProfit -= taxAmount;
  }

  return Math.round(netProfit * 100) / 100; // Round to 2 decimal places
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
