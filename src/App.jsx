import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { useAuth } from './context/AuthContext';
import { useSidebar, SidebarProvider } from './context/SidebarContext';
import Sidebar from './components/Sidebar';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductDetailPage from './pages/ProductDetailPage';
import SettingsPage from './pages/SettingsPage';
import EbayCallbackPage from './pages/EbayCallbackPage';
import AmazonLookupPage from './pages/AmazonLookupPage';
import AdminPanelPage from './pages/AdminPanelPage';
import PrivacyPage from './pages/PrivacyPage';
import AboutPage from './pages/AboutPage';
import ListingsPage from './pages/ListingsPage';
import OrdersPage from './pages/OrdersPage';
import ListingDetailPage from './pages/ListingDetailPage';
import OrderDetailPage from './pages/OrderDetailPage';
import EbayCalculatorPage from './pages/EbayCalculatorPage';
import DewisoPage from './pages/DewisoPage';
import MarketAnalysisPage from './pages/MarketAnalysisPage';
import MarketListingDetailPage from './pages/MarketListingDetailPage';
import LandingPage from './pages/LandingPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!(isAuthenticated && hasToken)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!(isAuthenticated && hasToken)) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const { isCollapsed } = useSidebar();
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
      {isAuthenticated && hasToken && <Sidebar />}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${isAuthenticated && hasToken ? '' : 'w-full'}`}>
        <div className="min-h-screen">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={isAuthenticated && hasToken ? <Navigate to="/dashboard" replace /> : <LoginPage />}
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-product"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-product/:productId"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product/:productId"
              element={
                <ProtectedRoute>
                  <ProductDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ebay/callback"
              element={
                <ProtectedRoute>
                  <EbayCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/amazon-lookup"
              element={
                <ProtectedRoute>
                  <AmazonLookupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ebay-calculator"
              element={
                <ProtectedRoute>
                  <EbayCalculatorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-analysis"
              element={
                <ProtectedRoute>
                  <MarketAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-analysis/item/:itemId"
              element={
                <ProtectedRoute>
                  <MarketListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dewiso"
              element={
                <ProtectedRoute>
                  <DewisoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings"
              element={
                <ProtectedRoute>
                  <ListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:orderId"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:listingId"
              element={
                <ProtectedRoute>
                  <ListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminPanelPage />
                </AdminProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={isAuthenticated && hasToken ? '/dashboard' : '/'} replace />} />
          </Routes>
        </div>
      </main>
      </div>
    );
}

function App() {
  return (
    <SidebarProvider>
      <Router>
        <AppContent />
        <Analytics />
      </Router>
    </SidebarProvider>
  );
}

export default App;
