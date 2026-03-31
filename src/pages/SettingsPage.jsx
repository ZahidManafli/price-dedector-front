import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsAPI } from '../services/api';
import Alert from '../components/Alert';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState({
    emailOnPriceChange: true,
    emailNotificationFrequency: 'instant',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
