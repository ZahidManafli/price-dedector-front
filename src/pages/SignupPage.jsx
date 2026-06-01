import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI, referralAPI } from '../services/api';
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
  const [referral, setReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(Boolean(referralSlug));
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadReferral = async () => {
      if (!referralSlug) {
        setReferral(null);
        setReferralLoading(false);
        return;
      }

      try {
        setReferralLoading(true);
        const response = await referralAPI.getPublicBySlug(referralSlug);
        if (!cancelled) {
          setReferral(response?.data?.referral || null);
        }
      } catch {
        if (!cancelled) {
          setReferral(null);
        }
      } finally {
        if (!cancelled) {
          setReferralLoading(false);
        }
      }
    };

    loadReferral();

    return () => {
      cancelled = true;
    };
  }, [referralSlug]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6 md:p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold shadow-sm bg-cyan-400/20 border border-cyan-300/30">
            PC
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('signupPage.title')}</h1>
          <p className="text-slate-300 mt-2">{t('signupPage.subtitle')}</p>
        </div>

        {referralSlug ? (
          <div className="mb-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
            <p className="font-semibold uppercase tracking-[0.2em] text-cyan-100/80">Referral link</p>
            <p className="mt-1 text-base font-semibold text-white">
              {referralLoading ? 'Loading referral...' : referral?.name || referralSlug}
            </p>
            <p className="mt-1 text-cyan-50/90">
              {referral?.description || 'This account will be attached to the referral after signup.'}
            </p>
          </div>
        ) : null}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

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
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? t('signupPage.creatingAccount') : t('signupPage.signUp')}
          </button>
        </form>

        <p className="text-center text-slate-300 mt-6">
          {t('signupPage.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-cyan-300 font-semibold hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
