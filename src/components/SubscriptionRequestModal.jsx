import React, { useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';

function initialForm(selectedPlanId = '', requestType = 'subscription', defaultValues = {}) {
  return {
    name: defaultValues.name || '',
    surname: defaultValues.surname || '',
    email: defaultValues.email || '',
    phoneNumber: defaultValues.phoneNumber || '',
    planId: selectedPlanId,
    requestedCredits: defaultValues.requestedCredits || '',
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    customNote: defaultValues.customNote || '',
    requestType,
  };
}

export default function SubscriptionRequestModal({
  open,
  onClose,
  plans = [],
  selectedPlanId = '',
  lockPlan = false,
  onSuccess,
  requestType = 'subscription',
  defaultValues = {},
  title,
  description,
  submitLabel,
}) {
  const [form, setForm] = useState(initialForm(selectedPlanId, requestType, defaultValues));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availablePlans = useMemo(
    () => plans.filter((p) => p && p.isActive !== false),
    [plans]
  );

  const isSubscriptionRequest = requestType === 'subscription';
  const isCreditTopUpRequest = requestType === 'update_credits';
  const isResetRequest = requestType === 'reset_credits';

  React.useEffect(() => {
    setForm(initialForm(selectedPlanId, requestType, defaultValues));
    setError('');
  }, [selectedPlanId, open, requestType]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSubscriptionRequest) {
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
      return;
    }

    if (isCreditTopUpRequest) {
      const nextCredits = Number(form.requestedCredits);
      if (!Number.isFinite(nextCredits) || nextCredits <= 0) {
        setError('Please enter a credit amount greater than 0.');
        return;
      }

      try {
        setLoading(true);
        await settingsAPI.submitUpdateCreditRequest({
          requestedCredits: nextCredits,
          customNote: form.customNote?.trim() || '',
        });
        onSuccess?.();
        onClose?.();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Failed to send request');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      await settingsAPI.submitResetCreditsRequest({
        customNote: form.customNote?.trim() || '',
      });
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
            <h3 className="text-xl font-semibold text-white">
              {title || (isCreditTopUpRequest ? 'Request Credit Top-Up' : isResetRequest ? 'Request Subscription Reset' : 'Request Access')}
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              {description || (isCreditTopUpRequest
                ? 'Ask the admin team to add more credits to your account.'
                : isResetRequest
                  ? 'Ask the admin team to refresh your current subscription.'
                  : 'Send your request and our admin team will contact you.')}
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
          {isSubscriptionRequest ? (
            <>
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
            </>
          ) : isCreditTopUpRequest ? (
            <>
              <input
                type="number"
                min="1"
                value={form.requestedCredits}
                onChange={(e) => setForm((p) => ({ ...p, requestedCredits: e.target.value }))}
                placeholder="Requested credits"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              />
              <textarea
                value={form.customNote}
                onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
                placeholder="Optional note for the admin team"
                className="min-h-[84px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              />
            </>
          ) : (
            <textarea
              value={form.customNote}
              onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
              placeholder="Optional note for the admin team"
              className="min-h-[112px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            />
          )}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? 'Submitting...' : submitLabel || (isCreditTopUpRequest ? 'Send Credit Request' : isResetRequest ? 'Send Reset Request' : 'Send Request')}
          </button>
        </form>
      </div>
    </div>
  );
}
