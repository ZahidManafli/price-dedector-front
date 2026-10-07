import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { walletAPI } from '../services/api';

const WALLET_TOPUP_PRESET_AMOUNTS_AZN = [5, 10, 20, 50];

// Checkila Smart balans artırımı — Epoint-in öz hosted checkout səhifəsinə
// yönləndirir (Luhive ödəniş axını ilə eyni forma-submit üsulu, bax
// WalletPaymentRedirectPage.jsx). Abunəlik deyil, birdəfəlik balans
// artırımıdır. Shared between DashboardPage.jsx and AmazonLookupPage.jsx.
export default function WalletTopupModal({ open, onClose }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const amountNum = Number(amount);
  const hasValidAmount = amount !== '' && Number.isFinite(amountNum) && amountNum >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasValidAmount) {
      setError('Minimum 1 AZN məbləğ daxil edin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await walletAPI.createTopup(amountNum);
      const requestId = res?.data?.requestId;
      if (!requestId) throw new Error('Sorğu yaradıla bilmədi.');
      navigate(`/wallet/pay/${requestId}`);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Balans artırma sorğusu alınmadı.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Checkila Smart balansını artır</h3>
            <p className="mt-1 text-sm text-slate-400">
              Balans Checkila Smart ilə eBay-ə avtomatik listinq zamanı xərclənən süni intellekt xərclərini ödəmək üçündür.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {WALLET_TOPUP_PRESET_AMOUNTS_AZN.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                disabled={loading}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  String(preset) === amount
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {preset} AZN
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Məbləğ (AZN)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              disabled={loading}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !hasValidAmount}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? 'Yönləndirilir...' : 'Ödənişə keç'}
          </button>
        </form>
      </div>
    </div>
  );
}
