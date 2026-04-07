import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Link2, Mail, ShieldCheck, Users } from 'lucide-react';
import { ebayAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [preferences, setPreferences] = useState({
    emailOnPriceChange: true,
    emailNotificationFrequency: 'instant',
  });
  const [loading, setLoading] = useState(false);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayStatus, setEbayStatus] = useState({
    connected: false,
    accountId: null,
    environment: null,
    expiresAt: null,
    ebayAccounts: [],
    activeEbayAccountId: null,
  });
  const [alert, setAlert] = useState(null);
  const [nameDrafts, setNameDrafts] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [prefRes, ebayRes] = await Promise.all([
          settingsAPI.getPreferences(),
          ebayAPI.getStatus(),
        ]);
        setPreferences((prev) => ({ ...prev, ...(prefRes.data || {}) }));
        const nextStatus = ebayRes.data || {};
        setEbayStatus(nextStatus);
        const drafts = {};
        (nextStatus.ebayAccounts || []).forEach((a) => {
          drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
        });
        setNameDrafts(drafts);
      } catch (_error) {
        // Keep defaults if optional settings/status calls fail.
      }
    };
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleConnectEbay = async () => {
    try {
      setEbayLoading(true);
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to start eBay connection',
      });
      setEbayLoading(false);
    }
  };

  const handleDisconnectEbay = async () => {
    try {
      setEbayLoading(true);
      await ebayAPI.disconnect();
      setEbayStatus((prev) => ({ ...prev, connected: false, accountId: null }));
      setAlert({ type: 'success', message: 'Disconnected eBay account' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to disconnect eBay',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSetActiveEbayAccount = async (ebayAccountId) => {
    try {
      setEbayLoading(true);
      await ebayAPI.setActiveAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      setAlert({ type: 'success', message: 'Active eBay account updated' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to set active eBay account',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleDeleteEbayAccount = async (ebayAccountId) => {
    const ok = window.confirm('Delete this eBay account? This will disconnect it and remove it from your saved accounts.');
    if (!ok) return;
    try {
      setEbayLoading(true);
      await ebayAPI.deleteAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      const drafts = {};
      (nextStatus.ebayAccounts || []).forEach((a) => {
        drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
      });
      setNameDrafts(drafts);
      setAlert({ type: 'success', message: 'eBay account deleted' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to delete eBay account',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSaveAccountName = async (ebayAccountId) => {
    const connectionName = String(nameDrafts[ebayAccountId] || '').trim();
    if (!connectionName) {
      setAlert({ type: 'error', message: 'Connection name cannot be empty' });
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
      setAlert({ type: 'success', message: 'eBay connection name updated' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update eBay connection name',
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
      setAlert({ type: 'success', message: 'Settings saved successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title mb-8">Settings</h1>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <div className="glass-card p-4 md:p-5">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Email Notifications */}
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Bell size={16} />
                Email Notifications
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
                  Send email when prices change
                </span>
              </label>

              <div className="ml-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  Notification Frequency
                </label>
                <select
                  name="emailNotificationFrequency"
                  value={preferences.emailNotificationFrequency}
                  onChange={handleChange}
                  className="input-base"
                  disabled={!preferences.emailOnPriceChange || loading}
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily Summary</option>
                  <option value="weekly">Weekly Summary</option>
                </select>
              </div>
            </div>

            {/* eBay Integration */}
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Link2 size={16} />
                eBay Integration
              </h2>
              <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Connect your eBay account to auto-update listing prices when Amazon prices change.
              </p>
              <div className={`rounded-lg p-3 mb-3 ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ebayStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                      {ebayStatus.connected && <CheckCircle2 size={14} />}
                      {ebayStatus.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  {/* Hide noisy environment text like 'sandbox' */}
                </div>
                {ebayStatus.activeAccountLabel && (
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    Active account: <span className="font-medium">{ebayStatus.activeAccountLabel}</span>
                  </p>
                )}
              </div>

              {/* Multi-account selector */}
              {Array.isArray(ebayStatus.ebayAccounts) && ebayStatus.ebayAccounts.length > 0 && (
                <div className={`rounded-lg p-3 mb-3 ${
                  isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Users size={14} />
                    Active eBay account
                  </div>
                  <div className="space-y-2">
                    {ebayStatus.ebayAccounts.map((acc) => {
                      const isActive = acc.id && ebayStatus.activeEbayAccountId === acc.id;
                      const label = acc.connectionName || acc.username || acc.profileUserId || 'Unknown';
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
                                placeholder="Connection name"
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
                                Save name
                              </button>
                            </div>
                            <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {connected ? 'Connected' : 'Disconnected'}
                              {acc.updatedAt ? ` · Updated ${new Date(acc.updatedAt).toLocaleString()}` : ''}
                              {tradingAccountId ? ` · AccountID ${tradingAccountId}` : ''}
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
                              Set active
                            </button>
                            {isActive && (
                              <span className={`text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                                Active
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
                              title="Delete account"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Listings, orders, and edit actions will use your active eBay account.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                {!ebayStatus.connected ? (
                  <button
                    type="button"
                    onClick={handleConnectEbay}
                    disabled={ebayLoading}
                    className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {ebayLoading ? 'Connecting...' : 'Connect eBay'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleConnectEbay}
                      disabled={ebayLoading}
                      className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                      title="Connect another eBay account (will be added to your saved accounts)"
                    >
                      {ebayLoading ? 'Connecting...' : 'Connect another eBay'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectEbay}
                      disabled={ebayLoading}
                      className="rounded-xl bg-red-600 text-white px-5 py-2.5 hover:bg-red-700 transition disabled:opacity-50"
                      title="Disconnect the legacy single-account connection (kept for backward compatibility)"
                    >
                      {ebayLoading ? 'Disconnecting...' : 'Disconnect (legacy)'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className={`pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                >
                  Back
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Mail size={14} />
              Notification Channel
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Email alerts for price changes and sync events.
            </p>
          </div>
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <ShieldCheck size={14} />
              Account Security
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              OAuth tokens are stored server-side and refreshed automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
