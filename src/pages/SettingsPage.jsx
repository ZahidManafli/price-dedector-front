import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Link2, Mail, ShieldCheck, Users } from 'lucide-react';
import { amazonOAuthAPI, authAPI, ebayAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState({
    emailOnPriceChange: true,
    emailNotificationFrequency: 'instant',
  });
  const [loading, setLoading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [ebayStatus, setEbayStatus] = useState({
    connected: false,
    accountId: null,
    environment: null,
    expiresAt: null,
    ebayAccounts: [],
    activeEbayAccountId: null,
  });
  const [amazonStatus, setAmazonStatus] = useState({
    connected: false,
    profile: null,
    tokenExpiresAt: null,
  });
  const [alert, setAlert] = useState(null);
  const [nameDrafts, setNameDrafts] = useState({});
  const [limits, setLimits] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [requestModal, setRequestModal] = useState(null);
  const [ebayTab, setEbayTab] = useState('overview');
  const [settingsTab, setSettingsTab] = useState('security');
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);

  const activeEbayAccount = Array.isArray(ebayStatus.ebayAccounts)
    ? ebayStatus.ebayAccounts.find((acc) => acc.id && ebayStatus.activeEbayAccountId === acc.id) || ebayStatus.ebayAccounts[0] || null
    : null;
  const activeSellerSnapshot = activeEbayAccount?.sellerSnapshot || ebayStatus.sellerSnapshot || null;
  const activeTradingUserSummary = activeEbayAccount?.tradingUserSummary || null;
  const activeTradingAccountSummary = activeEbayAccount?.tradingAccountSummary || null;

  useEffect(() => {
    const load = async () => {
      try {
        const [prefRes, ebayRes, amazonRes] = await Promise.all([
          settingsAPI.getPreferences(),
          ebayAPI.getStatus(),
          amazonOAuthAPI.getStatus().catch(() => ({ data: { connected: false } })),
        ]);
        const limitsRes = await settingsAPI.getLimits().catch(() => null);
        setPreferences((prev) => ({ ...prev, ...(prefRes.data || {}) }));
        const nextStatus = ebayRes.data || {};
        setEbayStatus(nextStatus);
        setAmazonStatus(amazonRes?.data || { connected: false });
        const drafts = {};
        (nextStatus.ebayAccounts || []).forEach((a) => {
          drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
        });
        setNameDrafts(drafts);
        setLimits(limitsRes?.data || null);
      } catch (_error) {
        // Keep defaults if optional settings/status calls fail.
      }
    };
    load();
  }, []);

  useEffect(() => {
    const onUpdated = async () => {
      try {
        const res = await amazonOAuthAPI.getStatus();
        setAmazonStatus(res?.data || { connected: false });
      } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('amazon:updated', onUpdated);
      return () => window.removeEventListener('amazon:updated', onUpdated);
    }
    return undefined;
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setAlert({ type: 'error', message: t('settingsPage.pleaseFillPassword') });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setAlert({ type: 'error', message: t('settingsPage.passwordTooShort') });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAlert({ type: 'error', message: t('settingsPage.passwordMismatch') });
      return;
    }

    try {
      setPasswordSaving(true);
      await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setAlert({ type: 'success', message: t('settingsPage.passwordUpdated') });
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || t('settingsPage.failedChangePassword') });
    } finally {
      setPasswordSaving(false);
    }
  };

  const openRequestModal = (requestType) => {
    setRequestModal({
      requestType,
      title:
        requestType === 'update_credits'
          ? t('settingsPage.requestCreditTopUp')
          : t('settingsPage.requestSubscriptionReset'),
      description:
        requestType === 'update_credits'
          ? t('settingsPage.requestMoreCredits')
          : t('settingsPage.refreshSubscription'),
    });
  };

  const handleConnectEbay = async () => {
    const remaining = limits?.ebayAccounts?.remaining;
    if (remaining !== null && remaining !== undefined && remaining <= 0) {
      setAlert({
        type: 'warning',
        message: t('settingsPage.connectionLimitReached') || 'Your eBay account connection limit is reached. Ask admin to increase your quota.',
      });
      return;
    }

    try {
      setEbayLoading(true);
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error(t('settingsPage.missingEbayAuthUrl') || 'Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedToStartEbay')
      });
      setEbayLoading(false);
    }
  };

  const handleDisconnectEbay = async () => {
    try {
      setEbayLoading(true);
      await ebayAPI.disconnect();
      setEbayStatus((prev) => ({ ...prev, connected: false, accountId: null }));
      setAlert({ type: 'success', message: t('settingsPage.disconnectedEbay') || 'Disconnected eBay account' });
      // Notify sidebar to update
      window.dispatchEvent(new Event('ebay:updated'));
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedToDisconnectEbay')
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleConnectAmazon = async () => {
    try {
      setAmazonLoading(true);
      const response = await amazonOAuthAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error(t('settingsPage.missingAmazonAuthUrl') || 'Missing Amazon auth URL');
      window.location.href = authUrl;
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedToStartAmazon')
      });
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleDisconnectAmazon = async () => {
    try {
      setAmazonLoading(true);
      await amazonOAuthAPI.disconnect();
      const res = await amazonOAuthAPI.getStatus().catch(() => ({ data: { connected: false } }));
      setAmazonStatus(res?.data || { connected: false });
      setAlert({ type: 'success', message: t('settingsPage.disconnectedAmazon') || 'Disconnected Amazon account' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedToDisconnectAmazon')
      });
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleSetActiveEbayAccount = async (ebayAccountId) => {
    try {
      setEbayLoading(true);
      await ebayAPI.setActiveAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      setAlert({ type: 'success', message: t('settingsPage.activeEbayUpdated') || 'Active eBay account updated' });
      // Notify sidebar to update active eBay account display
      window.dispatchEvent(new Event('ebay:updated'));
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedSetActiveEbay')
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleDeleteEbayAccount = async (ebayAccountId) => {
    const ok = window.confirm(t('settingsPage.deleteEbayAccount') || 'Delete this eBay account? This will disconnect it and remove it from your saved accounts.')
    if (!ok) return;
    try {
      setEbayLoading(true);
      await ebayAPI.deleteAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const limitsRes = await settingsAPI.getLimits().catch(() => null);
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      const drafts = {};
      (nextStatus.ebayAccounts || []).forEach((a) => {
        drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
      });
      setNameDrafts(drafts);
      setLimits(limitsRes?.data || limits);
      setAlert({ type: 'success', message: t('settingsPage.eBayDeleted') || 'eBay account deleted' });
      // Notify sidebar to update
      window.dispatchEvent(new Event('ebay:updated'));
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedDeleteEbay')
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSaveAccountName = async (ebayAccountId) => {
    const connectionName = String(nameDrafts[ebayAccountId] || '').trim();
    if (!connectionName) {
      setAlert({ type: 'error', message: t('settingsPage.connectionNameEmpty') || 'Connection name cannot be empty' });
      return;
    }
    try {
      setEbayLoading(true);
      await ebayAPI.setAccountName(ebayAccountId, connectionName);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      const drafts = {};
      (nextStatus.ebayAccounts || []).forEach((a) => {
        drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
      });
      setNameDrafts(drafts);
      setAlert({ type: 'success', message: t('settingsPage.eBayNameUpdated') || 'eBay connection name updated' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || t('settingsPage.failedUpdateEbayName')
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await settingsAPI.updatePreferences(preferences);
      setAlert({ type: 'success', message: t('settingsPage.settingsSaved') || 'Settings saved successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: t('settingsPage.failedSaveSettings') || 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSubmit = (e) => {
    if (settingsTab === 'notifications') {
      handleSave(e);
      return;
    }
    e.preventDefault();
  };

  const handleOpenBillingPortal = async () => {
    try {
      setBillingPortalLoading(true);
      const response = await settingsAPI.createStripeBillingPortal();
      const portalUrl = response?.data?.url;
      if (!portalUrl) {
        throw new Error('Billing portal URL not returned');
      }
      window.location.href = portalUrl;
    } catch (error) {
      setAlert({
        type: 'error',
        message: error?.response?.data?.error || error?.message || 'Failed to open billing portal',
      });
    } finally {
      setBillingPortalLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title mb-8">{t('settingsPage.title')}</h1>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <div className={`mb-6 rounded-xl p-1 border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
            {[
              { id: 'security', label: t('settingsPage.security') },
              { id: 'plans', label: t('settingsPage.plans') },
              { id: 'ebay', label: t('settingsPage.ebay') },
              { id: 'amazon', label: t('settingsPage.amazon') },
              { id: 'notifications', label: t('settingsPage.notifications') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSettingsTab(tab.id)}
                className={`px-3 py-2 text-sm rounded-lg transition ${
                  settingsTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {settingsTab === 'security' && (
        <div className="glass-card p-4 md:p-5 mb-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <ShieldCheck size={16} />
              {t('settingsPage.accountSecurity')}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder={t('settingsPage.currentPassword')}
                className="input-base"
                disabled={passwordSaving}
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder={t('settingsPage.newPassword')}
                className="input-base"
                disabled={passwordSaving}
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder={t('settingsPage.confirmNewPassword')}
                className="input-base"
                disabled={passwordSaving}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {passwordSaving ? t('settingsPage.updating') : t('settingsPage.changePassword')}
              </button>
            </div>
          </form>
        </div>
        )}

        {settingsTab === 'plans' && (
        <div className="glass-card p-4 md:p-5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                <Mail size={16} />
                {t('settingsPage.requestCreditTopUp')}
              </h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t('settingsPage.requestMoreCredits')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openRequestModal('update_credits')}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 hover:bg-emerald-700 transition"
              >
                {t('settingsPage.requestCreditTopUp')}
              </button>
              <button
                type="button"
                onClick={() => openRequestModal('reset_credits')}
                className="rounded-xl bg-slate-800 text-white px-4 py-2.5 hover:bg-slate-700 transition"
              >
                {t('settingsPage.requestSubscriptionReset')}
              </button>
              <button
                type="button"
                onClick={handleOpenBillingPortal}
                disabled={billingPortalLoading}
                className="rounded-xl bg-indigo-600 text-white px-4 py-2.5 hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {billingPortalLoading ? 'Opening billing...' : 'Manage billing'}
              </button>
            </div>
          </div>
        </div>
        )}

        {(settingsTab === 'notifications' || settingsTab === 'ebay' || settingsTab === 'amazon') && (
        <div className="glass-card p-4 md:p-5">
          <form onSubmit={handleSettingsSubmit} className="space-y-5">
            {/* Email Notifications */}
            {settingsTab === 'notifications' && (
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Bell size={16} />
                {t('settingsPage.emailNotifications')}
              </h2>

              <label className={`flex items-center gap-3 mb-3 rounded-lg p-2.5 ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
              }`}>
                <input
                  type="checkbox"
                  name="emailOnPriceChange"
                  checked={preferences.emailOnPriceChange}
                  onChange={handleChange}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                  {t('settingsPage.sendEmailWhenPricesChange')}
                </span>
              </label>

              <div className="ml-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  {t('settingsPage.notificationFrequency')}
                </label>
                <select
                  name="emailNotificationFrequency"
                  value={preferences.emailNotificationFrequency}
                  onChange={handleChange}
                  className="input-base"
                  disabled={!preferences.emailOnPriceChange || loading}
                >
                  <option value="instant">{t('settingsPage.instant')}</option>
                  <option value="daily">{t('settingsPage.dailySummary')}</option>
                  <option value="weekly">{t('settingsPage.weeklySummary')}</option>
                </select>
              </div>
            </div>
            )}

            {/* eBay Integration */}
            {settingsTab === 'ebay' && (
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Link2 size={16} />
                {t('settingsPage.ebayIntegration')}
              </h2>
              <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t('settingsPage.ebayIntegrationDescription')}
              </p>
              <div className={`inline-flex rounded-xl p-1 mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setEbayTab('overview')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    ebayTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                        ? 'text-slate-300 hover:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('settingsPage.connectionTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setEbayTab('details')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    ebayTab === 'details'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                        ? 'text-slate-300 hover:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('settingsPage.sellerDetailsTab')}
                </button>
              </div>
              {ebayTab === 'overview' ? (
                <>
                  <div className={`rounded-lg p-3 mb-3 ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ebayStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {ebayStatus.connected && <CheckCircle2 size={14} />}
                        {ebayStatus.connected ? t('settingsPage.connected') : t('settingsPage.notConnected')}
                      </span>
                    </div>
                    {/* Hide noisy environment text like 'sandbox' */}
                  </div>
                  {ebayStatus.activeAccountLabel && (
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {t('settingsPage.activeAccount')}: <span className="font-medium">{ebayStatus.activeAccountLabel}</span>
                    </p>
                  )}
                </div>

              {/* Multi-account selector */}
              <div className={`rounded-lg p-3 mb-3 ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
              }`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {t('settingsPage.ebayAccountSlots')}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('settingsPage.connectedCount')}: {limits?.ebayAccounts?.connected ?? (Array.isArray(ebayStatus.ebayAccounts) ? ebayStatus.ebayAccounts.filter((a) => !!a?.connected).length : 0)}
                  {limits?.ebayAccounts?.limit != null ? ` / ${limits.ebayAccounts.limit}` : ` (${t('settingsPage.unlimited')})`}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('settingsPage.remaining')}: {limits?.ebayAccounts?.remaining == null ? t('settingsPage.unlimited') : limits.ebayAccounts.remaining}
                </p>
              </div>

              {Array.isArray(ebayStatus.ebayAccounts) && ebayStatus.ebayAccounts.length > 0 && (
                <div className={`rounded-lg p-3 mb-3 ${
                  isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Users size={14} />
                    {t('settingsPage.activeEbayAccount')}
                  </div>
                  <div className="space-y-2">
                    {ebayStatus.ebayAccounts.map((acc) => {
                      const isActive = acc.id && ebayStatus.activeEbayAccountId === acc.id;
                      const label = acc.connectionName || acc.username || acc.profileUserId || t('settingsPage.unknown');
                      const tradingAccountId = acc.tradingAccountId || null;
                      const connected = !!acc.connected;
                      return (
                        <div
                          key={acc.id}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border transition ${
                            isActive
                              ? isDark
                                ? 'bg-emerald-900/30 border-emerald-700'
                                : 'bg-emerald-50 border-emerald-200'
                              : isDark
                                ? 'bg-slate-900/40 border-slate-700'
                                : 'bg-white border-slate-200'
                          } ${!connected ? 'opacity-60' : ''}`}
                        >
                          <div className="flex-1 text-left">
                            <div className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {label}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={nameDrafts[acc.id] ?? label}
                                onChange={(e) =>
                                  setNameDrafts((prev) => ({ ...prev, [acc.id]: e.target.value }))
                                }
                                disabled={ebayLoading}
                                className={`text-xs rounded px-2 py-1 border w-48 ${
                                  isDark
                                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                                    : 'bg-white border-slate-300 text-slate-900'
                                }`}
                                placeholder={t('settingsPage.connectionNamePlaceholder')}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAccountName(acc.id)}
                                disabled={ebayLoading}
                                className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                  isDark
                                    ? 'border-indigo-700 text-indigo-200 hover:bg-indigo-900/30'
                                    : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                }`}
                              >
                                {t('settingsPage.saveName')}
                              </button>
                            </div>
                            <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {connected ? t('settingsPage.connected') : t('settingsPage.disconnected')}
                              {acc.updatedAt ? ` · ${t('settingsPage.updated')} ${new Date(acc.updatedAt).toLocaleString()}` : ''}
                              {tradingAccountId ? ` · ${t('settingsPage.accountId')} ${tradingAccountId}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-3">
                            <button
                              type="button"
                              onClick={() => handleSetActiveEbayAccount(acc.id)}
                              disabled={ebayLoading || !connected || isActive}
                              className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                isDark
                                  ? 'border-emerald-800 text-emerald-200 hover:bg-emerald-900/30'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {t('settingsPage.setActive')}
                            </button>
                            {isActive && (
                              <span className={`text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                                {t('settingsPage.active')}
                              </span>
                            )}
                            {connected && <CheckCircle2 size={16} className={isDark ? 'text-emerald-300' : 'text-emerald-600'} />}
                            <button
                              type="button"
                              onClick={() => handleDeleteEbayAccount(acc.id)}
                              disabled={ebayLoading}
                              className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                isDark
                                  ? 'border-rose-800 text-rose-200 hover:bg-rose-900/30'
                                  : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              }`}
                              title={t('settingsPage.deleteAccount')}
                            >
                              {t('settingsPage.delete')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('settingsPage.activeEbayAccountNote')}
                  </p>
                </div>
              )}
                  <div className="flex gap-3">
                    {!ebayStatus.connected ? (
                      <button
                        data-tour="settings-ebay-connect"
                        type="button"
                        onClick={handleConnectEbay}
                        disabled={ebayLoading || (limits?.ebayAccounts?.remaining != null && limits.ebayAccounts.remaining <= 0)}
                        className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                      >
                        {ebayLoading ? t('settingsPage.connecting') : t('settingsPage.connectEbay')}
                      </button>
                    ) : (
                      <>
                        <button
                          data-tour="settings-ebay-connect"
                          type="button"
                          onClick={handleConnectEbay}
                          disabled={ebayLoading || (limits?.ebayAccounts?.remaining != null && limits.ebayAccounts.remaining <= 0)}
                          className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                          title={t('settingsPage.connectAnotherEbayTitle')}
                        >
                          {ebayLoading ? t('settingsPage.connecting') : t('settingsPage.connectAnotherEbay')}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 mb-3">
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {t('settingsPage.sellerSnapshot')}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.sellerSnapshotHint')}
                        </p>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t('settingsPage.fetched')}: {activeSellerSnapshot?.fetchedAt ? new Date(activeSellerSnapshot.fetchedAt).toLocaleString() : '—'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('settingsPage.connection')}</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{activeEbayAccount?.connectionName || activeEbayAccount?.username || activeEbayAccount?.profileUserId || t('settingsPage.unknown')}</p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.accountId')}: {activeEbayAccount?.tradingAccountId || activeEbayAccount?.profileUserId || activeEbayAccount?.accountId || '—'}</p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.environment')}: {activeEbayAccount?.environment || ebayStatus.environment || '—'}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('settingsPage.sellerRegistration')}</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {activeSellerSnapshot?.sellerRegistrationCompleted === true ? t('settingsPage.completed') : activeSellerSnapshot?.sellerRegistrationCompleted === false ? t('settingsPage.notCompleted') : t('settingsPage.unknown')}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.sellingLimit')}: {activeSellerSnapshot?.sellingLimit?.amount ? `${activeSellerSnapshot.sellingLimit.amount.value} ${activeSellerSnapshot.sellingLimit.amount.currency}` : '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.quantityLimit')}: {activeSellerSnapshot?.sellingLimit?.quantity ?? '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.businessPolicies')}: {activeEbayAccount?.userPreferencesSummary?.sellerProfileOptedIn ? t('settingsPage.enabled') : activeEbayAccount?.userPreferencesSummary?.sellerProfileOptedIn === false ? t('settingsPage.disabled') : t('settingsPage.unknown')}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.ebayGoodStanding')}: {activeTradingUserSummary?.ebayGoodStanding === true ? t('settingsPage.yes') : activeTradingUserSummary?.ebayGoodStanding === false ? t('settingsPage.no') : t('settingsPage.unknown')}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.feedback')}: {activeTradingUserSummary?.feedbackScore ?? '—'} ({activeTradingUserSummary?.positiveFeedbackPercent ?? '—'}%)
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('settingsPage.policies')}</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {t('settingsPage.custom')}: {activeSellerSnapshot?.policyCounts?.customPolicies ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.fulfillment')}: {activeSellerSnapshot?.policyCounts?.fulfillmentPolicies ?? 0} · {t('settingsPage.payment')}: {activeSellerSnapshot?.policyCounts?.paymentPolicies ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.return')}: {activeSellerSnapshot?.policyCounts?.returnPolicies ?? 0}
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('settingsPage.rateTables')}</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {activeSellerSnapshot?.policyCounts?.rateTables ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.marketplace')}: {activeSellerSnapshot?.marketplaceId || '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.country')}: {activeSellerSnapshot?.countryCode || t('settingsPage.all')}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.billingState')}: {activeTradingAccountSummary?.accountState || '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {t('settingsPage.invoiceBalance')}: {activeTradingAccountSummary?.invoiceBalance || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(activeSellerSnapshot?.errors) && activeSellerSnapshot.errors.length > 0 && (
                    <div className={`rounded-lg p-3 ${isDark ? 'bg-amber-950/30 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`text-sm font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>{t('settingsPage.partialSnapshotWarnings')}</p>
                      <ul className={`mt-2 space-y-1 text-xs ${isDark ? 'text-amber-100' : 'text-amber-800'}`}>
                        {activeSellerSnapshot.errors.map((err, index) => (
                          <li key={`${err.resource || 'error'}-${index}`}>{err.resource}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {['customPolicies', 'fulfillmentPolicies', 'paymentPolicies', 'returnPolicies', 'rateTables'].map((section) => {
                    const items = Array.isArray(activeSellerSnapshot?.[section]) ? activeSellerSnapshot[section] : [];
                    const labels = {
                      customPolicies: t('settingsPage.customPolicies'),
                      fulfillmentPolicies: t('settingsPage.fulfillmentPolicies'),
                      paymentPolicies: t('settingsPage.paymentPolicies'),
                      returnPolicies: t('settingsPage.returnPolicies'),
                      rateTables: t('settingsPage.shippingRateTables'),
                    };
                    return (
                      <div key={section} className={`rounded-lg p-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {labels[section]}
                        </p>
                        {items.length > 0 ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {items.map((item) => (
                              <div key={item.customPolicyId || item.fulfillmentPolicyId || item.paymentPolicyId || item.returnPolicyId || item.rateTableId || item.name} className={`rounded-md p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                                {section === 'customPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.label || item.name || t('settingsPage.customPolicy')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.customPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.type')}: {item.policyType || '—'}</p>
                                  </>
                                )}
                                {section === 'fulfillmentPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || t('settingsPage.fulfillmentPolicy')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.fulfillmentPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.marketplace')}: {item.marketplaceId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.shippingOptions')}: {Array.isArray(item.shippingOptions) ? item.shippingOptions.length : 0}</p>
                                  </>
                                )}
                                {section === 'paymentPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || t('settingsPage.paymentPolicy')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.paymentPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.description')}: {item.description || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.methods')}: {Array.isArray(item.paymentMethods) ? item.paymentMethods.map((method) => method.paymentMethodType).filter(Boolean).join(', ') || '—' : '—'}</p>
                                  </>
                                )}
                                {section === 'returnPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || t('settingsPage.returnPolicy')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.returnPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.returnsAccepted')}: {item.returnsAccepted ? t('settingsPage.yes') : t('settingsPage.no')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.period')}: {item.returnPeriod?.value ? `${item.returnPeriod.value} ${item.returnPeriod.unit || ''}`.trim() : '—'}</p>
                                  </>
                                )}
                                {section === 'rateTables' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || t('settingsPage.rateTable')}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.rateTableId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.country')}: {item.countryCode || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.locality')}: {item.locality || '—'}</p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('settingsPage.noSavedSection', { section: labels[section].toLowerCase() })}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Amazon OAuth */}
            {settingsTab === 'amazon' && (
              <div
                className={`rounded-lg p-3 md:p-4 ${
                  isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
                }`}
              >
                <h2
                  className={`text-lg font-semibold mb-2 flex items-center gap-2 ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  <Link2 size={16} />
                  {t('settingsPage.amazonLogin')}
                </h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('settingsPage.amazonLoginDescription')}
                </p>

                <div
                  className={`rounded-lg p-3 mb-3 ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        amazonStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {amazonStatus.connected && <CheckCircle2 size={14} />}
                      {amazonStatus.connected ? t('settingsPage.connected') : t('settingsPage.notConnected')}
                    </span>

                    {!amazonStatus.connected ? (
                      <button type="button" onClick={handleConnectAmazon} className="btn-primary" disabled={amazonLoading}>
                        {amazonLoading ? t('settingsPage.connecting') : t('settingsPage.connectAmazon')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectAmazon}
                        className="btn-secondary"
                        disabled={amazonLoading}
                      >
                        {amazonLoading ? t('settingsPage.disconnecting') : t('settingsPage.disconnect')}
                      </button>
                    )}
                  </div>

                  {amazonStatus.connected && amazonStatus.profile && (
                    <div className={`mt-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      <div>
                        {t('settingsPage.amazonUser')}: <span className="font-medium">{amazonStatus.profile.name || amazonStatus.profile.email || t('settingsPage.unknown')}</span>
                      </div>
                      {amazonStatus.profile.email && (
                        <div className="text-xs mt-1 opacity-80">
                          {t('settingsPage.email')}: <span className="font-medium">{amazonStatus.profile.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className={`pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex gap-4">
                {settingsTab === 'notifications' && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? t('settingsPage.saving') : t('settingsPage.saveSettings')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                >
                  {t('back')}
                </button>
              </div>
            </div>
          </form>
        </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Mail size={14} />
              {t('settingsPage.notificationChannel')}
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('settingsPage.notificationChannelDescription')}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <ShieldCheck size={14} />
              {t('settingsPage.accountSecurity')}
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('settingsPage.accountSecurityNote')}
            </p>
          </div>
        </div>

        <SubscriptionRequestModal
          open={!!requestModal}
          onClose={() => setRequestModal(null)}
          requestType={requestModal?.requestType || 'subscription'}
          title={requestModal?.title}
          description={requestModal?.description}
          defaultValues={{
            name: user?.name || '',
            surname: user?.surname || '',
            email: user?.email || '',
            phoneNumber: user?.phoneNumber || user?.phone || '',
          }}
          submitLabel={requestModal?.requestType === 'update_credits' ? t('settingsPage.sendCreditRequest') : t('settingsPage.sendResetRequest')}
          onSuccess={() => setAlert({ type: 'success', message: t('settingsPage.requestSentToAdmin') })}
          useStripeCheckout
        />
      </div>
    </div>
  );
}
