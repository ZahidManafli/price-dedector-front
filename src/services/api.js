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
    url.startsWith('/settings/plans/public') ||
    url === '/settings/subscription-requests' ||
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
    if (status === 401) {
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } catch {}
      if (typeof window !== 'undefined') window.location.href = '/login';
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
  getListings: (offset = 0, limit = 25) => api.get('/ebay/listings', { params: { offset, limit } }),
  deleteListing: (listingId, params = {}) =>
    api.delete(`/ebay/listings/${encodeURIComponent(listingId)}`, { params }),
  updateListing: (listingId, payload) => api.patch(`/ebay/listings/${listingId}`, payload),
  createListingDraft: (payload) => api.post('/ebay/listing/draft', payload),
  updateListingDraft: (draftId, payload) => api.patch(`/ebay/listing/draft/${encodeURIComponent(draftId)}`, payload),
  submitListingDraft: (draftId) => api.post('/ebay/listing/submit', { draftId }),
  sellSimilar: (listingId) => api.post('/ebay/listing/sell-similar', { listingId }),
  getDashboardAnalytics: () => api.get('/ebay/analytics/dashboard'),
  getOrders: (offset = 0, limit = 25) => api.get('/ebay/orders', { params: { offset, limit } }),
  getOrderTracking: (orderId) => api.get(`/ebay/orders/${encodeURIComponent(orderId)}/tracking`),
  registerOrderTracking: (orderId, payload) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/register`, payload),
  refreshOrderTracking: (orderId) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/refresh`),
  uploadOrderTrackingToEbay: (orderId, payload) =>
    api.post(`/ebay/orders/${encodeURIComponent(orderId)}/tracking/upload-ebay`, payload),
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

export const dewisoAPI = {
  getHistory: (limit = 20) => api.get('/dewiso/history', { params: { limit } }),
  saveHistory: (payload) => api.post('/dewiso/history', payload),
};

// Admin APIs
export const adminAPI = {
  listUsers: () => api.get('/admin/users'),
  getStats: () => api.get('/admin/stats'),
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
};

export default api;
