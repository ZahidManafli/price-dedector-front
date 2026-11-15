import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { getPrivacyPolicy, PRIVACY_POLICY_VERSION } from '../content/privacyPolicy';
import PrivacyPolicyContent from './privacy/PrivacyPolicyContent';

// Mandatory consent step — mounted in App.jsx like BirthdayModal and shown to
// every logged-in user whose accepted policy version differs from the current
// PRIVACY_POLICY_VERSION. No close button / backdrop dismiss. "I accept" stays
// disabled until the user has scrolled to the very end of the policy text.
const BOTTOM_TOLERANCE_PX = 24;

export default function PrivacyPolicyModal() {
  const { t, i18n } = useTranslation();
  const { patchUser } = useAuth();
  const policy = useMemo(() => getPrivacyPolicy(i18n.language), [i18n.language]);
  const scrollRef = useRef(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max <= 0 ? 1 : el.scrollTop / max;
    setProgress(Math.min(1, Math.max(0, pct)));
    if (max - el.scrollTop <= BOTTOM_TOLERANCE_PX) setReachedEnd(true);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, policy]);

  // Lock the page behind the modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const scrollToEnd = () => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'smooth' });
  };

  const accept = async () => {
    if (!reachedEnd || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authAPI.acceptPrivacyPolicy(PRIVACY_POLICY_VERSION);
      patchUser({
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        privacyPolicyAcceptedAt: res?.data?.acceptedAt || new Date().toISOString(),
      });
    } catch (err) {
      setError(err?.response?.data?.error || t('privacyModal.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
      <div className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/40 dark:border-white/10 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />

        {/* Header */}
        <div className="relative flex items-start gap-3.5 border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-white/10 sm:px-7">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="privacy-modal-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{policy.ui.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('privacyModal.description')}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {policy.ui.effective}: {policy.effective} · {policy.ui.version}: {policy.version}
            </p>
          </div>
        </div>

        {/* Reading progress */}
        <div className="relative h-1 w-full bg-slate-100 dark:bg-white/5">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        {/* Policy text */}
        <div ref={scrollRef} onScroll={checkScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          <PrivacyPolicyContent policy={policy} compact />
          <div className="mt-8 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('privacyModal.endReached')}
          </div>
        </div>

        {/* Footer */}
        <div className="relative border-t border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.02] sm:px-7">
          {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p>}
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              {reachedEnd ? t('privacyModal.readyHint') : t('privacyModal.scrollHint')}
            </p>
            {reachedEnd ? (
              <button
                type="button"
                onClick={accept}
                disabled={saving}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? t('privacyModal.saving') : t('privacyModal.accept')}
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={scrollToEnd}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                >
                  <ArrowDown className="h-4 w-4" />
                  {t('privacyModal.continueReading')}
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={t('privacyModal.scrollHint')}
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500"
                >
                  {t('privacyModal.accept')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
