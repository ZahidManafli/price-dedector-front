import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { referralAPI } from '../services/api';
import Alert from '../components/Alert';

export default function ReferralLandingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referral, setReferral] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await referralAPI.getPublicBySlug(slug);
        if (!cancelled) setReferral(response?.data?.referral || null);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Referral not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-indigo-200/80 mb-3">Checkila referral</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
          {loading ? 'Loading referral...' : referral?.name || 'Referral link'}
        </h1>
        <p className="text-slate-300 max-w-xl">
          {referral?.description || 'Use this referral link to create an account and attach it to this referral automatically.'}
        </p>

        {error && (
          <div className="mt-6">
            <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
          </div>
        )}

        {referral && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
              <p className="text-slate-400">Referral admin</p>
              <p className="text-xl font-semibold mt-1">{referral.referralAdminName || 'N/A'}</p>
            </div>
            <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
              <p className="text-slate-400">Code</p>
              <p className="text-xl font-semibold mt-1">{referral.slug}</p>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate(`/signup?ref=${encodeURIComponent(slug || '')}`)}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white hover:bg-indigo-400 transition"
          >
            Create account with this referral
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10 transition"
          >
            I already have an account
          </button>
        </div>
      </div>
    </div>
  );
}