import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/helpers';

export default function EbayListingDraftModal({
  isOpen,
  draft,
  error,
  submitting,
  creatingProduct,
  submission,
  onClose,
  onConfirm,
  onCreateProduct,
}) {
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] p-3 md:p-6 flex items-center justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting && !creatingProduct) {
          onClose?.();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white">
          <h2 className="text-lg md:text-xl font-semibold">List On eBay</h2>
          <p className="text-xs md:text-sm text-blue-100 mt-1">
            Review the generated listing first. eBay submission only happens after explicit confirmation.
          </p>
        </div>

        <div className="p-4 md:p-6 space-y-4 max-h-[76vh] overflow-y-auto">
          {!draft ? (
            <p className="text-sm text-slate-600">Preparing listing draft...</p>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 p-3 md:p-4 bg-slate-50">
                <p className="text-xs text-slate-500 mb-1">Title</p>
                <p className="text-sm font-semibold text-slate-900">{draft.title || 'Untitled'}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-slate-500">ASIN</p>
                    <p className="font-semibold text-slate-800">{draft.asin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Price</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(draft.price || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Quantity</p>
                    <p className="font-semibold text-slate-800">{draft.quantity || 1}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Category</p>
                    <p className="font-semibold text-slate-800">{draft.categoryId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Images</p>
                    <p className="font-semibold text-slate-800">{draft.imageCount || 0}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Description</p>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {draft.description || 'No description generated.'}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">AddItem XML preview</p>
                <pre className="rounded-lg border border-slate-200 bg-slate-950 text-slate-100 p-3 text-[11px] overflow-x-auto">
                  {draft.xmlPreview || ''}
                </pre>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {!submission ? (
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onConfirm}
                    disabled={submitting}
                  >
                    {submitting ? 'Listing on eBay...' : 'OK, List on eBay'}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Listing created successfully</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Item ID: {submission.itemId || '—'}
                    </p>
                    {submission.listingUrl ? (
                      <a
                        href={submission.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-700 underline"
                      >
                        Open listing
                      </a>
                    ) : null}
                  </div>

                  <div className="pt-1 border-t border-emerald-200">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">
                      Also add this to products page?
                    </p>
                    <label className="block text-xs text-emerald-800 mb-1">Email for alerts</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="input-base"
                    />
                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={creatingProduct}
                      >
                        No, done
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onCreateProduct?.(email)}
                        disabled={creatingProduct || !email.trim()}
                      >
                        {creatingProduct ? 'Adding product...' : 'Yes, add to products'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
