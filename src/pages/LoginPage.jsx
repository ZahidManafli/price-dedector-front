import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { authAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import { renderAccentedTitle } from '../utils/accentedTitle';

// Shared input look (same recipe as SubscriptionRequestModal): soft slate
// field, icon prefix, cyan focus ring — kept local since each form owns it.
const INPUT =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/15 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-950';

function Field({ icon: Icon, trailing, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {children}
      {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  );
}

const BULLET_ICONS = [ShieldCheck, Zap, Users];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [registerOpen, setRegisterOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!formData.email || !formData.password) {
      setAlert({ type: 'error', message: t('auth.fillAllFields') });
      return;
    }

    try {
      setLoading(true);

      const response = await authAPI.login(formData.email, formData.password);
      const token = response?.data?.token;
      const user = response?.data?.user;

      if (!token) {
        throw new Error(t('auth.loginFailed'));
      }

      localStorage.setItem('authToken', token);
      if (user) {
        setSession(user, token);
      } else {
        setSession({ email: formData.email, role: 'user' }, token);
      }

      setAlert({ type: 'success', message: t('auth.loginSuccess') });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error?.response?.status === 503 && error?.response?.data?.code === 'MAINTENANCE_MODE') {
        navigate('/maintenance', {
          replace: true,
          state: { maintenance: error?.response?.data?.maintenance || null },
        });
        return;
      }

      const errorMessage =
        error?.response?.data?.message || error?.response?.data?.error || error.message || t('auth.loginFailed');
      setAlert({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const openRegister = async () => {
    setRegisterOpen(true);
    if (plans.length > 0) return;
    try {
      const response = await settingsAPI.getPublicPlans();
      setPlans(response?.data?.plans || []);
    } catch {
      setPlans([]);
    }
  };

  const onRequestSuccess = () => {
    Swal.fire({
      icon: 'success',
      title: t('common.success'),
      text: t('loginPage.requestSent'),
      confirmButtonColor: '#06b6d4',
    });
  };

  const bullets = t('loginPage.marketingBullets', { returnObjects: true });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 lg:grid lg:grid-cols-2">
      <style>{`@keyframes loginFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.login-float{animation:loginFloat 6s ease-in-out infinite}.login-float-delay{animation-delay:-3s}@media (prefers-reduced-motion: reduce){.login-float{animation:none}}`}</style>

      {/* ── Left: brand panel (desktop only) ── */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[520px] rounded-full bg-blue-600/25 blur-3xl" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <Link to="/" className="relative z-10 inline-flex w-fit items-center gap-2.5">
          <img src="/logo-2.png" alt="Checkila" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/20" />
          <span className="text-xl font-semibold tracking-tight text-white">Checkila</span>
        </Link>

        <div className="relative z-10 max-w-md" style={{ animation: 'fadeIn 0.5s ease both' }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 backdrop-blur">
            <Sparkles size={14} />
            {t('landing:hero.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl" style={{ textWrap: 'balance' }}>
            {renderAccentedTitle(t('loginPage.marketingTitle'), [t('loginPage.marketingTitleAccent')])}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-300">{t('landing:hero.subtitle')}</p>

          <ul className="mt-8 space-y-4">
            {(Array.isArray(bullets) ? bullets : []).map((b, i) => {
              const Icon = BULLET_ICONS[i % BULLET_ICONS.length];
              return (
                <li key={b.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-slate-400">{b.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Floating chips — decorative, same copy as the landing hero's */}
        <div className="relative z-10 hidden h-20 xl:block">
          <div className="login-float absolute left-0 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-white backdrop-blur">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold leading-none">{t('landing:hero.floatOrderTitle')}</p>
              <p className="mt-1 text-[11px] text-slate-400">{t('landing:hero.floatOrderText')}</p>
            </div>
          </div>
          <div className="login-float login-float-delay absolute right-0 top-10 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-white backdrop-blur">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/20 text-cyan-300">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold leading-none">{t('landing:hero.floatTrackingTitle')}</p>
              <p className="mt-1 text-[11px] text-slate-400">{t('landing:hero.floatTrackingText')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: sign-in form ── */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:py-16">
        <div className="w-full max-w-md" style={{ animation: 'fadeIn 0.5s ease 0.1s both' }}>
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <img src="/logo-2.png" alt="Checkila" className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20" />
            <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
          </Link>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/[0.04] dark:border-white/10 dark:bg-white/[0.02] sm:p-9">
            <div className="text-center">
              <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {renderAccentedTitle(t('loginPage.title'), [t('loginPage.titleAccent')])}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{t('loginPage.subtitle')}</p>
            </div>

            {alert && (
              <div className="mt-5">
                <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <Field icon={Mail}>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder={t('auth.email')}
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className={INPUT}
                />
              </Field>

              <Field
                icon={Lock}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder={t('auth.password')}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  className={`${INPUT} pr-11`}
                />
              </Field>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? t('loginPage.loggingIn') : t('auth.login')}
                {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ShieldCheck size={13} />
              {t('loginPage.secureNote')}
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('loginPage.noAccount')}{' '}
            <button
              type="button"
              onClick={openRegister}
              className="font-semibold text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              {t('loginPage.register')}
            </button>
          </p>
        </div>
      </div>

      <SubscriptionRequestModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        plans={plans}
        lockPlan={false}
        onSuccess={onRequestSuccess}
      />
    </div>
  );
}
