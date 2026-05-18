import React, { useMemo } from 'react';
import { calculateLast7DaysSoldCount, normalizePurchaseHistoryRow } from '../utils/purchaseHistory';

export default function PurchaseHistoryModal({ state, onClose }) {
  if (!state) return null;

  const rows = useMemo(
    () => (Array.isArray(state.data) ? state.data.map((row) => normalizePurchaseHistoryRow(row)) : []),
    [state.data]
  );
  const soldLast7Days = useMemo(() => calculateLast7DaysSoldCount(state.data || []), [state.data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-3xl mx-4 border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Purchase History</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" type="button">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {state.loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-500 dark:text-slate-300">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p>Waiting for extension...</p>
              {state.jobId && <p className="text-xs text-slate-400 break-all">Job: {state.jobId}</p>}
            </div>
          )}

          {!state.loading && state.error && (
            <div className="text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-4 text-sm">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && (
            <>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-3 text-sm text-slate-700 dark:text-slate-200">
                Last 7 days sold: <span className="font-semibold">{soldLast7Days}</span>
              </div>

              {rows.length > 0 ? (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-600 dark:text-slate-300">
                        <th className="p-2">Buyer</th>
                        <th className="p-2">Quantity</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${index}-${row?.buyer || 'buyer'}`} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2 text-slate-700 dark:text-slate-200">{row?.buyer || ''}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-200">{row?.quantity ?? ''}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-200">{row?.date || ''}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-200">{row?.price || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-300 text-center py-6">No purchase history found.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}