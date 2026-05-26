import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { authAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function useSessionId() {
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  return params.get('session_id') || '';
}

export default function StripeCheckoutSuccessPage() {
  const sessionId = useSessionId();
  const { setSession, user } = useAuth();
  const [status, setStatus] = useState('processing');
  const [statusMessage, setStatusMessage] = useState('Finalizing billing event...');

  const canPollSession = useMemo(() => !!sessionId, [sessionId]);

  useEffect(() => {
    if (!canPollSession) {
      setStatus('received');
      setStatusMessage('Payment received. Your account will update shortly.');
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    const refreshAuthUser = async () => {
      const response = await authAPI.verifyToken();
      const verifiedUser = response?.data?.user || null;
      if (verifiedUser) {
        setSession(verifiedUser, localStorage.getItem('authToken') || null);
      }
      return verifiedUser;
    };

    const check = async () => {
      attempts += 1;
      try {
        const res = await settingsAPI.getStripeCheckoutSession(sessionId);
        const session = res?.data?.session || {};
        const paymentStatus = String(session.paymentStatus || '').toLowerCase();
        const subscriptionStatus = String(session.subscriptionStatus || '').toLowerCase();
        const flow = String(session.flow || '').toLowerCase();

        const paymentDone = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
        const subscriptionDone = flow !== 'subscription' || ['active', 'trialing'].includes(subscriptionStatus);

        if (paymentDone && subscriptionDone) {
          await refreshAuthUser();
          if (!cancelled) {
            setStatus('completed');
            setStatusMessage('Billing completed and account updated.');
          }
          return;
        }

        if (!cancelled) {
          setStatus('processing');
          setStatusMessage('Payment received. Waiting for webhook confirmation...');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('processing');
          setStatusMessage(error?.response?.data?.error || 'Waiting for billing confirmation...');
        }
      }

      if (!cancelled && attempts < maxAttempts) {
        setTimeout(check, 2000);
      } else if (!cancelled && attempts >= maxAttempts) {
        setStatus('received');
        setStatusMessage('Payment received. Account update may take a bit longer; refresh dashboard in a moment.');
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [canPollSession, sessionId, setSession]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-emerald-700/40 bg-slate-900/80 p-8 shadow-2xl">
        <div className="flex items-center gap-3 text-emerald-300">
          <CheckCircle2 size={26} />
          <h1 className="text-2xl font-semibold">Payment successful</h1>
        </div>
        <p className="mt-4 text-slate-300">
          Your payment was received. Stripe is finalizing your billing event and your subscription/credits will be updated automatically.
        </p>
        <p className="mt-2 text-sm text-emerald-200">{statusMessage}</p>
        {status === 'completed' && user ? (
          <p className="mt-2 text-xs text-slate-400">Current plan: {user.selectedPlanId || 'Pending sync'}</p>
        ) : null}
        {sessionId ? (
          <p className="mt-3 text-xs text-slate-400 break-all">Session ID: {sessionId}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Go to dashboard
          </Link>
          <Link
            to="/settings"
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Open settings
          </Link>
        </div>
      </div>
    </div>
  );
}
