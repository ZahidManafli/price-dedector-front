import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';

export default function SettingsPage() {
  const navigate = useNavigate();
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
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [prefRes, ebayRes] = await Promise.all([
          settingsAPI.getPreferences(),
          ebayAPI.getStatus(),
        ]);
        setPreferences((prev) => ({ ...prev, ...(prefRes.data || {}) }));
        setEbayStatus(ebayRes.data || {});
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
    <div className="p-4 md:p-8 min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Email Notifications */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Email Notifications</h2>

              <label className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  name="emailOnPriceChange"
                  checked={preferences.emailOnPriceChange}
                  onChange={handleChange}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <span className="text-gray-700">Send email when prices change</span>
              </label>

              <div className="ml-7">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notification Frequency
                </label>
                <select
                  name="emailNotificationFrequency"
                  value={preferences.emailNotificationFrequency}
                  onChange={handleChange}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={!preferences.emailOnPriceChange || loading}
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily Summary</option>
                  <option value="weekly">Weekly Summary</option>
                </select>
              </div>
            </div>

            {/* eBay Integration */}
            <div className="pt-4 border-t">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">eBay Integration</h2>
              <p className="text-sm text-gray-600 mb-4">
                Connect your eBay account to auto-update listing prices when Amazon prices change.
              </p>
              <div className="bg-gray-50 border rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  Status:{' '}
                  <span className={ebayStatus.connected ? 'text-green-700 font-semibold' : 'text-gray-700'}>
                    {ebayStatus.connected ? 'Connected' : 'Not connected'}
                  </span>
                </p>
                {ebayStatus.accountId && (
                  <p className="text-sm text-gray-700 mt-1">Account: {ebayStatus.accountId}</p>
                )}
                {ebayStatus.environment && (
                  <p className="text-sm text-gray-700 mt-1">Environment: {ebayStatus.environment}</p>
                )}
              </div>
              <div className="flex gap-3">
                {!ebayStatus.connected ? (
                  <button
                    type="button"
                    onClick={handleConnectEbay}
                    disabled={ebayLoading}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {ebayLoading ? 'Connecting...' : 'Connect eBay'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDisconnectEbay}
                    disabled={ebayLoading}
                    className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {ebayLoading ? 'Disconnecting...' : 'Disconnect eBay'}
                  </button>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 border-t">
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
                >
                  Back
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
