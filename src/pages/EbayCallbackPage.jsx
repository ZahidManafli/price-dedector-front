import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Link2, Loader2, XCircle } from 'lucide-react';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';

export default function EbayCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const finishOauth = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setAlert({ type: 'error', message: `eBay authorization failed: ${error}` });
        setLoading(false);
        return;
      }
      if (!code || !state) {
        setAlert({ type: 'error', message: 'Missing eBay OAuth code/state' });
        setLoading(false);
        return;
      }

      try {
        await ebayAPI.completeCallback(code, state);
        setSuccess(true);
        setAlert({ type: 'success', message: 'eBay account connected successfully' });
        setTimeout(() => navigate('/settings'), 1500);
      } catch (err) {
        setAlert({
          type: 'error',
          message: err.response?.data?.error || 'Failed to complete eBay connection',
        });
      } finally {
        setLoading(false);
      }
    };

    finishOauth();
  }, [navigate, searchParams]);

  return (
    <div className="page-shell flex items-center justify-center">
      <div className="max-w-lg w-full glass-card p-6 md:p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Link2 className="text-indigo-600" size={20} />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          {loading ? 'Connecting your eBay account' : success ? 'Connected successfully' : 'Connection failed'}
        </h1>
        <p className="text-slate-600 mb-5">
          {loading
            ? 'Finalizing your eBay authorization...'
            : success
              ? 'Your eBay account is now linked. Redirecting to settings...'
              : 'We could not complete your eBay connection. Please try again.'}
        </p>

        {loading && (
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="animate-spin text-indigo-600" size={28} />
          </div>
        )}

        {!loading && success && (
          <div className="flex items-center justify-center mb-4">
            <CheckCircle2 className="text-emerald-600" size={28} />
          </div>
        )}

        {!loading && !success && (
          <div className="flex items-center justify-center mb-4">
            <XCircle className="text-rose-600" size={28} />
          </div>
        )}

        {!loading && !success && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="btn-primary"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Back to dashboard
            </button>
          </div>
        )}

        {alert && (
          <div className="mt-5">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

