import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, XCircle, Download, X } from 'lucide-react';
import { canvaAPI } from '../services/api';
import Alert from '../components/Alert';

const POLL_INTERVAL_MS = 2000;

export default function CanvaReturnPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing | ready | failed
  const [design, setDesign] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const notifiedRef = useRef(false);

  const notifyOpenerAndStop = () => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      try {
        window.opener?.postMessage('canva:design-updated', window.location.origin);
      } catch {
        // opener may be gone/cross-origin — safe to ignore
      }
    }
    clearInterval(pollRef.current);
  };

  useEffect(() => {
    const correlationJwt = searchParams.get('correlation_jwt');
    if (!correlationJwt) {
      setStatus('failed');
      setError('Missing correlation_jwt from Canva');
      return undefined;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const res = await canvaAPI.resolveReturn(correlationJwt);
        const id = res?.data?.id;
        if (!id) throw new Error('No design id returned');

        const poll = async () => {
          if (cancelled) return;
          try {
            const statusRes = await canvaAPI.getExportStatus(id);
            const data = statusRes?.data;
            if (cancelled || !data) return;

            if (data.status === 'ready') {
              setDesign(data);
              setStatus('ready');
              notifyOpenerAndStop();
            } else if (data.status === 'failed') {
              setDesign(data);
              setError(data.errorMessage || null);
              setStatus('failed');
              notifyOpenerAndStop();
            }
            // else still exporting — keep polling
          } catch {
            // transient error — keep polling until the interval naturally stops
          }
        };

        await poll();
        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setStatus('failed');
          setError(err?.response?.data?.error || err?.message || 'Failed to process the return from Canva');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="page-shell flex items-center justify-center">
      <div className="max-w-lg w-full glass-card p-6 md:p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center border ${
            status === 'ready' ? 'bg-emerald-50 border-emerald-100' : status === 'failed' ? 'bg-rose-50 border-rose-100' : 'bg-purple-50 border-purple-100'
          }`}>
            {status === 'processing' && <Loader2 className="animate-spin text-purple-600" size={20} />}
            {status === 'ready' && <CheckCircle2 className="text-emerald-600" size={20} />}
            {status === 'failed' && <XCircle className="text-rose-600" size={20} />}
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          {status === 'processing' && t('canvaReturnPage.processing')}
          {status === 'ready' && t('canvaReturnPage.ready')}
          {status === 'failed' && t('canvaReturnPage.failed')}
        </h1>
        <p className="text-slate-600 mb-5">
          {status === 'processing' && t('canvaReturnPage.processingHint')}
          {status === 'ready' && t('canvaReturnPage.readyHint')}
          {status === 'failed' && t('canvaReturnPage.failedHint')}
        </p>

        {status === 'ready' && design?.thumbnailUrl && (
          <div className="mb-5 flex justify-center">
            <img src={design.thumbnailUrl} alt="" className="max-h-48 rounded-lg border border-slate-200 object-contain" />
          </div>
        )}

        {status === 'ready' && (
          <div className="flex items-center justify-center gap-3">
            {design?.exportUrl && (
              <a href={design.exportUrl} target="_blank" rel="noreferrer" download className="btn-primary inline-flex items-center gap-2">
                <Download size={16} /> {t('canvaReturnPage.download')}
              </a>
            )}
            <button type="button" onClick={() => window.close()} className="btn-secondary inline-flex items-center gap-2">
              <X size={16} /> {t('canvaReturnPage.closeTab')}
            </button>
          </div>
        )}

        {status === 'failed' && (
          <button type="button" onClick={() => window.close()} className="btn-secondary inline-flex items-center gap-2">
            <X size={16} /> {t('canvaReturnPage.closeTab')}
          </button>
        )}

        {error && (
          <div className="mt-5">
            <Alert type="error" message={error} onClose={() => setError(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
