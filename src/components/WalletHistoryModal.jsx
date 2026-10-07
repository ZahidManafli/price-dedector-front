import React, { useCallback, useEffect, useState } from 'react';
import { X, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { walletAPI } from '../services/api';

const PAGE_SIZE = 50;

const TYPE_LABELS = {
  topup: 'Balans artırımı',
  amazon_lookup_charge: 'Checkila Smart xərci',
  refund: 'Geri qaytarma',
  adjustment: 'Düzəliş',
};

function formatReference(tx) {
  if (tx.type === 'amazon_lookup_charge' && tx.reference) return `ASIN: ${tx.reference}`;
  return null;
}

// Detailed balance ledger — every top-up and every per-run AI-cost charge,
// with its own reference (ASIN) and the resulting balance at that point in
// time, so the user can see exactly what each charge was for. Backed by
// GET /wallet/transactions (routes/wallet.js). Shared between Dashboard and
// the Checkila Smart page.
export default function WalletHistoryModal({ open, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (offset = 0, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const res = await walletAPI.getTransactions(PAGE_SIZE, offset);
      const { transactions: rows = [], total: totalCount = 0 } = res?.data || {};
      setTransactions((prev) => (append ? [...prev, ...rows] : rows));
      setTotal(totalCount);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Balans tarixçəsi yüklənmədi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (open) load(0, false);
  }, [open, load]);

  if (!open) return null;

  const hasMore = transactions.length < total;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white">Balans tarixçəsi</h3>
            <p className="mt-1 text-sm text-slate-400">Hər artırım və hər xərcləmənin detallı siyahısı.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-300 py-4">{error}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Hələ heç bir balans əməliyyatı yoxdur.</p>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.amountAzn > 0;
              const reference = formatReference(tx);
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-start gap-2.5"
                >
                  {isCredit ? (
                    <ArrowUpCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowDownCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">{TYPE_LABELS[tx.type] || tx.type}</p>
                      <p className={`text-sm font-semibold shrink-0 ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isCredit ? '+' : ''}
                        {Number(tx.amountAzn).toFixed(4)} ₼
                      </p>
                    </div>
                    {reference && <p className="text-xs text-slate-400 mt-0.5">{reference}</p>}
                    {tx.description && <p className="text-xs text-slate-500 mt-0.5">{tx.description}</p>}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[11px] text-slate-500">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('az-AZ') : ''}
                      </p>
                      <p className="text-[11px] text-slate-500">Qalıq: {Number(tx.balanceAfterAzn).toFixed(4)} ₼</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {hasMore && !loading && (
            <button
              type="button"
              onClick={() => load(transactions.length, true)}
              disabled={loadingMore}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
            >
              {loadingMore ? 'Yüklənir...' : 'Daha çox göstər'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
