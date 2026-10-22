import React, { useState } from 'react';
import { Cake, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

// Mandatory one-time onboarding step — mounted once in App.jsx, shown
// whenever a logged-in user has no date_of_birth on file yet. Deliberately
// has no close button and no backdrop-dismiss (per the feature's own
// requirement: "tələb etsin" — require it), unlike every other modal in this
// app. Once saved, AuthContext.patchUser() updates the cached user object
// directly so this never shows again this session, and the same value can
// be changed afterward from Settings (a normal, dismissable field there).
export default function BirthdayModal() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { patchUser } = useAuth();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value) {
      setError(t('birthdayModal.required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authAPI.setBirthday(value);
      patchUser({ dateOfBirth: value });
    } catch (err) {
      setError(err?.response?.data?.error || t('birthdayModal.failed'));
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
          <Cake size={26} />
        </div>
        <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          {t('birthdayModal.title')}
        </h2>
        <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('birthdayModal.description')}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-left">
          <input
            type="date"
            value={value}
            max={today}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            className="input-base"
            required
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? t('birthdayModal.saving') : t('birthdayModal.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
