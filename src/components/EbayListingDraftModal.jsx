import React, { useEffect, useState } from 'react';

export default function EbayListingDraftModal({
  isOpen,
  draft,
  error,
  submitting,
  updatingDraft,
  creatingProduct,
  submission,
  onClose,
  onConfirm,
  onUpdateDraft,
  onCreateProduct,
}) {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [merchantLocationKey, setMerchantLocationKey] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
    }
  }, [isOpen]);

  useEffect(() => {
    setTitle(String(draft?.title || ''));
    setDescription(String(draft?.description || ''));
    setPrice(draft?.price != null ? String(draft.price) : '');
    setMerchantLocationKey(String(draft?.merchantLocationKey || ''));
  }, [draft?.title, draft?.description, draft?.price, draft?.merchantLocationKey]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected image'));
      reader.readAsDataURL(file);
    });

  const saveDraftFields = async () => {
    if (!draft?.id || !onUpdateDraft) return;
    await onUpdateDraft({
      title,
      description,
      price,
      merchantLocationKey: String(merchantLocationKey || '').trim(),
    });
  };

  const handleConfirm = async () => {
    if (!draft?.id || !onConfirm) return;
    const trimmedLocationKey = String(merchantLocationKey || '').trim();
    if (!trimmedLocationKey) return;

    if (onUpdateDraft && trimmedLocationKey !== String(draft?.merchantLocationKey || '').trim()) {
      await onUpdateDraft({ merchantLocationKey: trimmedLocationKey });
    }

    await onConfirm();
  };

  const replaceImageAtIndex = async (index, file) => {
    if (!draft?.id || !onUpdateDraft || !file) return;
    const dataUrl = await readFileAsDataUrl(file);
    await onUpdateDraft({
      imageReplacements: [
        {
          index,
          dataUrl,
          fileName: file.name,
        },
      ],
    });
  };

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
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="input-base"
                  maxLength={80}
                  disabled={submitting || updatingDraft}
                />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-slate-500">ASIN</p>
                    <p className="font-semibold text-slate-800">{draft.asin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Price</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      className="input-base text-sm"
                      disabled={submitting || updatingDraft}
                    />
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
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Merchant Location Key (required)</p>
                  <input
                    type="text"
                    value={merchantLocationKey}
                    onChange={(event) => setMerchantLocationKey(event.target.value)}
                    className="input-base text-sm"
                    placeholder="warehouse-ny"
                    disabled={submitting || updatingDraft}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={saveDraftFields}
                    disabled={submitting || updatingDraft}
                  >
                    {updatingDraft ? 'Saving...' : 'Save edits'}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Description</p>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={8}
                  className="input-base w-full"
                  disabled={submitting || updatingDraft}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">Images</p>
                {(draft?.pictureUrls || []).length === 0 ? (
                  <p className="text-sm text-slate-600">No images available.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(draft.pictureUrls || []).map((url, idx) => (
                      <div key={`${url}-${idx}`} className="rounded-lg border border-slate-200 p-2 bg-white">
                        <div className="aspect-square rounded-md overflow-hidden border border-slate-100 bg-slate-50">
                          <img src={"https://back.checkila.com"+url} alt={`Listing image ${idx + 1}`} className="w-full h-full object-contain" />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">#{idx + 1}</span>
                          <label className="btn-secondary text-xs px-2 py-1 cursor-pointer">
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={submitting || updatingDraft}
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (!file) return;
                                await replaceImageAtIndex(idx, file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

              {!String(merchantLocationKey || '').trim() ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Enter your eBay Merchant Location Key before listing.
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
                    onClick={handleConfirm}
                    disabled={submitting || updatingDraft || !String(merchantLocationKey || '').trim()}
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
