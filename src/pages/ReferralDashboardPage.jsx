import React, { useEffect, useState } from 'react';
import { referralAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';

export default function ReferralDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await referralAPI.getMe();
        if (!cancelled) setReferrals(response?.data?.referrals || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Failed to load referral dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Referals</h1>
          <p className="page-subtitle">View your referral pages, members, and payout totals.</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {referrals.length === 0 ? (
            <div className="glass-card p-6 text-slate-600 dark:text-slate-300">No referral pages assigned yet.</div>
          ) : (
            referrals.map((referral) => (
              <div key={referral.id} className="glass-card p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Referral</p>
                    <h2 className="text-2xl font-semibold">{referral.name}</h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{referral.description || 'No description'}</p>
                    <p className="text-sm mt-3 text-slate-500 dark:text-slate-400">/ref/{referral.slug}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 min-w-[280px]">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Members</p>
                      <p className="text-2xl font-semibold mt-1">{referral.memberCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Commission</p>
                      <p className="text-2xl font-semibold mt-1">{referral.feeAmount}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Earned</p>
                      <p className="text-2xl font-semibold mt-1">{referral.totalEarned} {referral.feeCurrency}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Paid</p>
                      <p className="text-2xl font-semibold mt-1">{referral.totalPaid} {referral.feeCurrency}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="font-semibold mb-3">Members</h3>
                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                      {(referral.members || []).map((member) => (
                        <div key={member.userId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                          <p className="font-medium">{member.email}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {member.selectedPlanName || 'No plan'} · {member.assignedAt ? new Date(member.assignedAt).toLocaleString() : ''}
                          </p>
                        </div>
                      ))}
                      {(referral.members || []).length === 0 && (
                        <p className="text-sm text-slate-500">No members assigned.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="font-semibold mb-3">Summary</h3>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p><span className="font-medium">Referral page:</span> /ref/{referral.slug}</p>
                      <p><span className="font-medium">Referral admin:</span> {referral.referralAdminName || 'N/A'}</p>
                      <p><span className="font-medium">Balance:</span> {referral.balance} {referral.feeCurrency}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}