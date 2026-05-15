import React from 'react';

export default function PurchaseHistoryModal({ state, onClose }) {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Purchase History</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" type="button">
            ✕
          </button>
        </div>

        {state.loading && (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-500 dark:text-slate-300">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p>Waiting for extension...</p>
            {state.jobId && <p className="text-xs text-slate-400">Job: {state.jobId}</p>}
          </div>
        )}

        {!state.loading && state.error && (
          <div className="text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-4 text-sm">
            {state.error}
          </div>
        )}

        {!state.loading && !state.error && (
          Array.isArray(state.data) && state.data.length > 0 ? (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50">
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-600 dark:text-slate-300">
                    <th className="p-2">Buyer</th>
                    <th className="p-2">Quantity</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((row, index) => (
                    <tr key={`${index}-${row?.buyer || 'buyer'}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2 text-slate-700 dark:text-slate-200">{row?.buyer || ''}</td>
                      <td className="p-2 text-slate-700 dark:text-slate-200">{row?.quantity || ''}</td>
                      <td className="p-2 text-slate-700 dark:text-slate-200">{row?.date || ''}</td>
                      <td className="p-2 text-slate-700 dark:text-slate-200">{row?.price || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-300 text-center py-6">No purchase history found.</p>
          )
        )}
      </div>
    </div>
  );
}