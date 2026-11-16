import React, { useRef, useState } from 'react';
import { dewisoAPI } from '../services/api';

// Shared by ListOnEbayModal.jsx ("Checkila Analysis" -> List on eBay) and
// AmazonLookupPage.jsx (Checkila Smart's listing preview) so both offer the
// exact same image-editing UX: replace one picture, or add one or more at
// once, either by pasting a URL or uploading from disk.
//
// mode: 'edit' replaces the image at `imageIndex` (single file only); 'add' appends
// new ones after the current gallery (imageIndex is the next free slot, currentUrl
// is null) and accepts multiple files selected at once.
// onConfirm is always called with an ARRAY of { displayUrl, maxDimensionImageUrl }
// — length 1 for a URL paste or an 'edit' replace, length N for a multi-file add.
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

export default function ImageEditModal({ isDark, currentUrl, imageIndex, mode = 'edit', onConfirm, onClose }) {
  const [tab, setTab] = useState('url');
  const [urlInput, setUrlInput] = useState('');
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const applyFilesIfValid = (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;
    const selected = mode === 'add' ? incoming : incoming.slice(0, 1);
    const oversized = selected.find((f) => f.size > MAX_IMAGE_FILE_BYTES);
    if (oversized) {
      setError(`File is too large (${(oversized.size / (1024 * 1024)).toFixed(1)} MB) — max 10 MB`);
      return;
    }
    setFiles(selected);
    setFilePreviews(selected.map((f) => URL.createObjectURL(f)));
    setError(null);
  };

  const handleFileChange = (e) => {
    applyFilesIfValid(e.target.files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    applyFilesIfValid(e.dataTransfer.files);
  };

  const handleConfirm = async () => {
    setError(null);
    if (tab === 'url') {
      const trimmed = urlInput.trim();
      if (!trimmed) return setError('Please enter an image URL');
      onConfirm([{ displayUrl: trimmed, maxDimensionImageUrl: trimmed }]);
      return;
    }
    if (!files.length) return setError('Please select an image file');
    try {
      setUploading(true);
      const formData = new FormData();
      files.forEach((f) => formData.append('images', f));
      formData.append('templateId', `listing-image-edit-${Date.now()}`);
      const res = await dewisoAPI.uploadImages(formData);
      const items = res?.data?.items || [];
      if (!items.length) throw new Error('Upload returned no items');
      const failed = items.find((it) => it.status === 'failed');
      if (failed) throw new Error(failed.error || 'Image upload failed');
      const uploaded = items.map((it) => {
        const maxDimensionImageUrl = it.maxDimensionImageUrl || it.localUrl;
        const displayUrl = it.localUrl || it.maxDimensionImageUrl;
        if (!maxDimensionImageUrl) throw new Error('No eBay image URL returned — reconnect your eBay account');
        return { displayUrl, maxDimensionImageUrl };
      });
      onConfirm(uploaded);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const overlay = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4';
  const card = `rounded-2xl border shadow-2xl w-full max-w-sm ${
    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
  }`;
  const tabBtn = (active) =>
    `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
      active
        ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
    }`;
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
  }`;

  return (
    <div className={overlay}>
      <div className={card}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <h3 className="text-sm font-semibold">{mode === 'add' ? 'Add Image(s)' : `Edit Image ${imageIndex + 1}`}</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {mode === 'add' ? 'Add a URL, or upload one or more images from your computer' : 'Replace with a URL or upload from your computer'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {currentUrl && (
            <div className={`rounded-xl overflow-hidden border aspect-video flex items-center justify-center ${
              isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
            }`}>
              <img src={filePreviews[0] || currentUrl} alt="Current" className="max-h-36 object-contain" />
            </div>
          )}
          <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button type="button" className={tabBtn(tab === 'url')} onClick={() => setTab('url')}>🔗 Paste URL</button>
            <button type="button" className={tabBtn(tab === 'upload')} onClick={() => setTab('upload')}>💻 Upload File</button>
          </div>
          {tab === 'url' && (
            <div className="space-y-2">
              <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Image URL</label>
              <input
                type="url" value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                className={inputClass} placeholder="https://example.com/image.jpg"
              />
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                The URL will be sent directly to eBay as the listing image.
              </p>
            </div>
          )}
          {tab === 'upload' && (
            <div className="space-y-2">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  isDark
                    ? 'border-slate-600 hover:border-blue-500 bg-slate-800/40'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50'
                }`}
              >
                {filePreviews.length > 0 ? (
                  filePreviews.length === 1 ? (
                    <img src={filePreviews[0]} alt="Preview" className="mx-auto max-h-28 object-contain rounded-lg" />
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {filePreviews.map((src, i) => (
                        <img key={i} src={src} alt={`Preview ${i + 1}`} className="h-16 w-16 object-cover rounded-md border border-slate-500/30" />
                      ))}
                    </div>
                  )
                ) : (
                  <>
                    <div className="text-2xl mb-2">📁</div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {mode === 'add' ? 'Click or drag & drop image(s)' : 'Click or drag & drop an image'}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>JPG, PNG, WEBP · max 10 MB each</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={mode === 'add'}
                className="hidden"
                onChange={handleFileChange}
              />
              {files.length > 0 && (
                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {files.length === 1
                    ? `📎 ${files[0].name} (${(files[0].size / 1024).toFixed(0)} KB)`
                    : `📎 ${files.length} files selected`}
                </p>
              )}
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {files.length > 1
                  ? 'Images will be uploaded to eBay Picture Services and linked to your listing.'
                  : 'Image will be uploaded to eBay Picture Services and linked to your listing.'}
              </p>
            </div>
          )}
          {error && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              isDark ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600'
            }`}>
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={uploading} className="btn-secondary flex-1 py-2 text-sm disabled:opacity-60">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={uploading} className="btn-primary flex-1 py-2 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Uploading…
                </>
              ) : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
