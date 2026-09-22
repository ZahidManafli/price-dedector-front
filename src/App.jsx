import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { useAuth } from './context/AuthContext';
import { useSidebar, SidebarProvider } from './context/SidebarContext';
import { LanguageProvider } from './context/LanguageContext';
import Sidebar from './components/Sidebar';
import { TourProvider } from './context/TourContext';

// Pages
// LandingPage is the site's entry point and stays a static import so the
// homepage never waits on an extra lazy-chunk round trip. Every other page
// is lazy-loaded: without this, a single ~1MB bundle containing the entire
// authenticated dashboard/admin app shipped to every anonymous visitor of the
// homepage and every public SEO landing page, which is both a Core Web
// Vitals problem (Google ranking factor) and pure waste for a page a
// crawler or first-time visitor never needed most of.
import LandingPage from './pages/LandingPage';

const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const ProductFormPage = React.lazy(() => import('./pages/ProductFormPage'));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const EbayCallbackPage = React.lazy(() => import('./pages/EbayCallbackPage'));
const AmazonCallbackPage = React.lazy(() => import('./pages/AmazonCallbackPage'));
const AmazonLookupPage = React.lazy(() => import('./pages/AmazonLookupPage'));
const AdminPanelPage = React.lazy(() => import('./pages/AdminPanelPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const SupportContactPage = React.lazy(() => import('./pages/SupportContactPage'));
const ExtensionPrivacyPage = React.lazy(() => import('./pages/ExtensionPrivacyPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const MaintenancePage = React.lazy(() => import('./pages/MaintenancePage'));
const PlanExpiredPage = React.lazy(() => import('./pages/PlanExpiredPage'));
const ListingsPage = React.lazy(() => import('./pages/ListingsPage'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage'));
const ListingDetailPage = React.lazy(() => import('./pages/ListingDetailPage'));
const OrderDetailPage = React.lazy(() => import('./pages/OrderDetailPage'));
const EbayCalculatorPage = React.lazy(() => import('./pages/EbayCalculatorPage'));
const DewisoPage = React.lazy(() => import('./pages/DewisoPage'));
const CanvaPage = React.lazy(() => import('./pages/CanvaPage'));
const CanvaCallbackPage = React.lazy(() => import('./pages/CanvaCallbackPage'));
const CanvaReturnPage = React.lazy(() => import('./pages/CanvaReturnPage'));
const MarketAnalysisPage = React.lazy(() => import('./pages/MarketAnalysisPage'));
const MarketInsightPage = React.lazy(() => import('./pages/MarketInsightPage'));
const MarketListingDetailPage = React.lazy(() => import('./pages/MarketListingDetailPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const ReferralLandingPage = React.lazy(() => import('./pages/ReferralLandingPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const BuyersPage = React.lazy(() => import('./pages/BuyersPage'));
const ReferralDashboardPage = React.lazy(() => import('./pages/ReferralDashboardPage'));
const LearningVideosPage = React.lazy(() => import('./pages/LearningVideosPage'));
const ProfitTablePage = React.lazy(() => import('./pages/ProfitTablePage'));
const TrackingPage = React.lazy(() => import('./pages/TrackingPage'));
const CasesPage = React.lazy(() => import('./pages/CasesPage'));
const SupportPage = React.lazy(() => import('./pages/SupportPage'));
const UpgradePlanPage = React.lazy(() => import('./pages/UpgradePlanPage'));
const PaymentSuccessPage = React.lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentErrorPage = React.lazy(() => import('./pages/PaymentErrorPage'));
const EpointRedirectPage = React.lazy(() => import('./pages/EpointRedirectPage'));

import { TAB_KEYS } from './utils/planAccess';
import ActivityTracker from './components/ActivityTracker';
import { buildSeoRoutes } from './routes/seoRoutes';

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
  </div>
);

// Routes that stay reachable even for a user whose plan has expired, so they can
// still see the notice and renew instead of getting redirected in a loop.
const PLAN_EXPIRY_EXEMPT_ROUTES = ['/plan-expired', '/upgrade-plan', '/settings'];

// Protected Route Component
const ProtectedRoute = ({ children, requiredTab = null }) => {
  const { isAuthenticated, loading, hasTabAccess, isPlanExpired } = useAuth();
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : false;
  const location = useLocation();

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

  if (isPlanExpired && !PLAN_EXPIRY_EXEMPT_ROUTES.includes(location.pathname)) {
    return <Navigate to="/plan-expired" replace />;
  }

  if (requiredTab && !hasTabAccess(requiredTab)) {
    return <Navigate to="/dashboard" replace />;
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
      <ActivityTracker />
      {isAuthenticated && hasToken && <Sidebar />}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${isAuthenticated && hasToken ? '' : 'w-full'}`}>
        <div className="min-h-screen">
          <React.Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={isAuthenticated && hasToken ? <Navigate to="/dashboard" replace /> : <LoginPage />}
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/help" element={<SupportContactPage />} />
            <Route path="/extension-privacy" element={<ExtensionPrivacyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/ref/:slug" element={<ReferralLandingPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/succeess" element={<PaymentSuccessPage />} />
            <Route path="/error" element={<PaymentErrorPage />} />
            <Route path="/payments/epoint/checkout/:requestId" element={<EpointRedirectPage kind="checkout" />} />
            <Route path="/payments/epoint/card/register/:attemptId" element={<EpointRedirectPage kind="card" />} />

            {/* SEO landing pages (public, locale-prefixed) */}
            {buildSeoRoutes()}

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
              path="/upgrade-plan"
              element={
                <ProtectedRoute>
                  <UpgradePlanPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plan-expired"
              element={
                <ProtectedRoute>
                  <PlanExpiredPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.PRODUCTS}>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-product"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.PRODUCTS}>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-product/:productId"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.PRODUCTS}>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product/:productId"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.PRODUCTS}>
                  <ProductDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.SETTINGS}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ebay/callback"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.SETTINGS}>
                  <EbayCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/amazon/callback"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.SETTINGS}>
                  <AmazonCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/amazon-lookup"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.AMAZON_LOOKUP}>
                  <AmazonLookupPage />
                </ProtectedRoute>
              }
            />
            <Route path="/ebay-calculator" element={<EbayCalculatorPage />} />
            <Route
              path="/market-analysis"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.MARKET_ANALYSIS}>
                  <MarketAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-insight"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.MARKET_INSIGHT}>
                  <MarketInsightPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-analysis/item/:itemId"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.MARKET_ANALYSIS}>
                  <MarketListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dewiso"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.DEWISO}>
                  <DewisoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/canva"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.CANVA}>
                  <CanvaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/canva/callback"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.CANVA}>
                  <CanvaCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/canva/return"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.CANVA}>
                  <CanvaReturnPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.LISTINGS}>
                  <ListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.ORDERS}>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:orderId"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.ORDERS}>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/buyers"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.BUYER_CRM}>
                  <BuyersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracking"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.TRACKING}>
                  <TrackingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.CASES}>
                  <CasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <SupportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:listingId"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.LISTINGS}>
                  <ListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/learning" element={<LearningVideosPage />} />
            <Route
              path="/profit-table"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.PROFIT_TABLE}>
                  <ProfitTablePage />
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
            <Route
              path="/referals"
              element={
                <ProtectedRoute requiredTab={TAB_KEYS.REFERRALS}>
                  <ReferralDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/referrals"
              element={<Navigate to="/referals" replace />}
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={isAuthenticated && hasToken ? '/dashboard' : '/'} replace />} />
          </Routes>
          </React.Suspense>
        </div>
      </main>
      </div>
    );
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        <SidebarProvider>
          <Router>
            <TourProvider>
              <AppContent />
              <Analytics />
            </TourProvider>
          </Router>
        </SidebarProvider>
      </LanguageProvider>
    </I18nextProvider>
  );
}

export default App;
