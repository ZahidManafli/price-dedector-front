import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests and enforce auth presence for protected routes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  const url = config?.url || '';
  const isAuthOrPublic =
    url.startsWith('/auth') ||
    url.startsWith('/health') ||
    url.startsWith('/referrals/public') ||
    url.startsWith('/settings/plans/public') ||
    url.startsWith('/settings/currency-rates') ||
    url === '/settings/subscription-requests' ||
    url === '/settings/subscription-requests/verify' ||
    url.startsWith('/settings/subscription-requests/update-credits') ||
    url.startsWith('/settings/subscription-requests/reset-credits') ||
    url.startsWith('/api/partners/public') ||
    url.includes('/privacy') ||
    url.includes('/about');

  if (!token && !isAuthOrPublic) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    // Prevent request from going out
    return Promise.reject(new Error('No auth token present'));
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401 / invalid token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const isMaintenance = status === 503 && code === 'MAINTENANCE_MODE';
    if (status === 401) {
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } catch {}
      if (typeof window !== 'undefined') window.location.href = '/login';
    } else if (isMaintenance) {
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } catch {}
      if (typeof window !== 'undefined' && window.location.pathname !== '/maintenance') {
        window.location.href = '/maintenance';
      }
    } else if (status === 403 && code === 'PLAN_TAB_ACCESS_DENIED') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/dashboard') {
        window.location.href = '/dashboard';
      }
    } else if (status === 403 && code === 'PLAN_EXPIRED') {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (path && path !== '/plan-expired' && path !== '/upgrade-plan') {
        window.location.href = '/plan-expired';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  signup: (email, password, name, referralSlug = '') =>
    api.post('/auth/signup', { email, password, name, referralSlug }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  updateOnboardingTourState: (state) => api.post('/auth/onboarding-tour/state', { state }),
  logout: () => api.post('/auth/logout'),
  verifyToken: () => api.get('/auth/verify'),
  getMaintenanceStatus: () => api.get('/auth/maintenance-status'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
};

// Product APIs
export const productAPI = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/products/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/products/${id}`),
  getPriceHistory: (id) => api.get(`/products/${id}/history`),
  comparePrice: (id) => api.get(`/products/${id}/compare`),
};

// Settings APIs
export const settingsAPI = {
  getPreferences: () => api.get('/settings/preferences'),
  updatePreferences: (data) => api.put('/settings/preferences', data),
  getLimits: () => api.get('/settings/limits'),
  getPublicPlans: () => api.get('/settings/plans/public'),
  getPublicData: () => api.get('/settings/public-data'),
  getCurrencyRates: () => api.get('/settings/currency-rates'),
  submitSubscriptionRequest: (data) => api.post('/settings/subscription-requests', data),
  verifySubscriptionRequest: (data) => api.post('/settings/subscription-requests/verify', data),
  submitUpdateCreditRequest: (data) => api.post('/settings/subscription-requests/update-credits', data),
  submitResetCreditsRequest: (data) => api.post('/settings/subscription-requests/reset-credits', data),
};

export const ebayAPI = {
  get: (...args) => api.get(...args),
  post: (...args) => api.post(...args),
  getConnectUrl: () => api.get('/ebay/connect'),
  completeCallback: (code, state) => api.post('/ebay/callback', { code, state }),
  getStatus: () => api.get('/ebay/status'),
  setActiveAccount: (ebayAccountId) => api.patch('/ebay/active-account', { ebayAccountId }),
  setAccountName: (ebayAccountId, connectionName) =>
    api.patch(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}/name`, { connectionName }),
  disconnectAccount: (ebayAccountId) => api.patch(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}/disconnect`),
  deleteAccount: (ebayAccountId) => api.delete(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}`),
  refreshAccountToken: (ebayAccountId) => api.post(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}/refresh-token`),
  disconnect: () => api.delete('/ebay/disconnect'),
  getListings: (offset = 0, limit = 25, options = {}) =>
    api.get('/ebay/listings', {
      params: {
        offset,
        limit,
        ...(options?.refresh ? { refresh: 1 } : {}),
      },
    }),
  deleteListing: (listingId, params = {}) =>
    api.delete(`/ebay/listings/${encodeURIComponent(listingId)}`, { params }),
  sendDeadStockNotify: () => api.post('/ebay/dead-stock/notify'),
  updateListing: (listingId, payload) => api.patch(`/ebay/listings/${listingId}`, payload),
  getListingAutoStockRule: (listingId) => api.get(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`),
  saveListingAutoStockRule: (listingId, payload) =>
    api.put(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`, payload),
  deleteListingAutoStockRule: (listingId) =>
    api.delete(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`),
  getListingFeedback: (listingId, params = {}) =>
    api.get(`/ebay/listings/${encodeURIComponent(listingId)}/feedback`, { params }),
  respondToListingFeedback: (listingId, payload) =>
    api.post(`/ebay/listings/${encodeURIComponent(listingId)}/feedback/respond`, payload),
  getOrderConversations: (params = {}) =>
    api.get('/ebay/messages', { params }),
  getConversationMessages: (conversationId, params = {}) =>
    api.get(`/ebay/messages/${encodeURIComponent(conversationId)}`, { params }),
  sendMessage: (payload) => api.post('/ebay/messages', payload),
  updateConversation: (payload) => api.post('/ebay/messages/update', payload),
  createListingDraft: (payload) => api.post('/ebay/listing/draft', payload),
  updateListingDraft: (draftId, payload) => api.patch(`/ebay/listing/draft/${encodeURIComponent(draftId)}`, payload),
  submitListingDraft: (draftId) => api.post('/ebay/listing/submit', { draftId }),
  sellSimilar: (listingId) => api.post('/ebay/listing/sell-similar', { listingId }),
  getDashboardAnalytics: () => api.get('/ebay/analytics/dashboard'),
  getOrders: (offsetOrOptions = 0, limit = 25, options = {}) => {
    const usingOptionsOnly = typeof offsetOrOptions === 'object' && offsetOrOptions !== null;
    const requestOptions = usingOptionsOnly ? offsetOrOptions : options;
    const params = {
      ...(requestOptions?.refresh ? { refresh: 1 } : {}),
      ...(requestOptions?.next ? { next: requestOptions.next } : {}),
    };

    if (!requestOptions?.next && !usingOptionsOnly) {
      params.offset = offsetOrOptions;
      params.limit = limit;
    }

    return api.get('/ebay/orders', { params });
  },
  getOrderTracking: (orderId) => api.get(`/ebay/orders/${encodeURIComponent(orderId)}/tracking`),
  registerOrderTracking: (orderId, payload) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/register`, payload),
  refreshOrderTracking: (orderId) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/refresh`),
  uploadOrderTrackingToEbay: (orderId, payload) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/upload-ebay`, payload),
  scrapeItemDetails: (url) => api.post('/ebay/scrape-item-details', { url }),
  quickList: (payload) => api.post('/ebay/quick-list', payload),
  listSavedSellers: () => api.get('/ebay/saved-sellers'),
  toggleSavedSeller: (sellerName) => api.post('/ebay/saved-sellers/toggle', { sellerName }),
};

export const browseAPI = {
  search: (params = {}) => api.get('/ebay/browse/search', { params }),
  getSoldQuantity: (payload) => api.post('/ebay/browse/sold-quantity', payload),
  getItem: (itemId, fieldgroups = '') =>
    api.get(`/ebay/browse/item/${encodeURIComponent(itemId)}`, {
      params: fieldgroups ? { fieldgroups } : undefined,
    }),
  getItemByLegacy: (legacyItemId, fieldgroups = '') =>
    api.get(`/ebay/browse/item-by-legacy/${encodeURIComponent(legacyItemId)}`, {
      params: fieldgroups ? { fieldgroups } : undefined,
    }),
  getSellHistory: (itemId, params = {}) =>
    api.get(`/ebay/browse/item/${encodeURIComponent(itemId)}/sell-history`, { params }),
  getRefinements: (categoryId, q, limit = 20) =>
    api.get(`/ebay/browse/refinements/${encodeURIComponent(categoryId)}`, {
      params: { q, limit },
    }),
  searchByImage: (payload) => api.post('/ebay/browse/search-by-image', payload),
};

// Amazon lookup (title, description, images, and price)
export const amazonAPI = {
  lookup: (amazonAsin) => api.post('/amazon/lookup', { amazonAsin }),
  getHistory: (limit = 20) => api.get(`/amazon/history?limit=${limit}`),
};

// Amazon OAuth (Login with Amazon)
export const amazonOAuthAPI = {
  getConnectUrl: () => api.get('/amazon/oauth/connect'),
  completeCallback: (code, state) => api.post('/amazon/oauth/callback', { code, state }),
  getStatus: () => api.get('/amazon/oauth/status'),
  disconnect: () => api.post('/amazon/oauth/disconnect'),
  getAccessToken: () => api.post('/amazon/oauth/access-token'),
};

export const dewisoAPI = {
  getHistory: (limit = 20) => api.get('/dewiso/history', { params: { limit } }),
  saveHistory: (payload) => api.post('/dewiso/history', payload),
  uploadImages: (formData) =>
    api.post('/dewiso/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Admin APIs
export const adminAPI = {
  listUsers: () => api.get('/admin/users'),
  blockUser: (userId, reason) => api.post(`/admin/users/${userId}/block`, { block: true, reason }),
  unblockUser: (userId) => api.post(`/admin/users/${userId}/block`, { block: false }),
  getUserIpHistory: (userId) => api.get(`/admin/users/${userId}/ip-history`),
  getStats: () => api.get('/admin/stats'),
  getEbayRateLimits: () => api.get('/admin/ebay/rate-limits'),
  createUser: (data) => api.post('/admin/users', data),
  updateUserLimits: (id, data) => api.put(`/admin/users/${id}/limits`, data),
  refreshSubscriptions: (data) => api.post('/admin/users/refresh-subscriptions', data),
  deleteUsers: (data) => api.post('/admin/users/delete', data),
  listPlans: () => api.get('/admin/plans'),
  createPlan: (data) => api.post('/admin/plans', data),
  updatePlan: (id, data) => api.put(`/admin/plans/${id}`, data),
  listSubscriptionRequests: (status) =>
    api.get('/admin/subscription-requests', { params: status ? { status } : undefined }),
  approveSubscriptionRequest: (id, data) => api.post(`/admin/subscription-requests/${id}/approve`, data),
  rejectSubscriptionRequest: (id, data) => api.post(`/admin/subscription-requests/${id}/reject`, data),
  purgeSearchCache: (data) => api.post('/admin/search-cache/purge', data),
  // notifications
  listNotifications: () => api.get('/admin/notifications'),
  // admin sen dnotification
  sendNotification: (data) => api.post('/admin/notifications/send', data),
  listMaintenanceWindows: () => api.get('/admin/maintenance'),
  createMaintenanceWindow: (data) => api.post('/admin/maintenance', data),
  updateMaintenanceFlag: (data) => api.patch('/admin/maintenance/flag', data),
  // Zik accounts management
  listZikAccounts: () => api.get('/admin/zik-accounts'),
  createZikAccount: (data) => api.post('/admin/zik-accounts', data),
  updateZikAccount: (id, data) => api.put(`/admin/zik-accounts/${encodeURIComponent(id)}`, data),
  deleteZikAccount: (id) => api.delete(`/admin/zik-accounts/${encodeURIComponent(id)}`),
  setActiveZikAccount: (id) => api.post(`/admin/zik-accounts/${encodeURIComponent(id)}/set-active`),
  listReferrals: () => api.get('/admin/referrals'),
  getReferral: (id) => api.get(`/admin/referrals/${encodeURIComponent(id)}`),
  createReferral: (data) => api.post('/admin/referrals', data),
  updateReferral: (id, data) => api.put(`/admin/referrals/${encodeURIComponent(id)}`, data),
  deleteReferral: (id) => api.delete(`/admin/referrals/${encodeURIComponent(id)}`),
  addReferralUser: (id, data) => api.post(`/admin/referrals/${encodeURIComponent(id)}/users`, data),
  removeReferralUser: (id, userId) => api.delete(`/admin/referrals/${encodeURIComponent(id)}/users/${encodeURIComponent(userId)}`),
  recordReferralPayout: (id, data) => api.post(`/admin/referrals/${encodeURIComponent(id)}/payouts`, data),
  getSignups: (range) => api.get('/admin/analytics/signups', { params: { range } }),
  getExpectedRenewals: () => api.get('/admin/analytics/expected-renewals'),
  listExpenses: () => api.get('/admin/expenses'),
  createExpense: (data) => api.post('/admin/expenses', data),
  deleteExpense: (id) => api.delete(`/admin/expenses/${id}`),
  payExpense: (id) => api.post(`/admin/expenses/${id}/pay`),
  getBalance: () => api.get('/admin/balance'),
  updateBalance: (balance) => api.put('/admin/balance', { balance }),
};

export const referralAPI = {
  getPublicBySlug: (slug) => api.get(`/referrals/public/${encodeURIComponent(slug)}`),
  getMe: () => api.get('/referrals/me'),
};

export const maintenanceAPI = {
  getStatus: () => api.get('/auth/maintenance-status'),
};

export const profitAPI = {
  list: (range) => api.get('/profits', { params: range ? { range } : {} }),
  create: (data) => api.post('/profits', data),
  remove: (id) => api.delete(`/profits/${id}`),
  recentOrderIds: () => api.get('/profits/recent-order-ids'),
};

// Partners APIs
export const partnerAPI = {
  getPublic: () => api.get('/api/partners/public'),
  getAll: () => api.get('/api/partners'),
  getById: (id) => api.get(`/api/partners/${id}`),
  create: (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.website_url !== undefined) formData.append('website_url', data.website_url);
    if (data.display_order !== undefined) formData.append('display_order', data.display_order);
    if (data.logo) formData.append('logo', data.logo);
    return api.post('/api/partners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.website_url !== undefined) formData.append('website_url', data.website_url);
    if (data.display_order !== undefined) formData.append('display_order', data.display_order);
    if (data.logo) formData.append('logo', data.logo);
    return api.put(`/api/partners/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/api/partners/${id}`),
  toggleStatus: (id, is_active) => api.patch(`/api/partners/${id}/status`, { is_active }),
};

export const zikAPI = {
  requestMarketInsights: () => api.get('/zik/market-insights'),
  requestAmazonFinder: (asin, ebayId) => api.get('/zik/amazon-finder', { params: { asin, ebayId } }),
  requestUpcomingEvents: (globalId = 'US') => api.get('/zik/upcoming-events', { params: { globalId } }),
  pollJob: (jobId) => api.get(`/ebay/extension-scrape/${encodeURIComponent(jobId)}`),
};

export const learningAPI = {
  list:   ()     => api.get('/api/learning-videos'),
  get:    (id)   => api.get(`/api/learning-videos/${id}`),

  // Always send as multipart/form-data so the backend can receive
  // either a video_url string OR a video_file upload (same for thumbnail).
  create: (formData) =>
    api.post('/api/learning-videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, formData) =>
    api.put(`/api/learning-videos/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  remove:        (id)              => api.delete(`/api/learning-videos/${id}`),
  toggleLike:    (id)              => api.post(`/api/learning-videos/${id}/like`),
  addComment:    (id, body)        => api.post(`/api/learning-videos/${id}/comments`, { body }),
  deleteComment: (videoId, commentId) =>
    api.delete(`/api/learning-videos/${videoId}/comments/${commentId}`),
};

export const buyersAPI = {
  list: () => api.get('/buyers'),
  get: (username) => api.get(`/buyers/${encodeURIComponent(username)}`),
  addNote: (username, note) =>
    api.post(`/buyers/${encodeURIComponent(username)}/notes`, { note }),
  deleteNote: (username, noteId) =>
    api.delete(`/buyers/${encodeURIComponent(username)}/notes/${noteId}`),
  addTag: (username, tag, color) =>
    api.post(`/buyers/${encodeURIComponent(username)}/tags`, { tag, color }),
  deleteTag: (username, tag) =>
    api.delete(`/buyers/${encodeURIComponent(username)}/tags/${encodeURIComponent(tag)}`),
};

export default api;