import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTranslation } from 'react-i18next';

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const referralSlug = new URLSearchParams(location.search).get('ref') || '';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setAlert({ type: 'error', message: t('auth.fillAllFields') });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setAlert({ type: 'error', message: t('signupPage.passwordsDoNotMatch') });
      return;
    }

    if (formData.password.length < 6) {
      setAlert({ type: 'error', message: t('signupPage.passwordTooShort') });
      return;
    }

    try {
      setLoading(true);

      await authAPI.signup(formData.email, formData.password, formData.name, referralSlug);

      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');

      setAlert({ type: 'success', message: t('signupPage.accountCreated') });
      setTimeout(() => navigate('/login'), 1200);
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || error?.response?.data?.error || error.message || t('signupPage.signupFailed');
      setAlert({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50 flex items-center justify-center px-4 py-6">
      <div className="glass-card p-6 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold shadow-sm">
            PC
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{t('signupPage.title')}</h1>
          <p className="text-slate-600 mt-2">{t('signupPage.subtitle')}</p>
        </div>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
              autoClose={false}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder={t('signupPage.fullName')}
            value={formData.name}
            onChange={handleChange}
            className="input-base"
            disabled={loading}
          />

          <input
            type="email"
            name="email"
            placeholder={t('auth.email')}
            value={formData.email}
            onChange={handleChange}
            className="input-base"
            disabled={loading}
          />

          <input
            type="password"
            name="password"
            placeholder={t('signupPage.passwordHint')}
            value={formData.password}
            onChange={handleChange}
            className="input-base"
            disabled={loading}
          />

          <input
            type="password"
            name="confirmPassword"
            placeholder={t('signupPage.confirmPassword')}
            value={formData.confirmPassword}
            onChange={handleChange}
            className="input-base"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5"
          >
            {loading ? t('signupPage.creatingAccount') : t('signupPage.signUp')}
          </button>
        </form>

        <p className="text-center text-slate-600 mt-6">
          {t('signupPage.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
