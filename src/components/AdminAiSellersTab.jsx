import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { ExternalLink, Loader2, Plus, Store, Trash2 } from 'lucide-react';
import { aiAnalysisAPI } from '../services/api';

// Admin panel -> AI Sellers: eBay store names that AI Analysis (Checkila
// Analysis page) starts from — every run picks one of them at random.
// Backed by /ai-analysis/sellers (routes/aiAnalysis.js, admin-only).
export default function AdminAiSellersTab() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiAnalysisAPI.listSellers();
      setSellers(res.data?.sellers || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Satıcılar yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const value = input.trim();
    if (!value || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await aiAnalysisAPI.addSeller(value);
      setSellers(res.data?.sellers || []);
      setInput('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Satıcı əlavə edilmədi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (seller) => {
    const confirm = await Swal.fire({
      title: 'Satıcını sil?',
      text: `"${seller.sellerName}" AI Sellers siyahısından silinəcək.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sil',
      cancelButtonText: 'Ləğv et',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await aiAnalysisAPI.deleteSeller(seller.id);
      setSellers(res.data?.sellers || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Satıcı silinmədi');
    }
  };

  return (
    <div className="glass-card space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Sellers</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI Analysis hər dəfə bu siyahıdan təsadüfi bir eBay mağazası seçib analizə başlayır. Mağaza adını və ya mağaza linkini
          (ebay.com/str/… , ebay.com/usr/…) daxil edin.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Store size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-base h-10 pl-9 text-sm"
            placeholder="eBay mağaza adı (məs. bestfindsforu)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={saving}
          />
        </div>
        <button type="submit" disabled={saving || !input.trim()} className="btn-primary flex h-10 items-center justify-center gap-1.5 px-4 text-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Əlavə et
        </button>
      </form>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Yüklənir…</p>
      ) : sellers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Siyahı boşdur. AI Analysis-i başlatmaq üçün ən azı bir mağaza əlavə edin.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {sellers.map((seller) => (
            <li key={seller.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <a
                href={`https://www.ebay.com/usr/${encodeURIComponent(seller.sellerName)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {seller.sellerName}
                <ExternalLink size={12} className="shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(seller)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                aria-label={`${seller.sellerName} sil`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">Cəmi: {sellers.length}</p>
    </div>
  );
}
