import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function StripeCheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-rose-700/40 bg-slate-900/80 p-8 shadow-2xl">
        <div className="flex items-center gap-3 text-rose-300">
          <XCircle size={26} />
          <h1 className="text-2xl font-semibold">Checkout canceled</h1>
        </div>
        <p className="mt-4 text-slate-300">
          No payment was completed. You can return and try again whenever you are ready.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/settings"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Back to settings
          </Link>
          <Link
            to="/dashboard"
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
