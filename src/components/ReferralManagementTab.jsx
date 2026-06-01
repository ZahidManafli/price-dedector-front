import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { adminAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

function emptyForm() {
  return {
    name: '',
    slug: '',
    description: '',
    feeAmount: '',
    feeCurrency: 'AZN',
    referralAdminUserId: '',
    isActive: true,
  };
}

export default function ReferralManagementTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedReferralId, setSelectedReferralId] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(true);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [payoutAmount, setPayoutAmount] = useState('');

  const selectedReferral = useMemo(
    () => referrals.find((item) => item.id === selectedReferralId) || null,
    [referrals, selectedReferralId]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [referralsRes, usersRes] = await Promise.all([
        adminAPI.listReferrals(),
        adminAPI.listUsers(),
      ]);
      const nextReferrals = referralsRes?.data?.referrals || [];
      setReferrals(nextReferrals);
      setUsers(usersRes?.data?.users || []);
      if (!selectedReferralId && !isCreatingNew && nextReferrals[0]?.id) {
        setSelectedReferralId(nextReferrals[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (referralId) => {
    if (!referralId) return;
    try {
      const response = await adminAPI.getReferral(referralId);
      setDetail(response?.data || null);
      const nextReferral = response?.data?.referral || null;
      if (nextReferral) {
        setForm({
          name: nextReferral.name || '',
          slug: nextReferral.slug || '',
          description: nextReferral.description || '',
          feeAmount: String(nextReferral.feeAmount ?? ''),
          feeCurrency: nextReferral.feeCurrency || 'AZN',
          referralAdminUserId: nextReferral.referralAdminUserId || '',
          isActive: !!nextReferral.isActive,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load referral detail');
    }
  };

  useEffect(() => {
    loadData();
  }, [isCreatingNew, selectedReferralId]);

  useEffect(() => {
    if (selectedReferralId) {
      setIsCreatingNew(false);
      loadDetail(selectedReferralId);
    } else if (isCreatingNew) {
      setDetail(null);
      setForm(emptyForm());
    }
  }, [selectedReferralId, isCreatingNew]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Referral name is required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        feeAmount: form.feeAmount === '' ? 0 : Number(form.feeAmount),
        feeCurrency: form.feeCurrency,
        referralAdminUserId: form.referralAdminUserId || null,
        isActive: !!form.isActive,
      };
      if (selectedReferral) {
        await adminAPI.updateReferral(selectedReferral.id, payload);
      } else {
        const response = await adminAPI.createReferral(payload);
        if (response?.data?.referral?.id) {
          setIsCreatingNew(false);
          setSelectedReferralId(response.data.referral.id);
        }
      }
      await loadData();
      if (selectedReferralId) {
        await loadDetail(selectedReferralId);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save referral');
    } finally {
      setSaving(false);
    }
  };

  const addUser = async () => {
    if (!selectedReferralId) return;
    const { value } = await Swal.fire({
      title: 'Add user to referral',
      input: 'select',
      inputOptions: users.reduce((acc, user) => {
        acc[user.id] = `${user.email || ''} ${user.name ? `(${user.name})` : ''}`;
        return acc;
      }, {}),
      inputPlaceholder: 'Select a user',
      showCancelButton: true,
      confirmButtonText: 'Add',
    });
    if (!value) return;
    try {
      setSaving(true);
      await adminAPI.addReferralUser(selectedReferralId, { userId: value });
      await loadDetail(selectedReferralId);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (userId) => {
    const confirmed = window.confirm('Remove this user from the referral?');
    if (!confirmed) return;
    try {
      setSaving(true);
      await adminAPI.removeReferralUser(selectedReferralId, userId);
      await loadDetail(selectedReferralId);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to remove user');
    } finally {
      setSaving(false);
    }
  };

  const recordPayout = async () => {
    if (!selectedReferralId) return;
    if (!payoutAmount) return;
    try {
      setSaving(true);
      await adminAPI.recordReferralPayout(selectedReferralId, {
        amount: Number(payoutAmount),
        currency: form.feeCurrency || 'AZN',
      });
      setPayoutAmount('');
      await loadDetail(selectedReferralId);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  };

  const deleteReferral = async () => {
    if (!selectedReferralId) return;
    const confirmed = window.confirm('Delete this referral class? This will remove its members, commissions, and payouts.');
    if (!confirmed) return;

    try {
      setSaving(true);
      await adminAPI.deleteReferral(selectedReferralId);
      setSelectedReferralId('');
      setIsCreatingNew(true);
      setDetail(null);
      setForm(emptyForm());
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to delete referral');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">All referrals</h3>
            <button
              type="button"
              onClick={() => {
                setIsCreatingNew(true);
                setSelectedReferralId('');
                setForm(emptyForm());
                setDetail(null);
              }}
              className={`btn-secondary px-3 py-2 text-xs ${isCreatingNew ? 'ring-2 ring-cyan-400/40' : ''}`}
            >
              Create new
            </button>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
            {referrals.map((referral) => (
              <button
                key={referral.id}
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setSelectedReferralId(referral.id);
                }}
                className={`w-full text-left rounded-xl border px-3 py-3 transition ${selectedReferralId === referral.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{referral.name}</span>
                  <span className="text-xs text-slate-500">{referral.memberCount} users</span>
                </div>
                <p className="text-xs text-slate-500 truncate">/{referral.slug}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-4 md:p-5 space-y-5">
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="input-base" placeholder="Referral name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input className="input-base" placeholder="Referral slug" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
            <textarea className="input-base md:col-span-2 min-h-[100px]" placeholder="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            <input className="input-base" placeholder="Commission percentage" type="number" min="0" max="100" step="0.01" value={form.feeAmount} onChange={(e) => setForm((prev) => ({ ...prev, feeAmount: e.target.value }))} />
            <input className="input-base" placeholder="Payout currency" value={form.feeCurrency} onChange={(e) => setForm((prev) => ({ ...prev, feeCurrency: e.target.value }))} />
            <select className="input-base" value={form.referralAdminUserId} onChange={(e) => setForm((prev) => ({ ...prev, referralAdminUserId: e.target.value }))}>
              <option value="">Select referral admin</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.email || user.name || user.id}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              Active referral
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2">{selectedReferral ? 'Update referral' : 'Create referral'}</button>
              {selectedReferral && <button type="button" onClick={addUser} disabled={saving} className="btn-secondary px-4 py-2">Add user</button>}
              {selectedReferral && <button type="button" onClick={deleteReferral} disabled={saving} className="btn-secondary px-4 py-2 text-red-600">Delete referral</button>}
            </div>
          </form>

          {detail?.referral && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500">Members</p>
                <p className="text-2xl font-semibold mt-1">{detail.referral.memberCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500">Commission</p>
                <p className="text-2xl font-semibold mt-1">{detail.referral.feeAmount}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500">Earned</p>
                <p className="text-2xl font-semibold mt-1">{detail.referral.totalEarned} {detail.referral.feeCurrency}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500">Paid</p>
                <p className="text-2xl font-semibold mt-1">{detail.referral.totalPaid} {detail.referral.feeCurrency}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-3">Users</h4>
              <div className="space-y-2">
                {detail?.members?.map((member) => (
                  <div key={member.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{member.email}</p>
                      <p className="text-xs text-slate-500">{member.selectedPlanName || 'No plan'} · {member.assignedAt || ''}</p>
                    </div>
                    <button type="button" onClick={() => removeUser(member.userId)} className="btn-secondary px-3 py-2 text-xs">Remove</button>
                  </div>
                ))}
                {detail?.members?.length === 0 && <p className="text-sm text-slate-500">No members assigned.</p>}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Payouts</h4>
              <div className="space-y-2">
                {detail?.payouts?.map((payout) => (
                  <div key={payout.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <p className="font-medium">{payout.amount} {payout.currency}</p>
                    <p className="text-xs text-slate-500">{payout.status} · {payout.paidAt || payout.createdAt || ''}</p>
                  </div>
                ))}
                {detail?.payouts?.length === 0 && <p className="text-sm text-slate-500">No payouts recorded.</p>}
              </div>

              <div className="mt-4 flex gap-2">
                <input className="input-base flex-1" type="number" min="0" placeholder="Record payout amount" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                <button type="button" onClick={recordPayout} disabled={saving} className="btn-primary px-4 py-2">Record</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}