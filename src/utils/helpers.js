// Profit calculation function
// Formula: Profit = SP - (PC + (SP×0.129) + (SP×0.029+0.30)) + 1.45
// SP = eBay selling price (user input)
// PC = Amazon price (user input)

export const calculateProfit = (ebayPrice, amazonPrice) => {
  const SP = parseFloat(ebayPrice) || 0;
  const PC = parseFloat(amazonPrice) || 0;

  if (SP === 0 || PC === 0) return 0;

  const profit = SP - (PC + (SP * 0.129) + (SP * 0.029 + 0.30)) + 1.45;
  return Math.round(profit * 100) / 100; // Round to 2 decimal places
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
