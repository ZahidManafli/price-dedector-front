export const TAB_KEYS = {
  DASHBOARD: 'dashboard',
  PRODUCTS: 'products',
  LISTINGS: 'listings',
  ORDERS: 'orders',
  AMAZON_LOOKUP: 'amazon_lookup',
  EBAY_CALCULATOR: 'ebay_calculator',
  MARKET_ANALYSIS: 'market_analysis',
  DEWISO: 'dewiso',
  SETTINGS: 'settings',
  ADMIN: 'admin',
  REFERRALS: 'referrals',
  PARTNERS: 'partners',
  LEARNING: 'learning',
  PROFIT_TABLE: 'profit_table',
  BUYER_CRM: 'buyer_crm',
};

export const USER_DEFAULT_ALLOWED_TABS = [
  TAB_KEYS.DASHBOARD,
  TAB_KEYS.PRODUCTS,
  TAB_KEYS.LISTINGS,
  TAB_KEYS.ORDERS,
  TAB_KEYS.AMAZON_LOOKUP,
  TAB_KEYS.EBAY_CALCULATOR,
  TAB_KEYS.MARKET_ANALYSIS,
  TAB_KEYS.DEWISO,
  TAB_KEYS.SETTINGS,
  TAB_KEYS.LEARNING,
  TAB_KEYS.PROFIT_TABLE,
];

const TAB_ALIASES = {
  profit_table: TAB_KEYS.PROFIT_TABLE,
  'profit-table': TAB_KEYS.PROFIT_TABLE,
  profittable: TAB_KEYS.PROFIT_TABLE,
  dashboard: TAB_KEYS.DASHBOARD,
  products: TAB_KEYS.PRODUCTS,
  listings: TAB_KEYS.LISTINGS,
  orders: TAB_KEYS.ORDERS,
  amazonlookup: TAB_KEYS.AMAZON_LOOKUP,
  amazon_lookup: TAB_KEYS.AMAZON_LOOKUP,
  'amazon-lookup': TAB_KEYS.AMAZON_LOOKUP,
  ebaycalculator: TAB_KEYS.EBAY_CALCULATOR,
  ebay_calculator: TAB_KEYS.EBAY_CALCULATOR,
  'ebay-calculator': TAB_KEYS.EBAY_CALCULATOR,
  marketanalysis: TAB_KEYS.MARKET_ANALYSIS,
  market_analysis: TAB_KEYS.MARKET_ANALYSIS,
  'market-analysis': TAB_KEYS.MARKET_ANALYSIS,
  dewiso: TAB_KEYS.DEWISO,
  settings: TAB_KEYS.SETTINGS,
  admin: TAB_KEYS.ADMIN,
  referral: TAB_KEYS.REFERRALS,
  referal: TAB_KEYS.REFERRALS,
  referrals: TAB_KEYS.REFERRALS,
  referals: TAB_KEYS.REFERRALS,
  partners: TAB_KEYS.PARTNERS,
  buyer_crm: TAB_KEYS.BUYER_CRM,
  buyercrm: TAB_KEYS.BUYER_CRM,
  'buyer-crm': TAB_KEYS.BUYER_CRM,
};

export function normalizeTabKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/\s+/g, '').replace(/[.]/g, '_');
  return TAB_ALIASES[compact] || TAB_ALIASES[raw.toLowerCase()] || null;
}

export function getAllowedTabs(user) {
  if (!user) return USER_DEFAULT_ALLOWED_TABS;
  if (String(user.role || '').toLowerCase() === 'admin') {
    return [...USER_DEFAULT_ALLOWED_TABS, TAB_KEYS.ADMIN, TAB_KEYS.REFERRALS];
  }

  const fromPermissions = user?.permissions?.allowedTabs;
  const fromRoot = user?.allowedTabs;
  const source = Array.isArray(fromPermissions)
    ? fromPermissions
    : Array.isArray(fromRoot)
      ? fromRoot
      : USER_DEFAULT_ALLOWED_TABS;

  const normalized = [];
  for (const item of source) {
    const key = normalizeTabKey(item);
    if (!key || key === TAB_KEYS.ADMIN) continue;
    if (!normalized.includes(key)) normalized.push(key);
  }

  if (!normalized.includes(TAB_KEYS.DASHBOARD)) {
    normalized.unshift(TAB_KEYS.DASHBOARD);
  }

  if (user?.permissions?.referralAdmin && !normalized.includes(TAB_KEYS.REFERRALS)) {
    normalized.push(TAB_KEYS.REFERRALS);
  }

  return normalized;
}

export function hasTabAccess(user, tabKey) {
  const normalized = normalizeTabKey(tabKey);
  if (!normalized) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return true;
  const allowed = getAllowedTabs(user);
  return allowed.includes(normalized);
}
