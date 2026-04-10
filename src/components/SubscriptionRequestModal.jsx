import React, { useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';

function initialForm(selectedPlanId = '') {
  return {
    name: '',
    surname: '',
    email: '',
    phoneNumber: '',
    planId: selectedPlanId,
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    customNote: '',
  };
}

export default function SubscriptionRequestModal({
  open,
  onClose,
  plans = [],
  selectedPlanId = '',
  lockPlan = false,
  onSuccess,
}) {
  const [form, setForm] = useState(initialForm(selectedPlanId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availablePlans = useMemo(
    () => plans.filter((p) => p && p.isActive !== false),
    [plans]
  );

  React.useEffect(() => {
    setForm(initialForm(selectedPlanId));
    setError('');
  }, [selectedPlanId, open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.surname || !form.email || !form.phoneNumber || !form.planId) {
      setError('Please fill all required fields.');
      return;
    }

    const isCustomPlan = form.planId === 'custom';
    if (isCustomPlan) {
      const requiredNumbers = [
        form.amazonLookupLimitPerWeek,
        form.productsLimit,
        form.marketAnalysisCreditsLimit,
        form.ebayAccountsLimit,
      ];
      const hasInvalid = requiredNumbers.some((v) => v === '' || Number(v) < 0 || !Number.isFinite(Number(v)));
      if (hasInvalid) {
        setError('Custom plan requires Amazon lookup, products, Checkila Analysis credits, and eBay accounts (0 or more).');
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        name: form.name,
        surname: form.surname,
        email: form.email,
        phoneNumber: form.phoneNumber,
        planId: form.planId,
      };

      if (isCustomPlan) {
        payload.requestedLimits = {
          amazonLookupLimitPerWeek: Number(form.amazonLookupLimitPerWeek),
          productsLimit: Number(form.productsLimit),
          marketAnalysisCreditsLimit: Number(form.marketAnalysisCreditsLimit),
          ebayAccountsLimit: Number(form.ebayAccountsLimit),
        };
        payload.customNote = form.customNote?.trim() || '';
      }

      await settingsAPI.submitSubscriptionRequest(payload);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Request Access</h3>
            <p className="mt-1 text-sm text-slate-300">
              Send your request and our admin team will contact you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            />
            <input
              type="text"
              value={form.surname}
              onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))}
              placeholder="Surname"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            />
          </div>

          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
          />

          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
            placeholder="Phone Number"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
          />

          <select
            value={form.planId}
            onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            disabled={lockPlan}
          >
            <option value="">Select plan</option>
            {availablePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
            <option value="custom">Custom Plan (Request)</option>
          </select>

          {form.planId === 'custom' ? (
            <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Custom Plan Requirements</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  value={form.amazonLookupLimitPerWeek}
                  onChange={(e) => setForm((p) => ({ ...p, amazonLookupLimitPerWeek: e.target.value }))}
                  placeholder="Amazon lookups / week"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  min="0"
                  value={form.productsLimit}
                  onChange={(e) => setForm((p) => ({ ...p, productsLimit: e.target.value }))}
                  placeholder="Products limit"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  min="0"
                  value={form.marketAnalysisCreditsLimit}
                  onChange={(e) => setForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  placeholder="Checkila Analysis credits"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  min="0"
                  value={form.ebayAccountsLimit}
                  onChange={(e) => setForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                  placeholder="eBay accounts"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>
              <textarea
                value={form.customNote}
                onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
                placeholder="Optional note (team size, usage patterns, extra needs, etc.)"
                className="min-h-[84px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? 'Submitting...' : 'Send Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
