import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Palette, Loader2, XCircle } from 'lucide-react';
import { canvaAPI } from '../services/api';
import Alert from '../components/Alert';

export default function CanvaCallbackPage() {
  const { t } = useTranslation();
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
        setAlert({ type: 'error', message: `Canva authorization failed: ${error}` });
        setLoading(false);
        return;
      }
      if (!code || !state) {
        setAlert({ type: 'error', message: 'Missing Canva OAuth code/state' });
        setLoading(false);
        return;
      }

      try {
        await canvaAPI.completeCallback(code, state);
        setSuccess(true);
        setTimeout(() => navigate('/canva'), 1200);
      } catch (err) {
        setAlert({
          type: 'error',
          message: err.response?.data?.error || t('canvaCallbackPage.failedHint'),
        });
      } finally {
        setLoading(false);
      }
    };

    finishOauth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, searchParams]);

  return (
    <div className="page-shell flex items-center justify-center">
      <div className="max-w-lg w-full glass-card p-6 md:p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
            <Palette className="text-purple-600" size={20} />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          {loading ? t('canvaCallbackPage.connecting') : success ? t('canvaCallbackPage.success') : t('canvaCallbackPage.failed')}
        </h1>
        <p className="text-slate-600 mb-5">
          {loading
            ? t('canvaCallbackPage.connectingHint')
            : success
              ? t('canvaCallbackPage.successHint')
              : t('canvaCallbackPage.failedHint')}
        </p>

        {loading && (
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="animate-spin text-purple-600" size={28} />
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
            <button type="button" onClick={() => navigate('/canva')} className="btn-primary">
              {t('canvaCallbackPage.tryAgain')}
            </button>
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
              {t('canvaCallbackPage.backToDashboard')}
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
