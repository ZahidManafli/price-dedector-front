import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

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
    url.startsWith('/activity/log') ||
    url.startsWith('/settings/plans/public') ||
    url === '/settings/subscription-requests' ||
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
    if (status === 401) {
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } catch {}
      if (typeof window !== 'undefined') window.location.href = '/login';
    } else if (status === 403 && code === 'PLAN_TAB_ACCESS_DENIED') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/dashboard') {
        window.location.href = '/dashboard';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  signup: (email, password, name) => api.post('/auth/signup', { email, password, name }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  updateOnboardingTourState: (state) => api.post('/auth/onboarding-tour/state', { state }),
  logout: () => api.post('/auth/logout'),
  verifyToken: () => api.get('/auth/verify'),
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
  submitSubscriptionRequest: (data) => api.post('/settings/subscription-requests', data),
  submitUpdateCreditRequest: (data) => api.post('/settings/subscription-requests/update-credits', data),
  submitResetCreditsRequest: (data) => api.post('/settings/subscription-requests/reset-credits', data),
};

export const ebayAPI = {
  getConnectUrl: () => api.get('/ebay/connect'),
  completeCallback: (code, state) => api.post('/ebay/callback', { code, state }),
  getStatus: () => api.get('/ebay/status'),
  setActiveAccount: (ebayAccountId) => api.patch('/ebay/active-account', { ebayAccountId }),
  setAccountName: (ebayAccountId, connectionName) =>
    api.patch(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}/name`, { connectionName }),
  disconnectAccount: (ebayAccountId) => api.patch(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}/disconnect`),
  deleteAccount: (ebayAccountId) => api.delete(`/ebay/accounts/${encodeURIComponent(ebayAccountId)}`),
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
  updateListing: (listingId, payload) => api.patch(`/ebay/listings/${listingId}`, payload),
  getListingAutoStockRule: (listingId) => api.get(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`),
  saveListingAutoStockRule: (listingId, payload) =>
    api.put(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`, payload),
  deleteListingAutoStockRule: (listingId) =>
    api.delete(`/ebay/listings/${encodeURIComponent(listingId)}/auto-stock`),
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
  quickList: (data) => api.post('/ebay/quick-list', data),
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
  sendNotification: (data) => api.post('/admin/notifications/send', data),
  listNotifications: () => api.get('/admin/notifications'),
  getActivityLogs: (userId, limit) => api.get('/admin/activity-logs', { params: { userId, limit } }),
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

export default api;
