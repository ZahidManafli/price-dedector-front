// Utility: Convert Markdown to plain text
function markdownToPlainText(md) {
  return String(md)
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/#+\s?(.*)/g, '$1') // headings
    .replace(/\n/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[.*?\]\(.*?\)/g, '') // links
    .replace(/[`>\-]/g, '') // code, blockquote, lists
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEbayListingUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}
/**
 * ListOnEbayModal.jsx  (updated)
 *
 * Changes vs original:
 *  1. New `scrapedOverride` prop — when provided (from bucket), pre-fills the form
 *     with already-scraped data and skips the re-scrape network call.
 *  2. New `onSuccess` prop — called with the listing result when listing succeeds.
 *     The parent (BucketDrawer) uses this to record the successful listing and
 *     remove the item from the bucket.
 *  3. Everything else is identical to the original.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, CalendarClock, Check, CheckCircle2, CircleDollarSign, ExternalLink, FileText, ImagePlus, Info, ListChecks, Loader2, Pencil, Plus, Rocket, Store, Truck, X, XCircle } from 'lucide-react';
import { setListingJobHidden, subscribeListingJobs, trackListingJob } from '../utils/listingJobTracker';
import { ebayAPI, dewisoAPI } from '../services/api';
import ScheduleListingModal from './ScheduleListingModal';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

// Must match the backend's own cap (pictureUrls.slice(0, 24) and
// createEbayImagesFromUrls's { max: 24 }) in POST /ebay/quick-list — keep both in
// sync, since a mismatch here silently drops images past whichever is smaller.
const MAX_LISTING_IMAGES = 24;

const CONDITION_OPTIONS = [
  { id: 1000, label: 'New' },
  { id: 1500, label: 'New Other' },
  { id: 2000, label: 'Certified Refurbished' },
  { id: 2500, label: 'Seller Refurbished' },
  { id: 3000, label: 'Used - Like New' },
  { id: 4000, label: 'Used - Very Good' },
  { id: 5000, label: 'Used - Good' },
  { id: 6000, label: 'Used - Acceptable' },
  { id: 7000, label: 'For Parts or Not Working' },
];

// Shared cap on a single uploaded image file — matches the backend's
// /dewiso/images/upload multer limit (see dewiso.js).
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

// ─── Item Origin (Country/Region of Manufacture) ──────────────────────────────
// eBay item specifics carry this aspect under a few different display names
// depending on category/scrape source — match any of them as "the" origin field.
const ITEM_ORIGIN_SPEC_NAME = 'Country/Region of Manufacture';
const ITEM_ORIGIN_SPEC_ALIASES = new Set([
  'country/region of manufacture',
  'country of manufacture',
  'region of manufacture',
  'country of origin',
  'item origin',
]);
const isItemOriginSpec = (spec) =>
  ITEM_ORIGIN_SPEC_ALIASES.has(String(spec?.name || spec?.label || '').trim().toLowerCase());

// "United States" first — it's the default value shown in the Select whenever the
// listing has no real scraped/known origin yet.
const COUNTRY_OPTIONS = [
  'United States', 'China', 'United Kingdom', 'Canada', 'Germany', 'France', 'Italy',
  'Spain', 'Japan', 'South Korea', 'India', 'Vietnam', 'Mexico', 'Turkey', 'Australia',
  'Netherlands', 'Poland', 'Bangladesh', 'Indonesia', 'Thailand', 'Taiwan', 'Cambodia',
  'Portugal', 'Brazil', 'Switzerland', 'Unknown',
];

// Guarantees the origin spec is always present in the list so the modal can always
// render it as a Select. Only overrides the value with the "United States" default
// when it's genuinely missing/blank/"Unknown" — a real scraped country is left as-is.
function ensureItemOriginSpec(list) {
  const arr = Array.isArray(list) ? list.map((s) => ({ ...s })) : [];
  const idx = arr.findIndex(isItemOriginSpec);
  if (idx === -1) {
    arr.push({ name: ITEM_ORIGIN_SPEC_NAME, label: ITEM_ORIGIN_SPEC_NAME, value: 'United States' });
    return arr;
  }
  const currentValue = String(arr[idx].value || '').trim();
  if (!currentValue || currentValue.toLowerCase() === 'unknown') {
    arr[idx] = { ...arr[idx], value: 'United States' };
  }
  return arr;
}

// ─── ImageEditModal ────────────────────────────────────────────────────────────
// mode: 'edit' replaces the image at `imageIndex` (single file only); 'add' appends
// new ones after the current gallery (imageIndex is the next free slot, currentUrl
// is null) and accepts multiple files selected at once.
// onConfirm is always called with an ARRAY of { displayUrl, maxDimensionImageUrl }
// — length 1 for a URL paste or an 'edit' replace, length N for a multi-file add.
function ImageEditModal({ isDark, currentUrl, imageIndex, mode = 'edit', onConfirm, onClose }) {
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

// ─── ListOnEbayModal ───────────────────────────────────────────────────────────
/**
 * @param {object}   item            - The raw eBay browse result item
 * @param {object}  [scrapedOverride] - Pre-scraped data from bucket (skips re-scrape)
 * @param {boolean}  isDark
 * @param {function} onClose
 * @param {function} [onSuccess]     - Called with listing result on successful list
 */
export default function ListOnEbayModal({ item, scrapedOverride, onClose, isDark, onSuccess, onUpdateItem }) {
  const { t } = useTranslation();
  // If scrapedOverride is present, we are editing a bucket item
  const isEditBucketItem = !!scrapedOverride && typeof onUpdateItem === 'function';
  const [form, setForm] = useState({
    title: '',
    description: '',
    useRawDewisoHtml: false,
    price: '',
    quantity: '1',
    categoryId: '',
    conditionId: 1000,
    freeShipping: true,
    dispatchTimeMax: '3',
    paymentPolicyId: '',
    returnPolicyId: '',
    fulfillmentPolicyId: '',
  });

  const [sellerPolicies, setSellerPolicies] = useState({
    returnPolicies: [],
    paymentPolicies: [],
    fulfillmentPolicies: [],
    businessPolicyIds: {},
  });
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [itemSpecifics, setItemSpecifics] = useState([]);
  const [displayUrls, setDisplayUrls] = useState([]);
  const [maxDimensionImageUrls, setmaxDimensionImageUrls] = useState([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [loadingSpecifics, setLoadingSpecifics] = useState(false);
  const [editingImageIdx, setEditingImageIdx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  // Guards against the slow background scrapeItemDetails() call (below) landing
  // AFTER the user has already added/reordered their own images and clobbering
  // the gallery with just the original source listing's own picture count —
  // see handleImageEdited/moveImage, which set this the moment the user
  // touches the gallery.
  const hasUserEditedImagesRef = useRef(false);
  const [result, setResult] = useState(null);
  const [jobState, setJobState] = useState(null); // background listing job (services/listingJobs.js)
  const successReportedRef = useRef(false);
  const [error, setError] = useState(null);
  const quillRef = useRef(null);
  const quillContainerRef = useRef(null);

  // ── 1. Fetch seller policies ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadPolicies() {
      try {
        setLoadingPolicies(true);
        const res = await ebayAPI.getStatus();
        if (cancelled) return;
        const snapshot = res?.data?.sellerSnapshot || {};
        if (snapshot.sellerRegistrationCompleted === false) {
          setSellerPolicies({ returnPolicies: [], paymentPolicies: [], fulfillmentPolicies: [], businessPolicyIds: snapshot.businessPolicyIds || {} });
          return;
        }
        setSellerPolicies({
          returnPolicies: snapshot.returnPolicies || [],
          paymentPolicies: snapshot.paymentPolicies || [],
          fulfillmentPolicies: snapshot.fulfillmentPolicies || [],
          businessPolicyIds: snapshot.businessPolicyIds || {},
        });
      } catch (err) {
        console.error('[ListOnEbayModal] Failed to load seller policies:', err);
      } finally {
        if (!cancelled) setLoadingPolicies(false);
      }
    }
    loadPolicies();
    return () => { cancelled = true; };
  }, []);

  // ── 2. Pre-fill form + scrape item details ────────────────────────────────
  useEffect(() => {
    if (!item) return;

    hasUserEditedImagesRef.current = false;

    // ── If bucket already scraped — use override directly, no re-scrape ──
    if (scrapedOverride) {
      const upscale = (url) => String(url || '').replace(/\/s-l\d+(\.\w+)(\?.*)?$/, '/s-l1600$1$2');
      const overridePics = Array.isArray(scrapedOverride.pictureUrls)
        ? scrapedOverride.pictureUrls
        : item.imageUrl ? [upscale(item.imageUrl)] : [];

      setForm((prev) => ({
        ...prev,
        title: String(scrapedOverride.title || item.title || '').slice(0, 80),
        description: String(scrapedOverride.description || item.title || ''),
        useRawDewisoHtml: !!scrapedOverride.useRawDewisoHtml,
        price: scrapedOverride.price != null ? String(Number(scrapedOverride.price).toFixed(2)) : '',
        quantity: String(scrapedOverride.quantity || 1),
        categoryId: String(scrapedOverride.categoryId || item.categoryId || item.raw?.categoryId || ''),
        conditionId: scrapedOverride.conditionId ?? 1000,
        freeShipping: scrapedOverride.freeShipping ?? true,
        dispatchTimeMax: String(scrapedOverride.dispatchTimeMax || 3),
      }));
      setItemSpecifics(ensureItemOriginSpec(scrapedOverride.itemSpecifics || []));
      setDisplayUrls(overridePics);
      setmaxDimensionImageUrls(overridePics);
      return; // Skip the normal scrape path
    }

    // ── Normal path (no override) ─────────────────────────────────────────
    setForm((prev) => ({
      ...prev,
      title: String(item.title || '').slice(0, 80),
      description: String(item.description || item.title || ''),
      useRawDewisoHtml: false,
      price: item.priceValue ? String(Number(item.priceValue).toFixed(2)) : '',
      categoryId: String(item.categoryId || item.raw?.categoryId || ''),
    }));

    // Always run (even when item.itemSpecifics is empty) so the origin row is
    // present with its "United States" default from the moment the modal opens,
    // not only after/if the async scrape below returns.
    setItemSpecifics(ensureItemOriginSpec(item.itemSpecifics));

    const itemUrl =
      item.itemUrl || item.itemWebUrl || item.maxDimensionImageUrl || item.url || item.raw?.itemWebUrl || item.raw?.itemUrl || item.raw?.productUrl ||
      (item.legacyItemId ? `https://www.ebay.com/itm/${item.legacyItemId}` : null) ||
      (item.itemId ? `https://www.ebay.com/itm/${item.itemId}` : null);
    const normalizedItemUrl = normalizeEbayListingUrl(itemUrl);

    const upscale = (url) => String(url || '').replace(/\/s-l\d+(\.\w+)(\?.*)?$/, '/s-l1600$1$2');
    const initialUrls = [];
    if (item?.imageUrl) initialUrls.push(upscale(item.imageUrl));
    if (Array.isArray(item?.additionalImages)) {
      item.additionalImages.slice(0, 11).forEach((u) => initialUrls.push(upscale(u)));
    }
    if (initialUrls.length > 0) {
      setDisplayUrls(initialUrls);
      setmaxDimensionImageUrls(initialUrls);
    }

    if (!normalizedItemUrl) return;

    let cancelled = false;
    setLoadingSpecifics(true);

    ebayAPI
      .scrapeItemDetails(normalizedItemUrl)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};
        if (data.categoryId) setForm((prev) => ({ ...prev, categoryId: String(data.categoryId) }));
        if (Array.isArray(data.itemSpecifics) && data.itemSpecifics.length > 0) setItemSpecifics(ensureItemOriginSpec(data.itemSpecifics));
        // This scrape is a slow background call — if the user has already
        // started adding/reordering their own images by the time it resolves,
        // applying it here would silently replace their gallery with just the
        // original source listing's own (often much smaller) picture set.
        if (!hasUserEditedImagesRef.current && Array.isArray(data.pictureUrls) && data.pictureUrls.length > 0) {
          setDisplayUrls(data.pictureUrls);
          setmaxDimensionImageUrls(data.pictureUrls);
          setSelectedImageIdx(0);
        }
      })
      .catch((err) => { console.warn('[ListOnEbayModal] scrapeItemDetails failed (non-fatal):', err?.message); })
      .finally(() => { if (!cancelled) setLoadingSpecifics(false); });

    return () => { cancelled = true; };
  }, [item, scrapedOverride]);

  // ── 3. Auto-fill policy IDs ───────────────────────────────────────────────
  useEffect(() => {
    const bpIds = sellerPolicies.businessPolicyIds || {};
    const paymentPolicyId = bpIds.paymentPolicyId || sellerPolicies.paymentPolicies[0]?.paymentPolicyId || '';
    const returnPolicyId = bpIds.returnPolicyId || sellerPolicies.returnPolicies[0]?.returnPolicyId || '';
    const fulfillmentPolicyId = bpIds.shippingPolicyId || sellerPolicies.fulfillmentPolicies[0]?.fulfillmentPolicyId || '';
    setForm((prev) => ({ ...prev, paymentPolicyId, returnPolicyId, fulfillmentPolicyId }));
  }, [sellerPolicies]);

  // Initialize Quill editor once
  useEffect(() => {
    if (!quillContainerRef.current || quillRef.current) return;
    const q = new Quill(quillContainerRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          [{ align: [] }],
          ['clean'],
        ],
      },
    });
    quillRef.current = q;
    if (form.description) q.clipboard.dangerouslyPasteHTML(form.description);
    return () => {
      quillRef.current = null;
    };
  }, [quillContainerRef]);

  // Sync form.description into Quill when it changes (e.g. scrapedOverride)
  useEffect(() => {
    if (quillRef.current) {
      const html = form.description || '';
      const editorHtml = quillRef.current.root?.innerHTML || '';
      if (editorHtml !== html) quillRef.current.clipboard.dangerouslyPasteHTML(html);
    }
  }, [form.description]);

  const getDescriptionHtml = () => {
    if (quillRef.current) return (quillRef.current.root?.innerHTML || '').trim();
    return (form.description || '').trim();
  };

  const getDescriptionPlainText = () => {
    if (quillRef.current) return (quillRef.current.getText?.() || '').replace(/\u00a0/g, ' ').trim();
    return getDescriptionHtml()
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // idx >= the current array length means "Add Image" was used — append rather
  // than overwrite an existing slot. `images` is always an array (see
  // ImageEditModal) — length 1 for a URL paste or an 'edit' replace, length N for
  // a multi-file add; extra entries beyond the first are only ever appended
  // (an 'edit' replace never produces more than one, but this stays safe either
  // way), capped so the gallery never exceeds MAX_LISTING_IMAGES.
  const handleImageEdited = (images) => {
    const idx = editingImageIdx;
    const list = Array.isArray(images) ? images : [images];
    if (!list.length) { setEditingImageIdx(null); return; }

    hasUserEditedImagesRef.current = true;
    const isAppend = idx >= displayUrls.length;
    const room = Math.max(0, MAX_LISTING_IMAGES - displayUrls.length);
    const toAppend = isAppend ? list.slice(0, room) : list.slice(1);

    setDisplayUrls((prev) => {
      const next = [...prev];
      if (isAppend) toAppend.forEach((img) => next.push(img.displayUrl));
      else { next[idx] = list[0].displayUrl; toAppend.forEach((img) => next.push(img.displayUrl)); }
      return next;
    });
    setmaxDimensionImageUrls((prev) => {
      const next = [...prev];
      if (isAppend) toAppend.forEach((img) => next.push(img.maxDimensionImageUrl));
      else { next[idx] = list[0].maxDimensionImageUrl; toAppend.forEach((img) => next.push(img.maxDimensionImageUrl)); }
      // Propagate to bucket if possible — done once here (after both arrays are
      // conceptually the same shape) rather than in both setState updaters.
      if (typeof onUpdateItem === 'function') {
        onUpdateItem({ scrapedData: { ...scrapedOverride, pictureUrls: next } });
      }
      return next;
    });
    setEditingImageIdx(null);
    setSelectedImageIdx(idx);
  };

  // Swaps the image at `idx` with its left/right neighbor — the reorder control on
  // each thumbnail. Keeps displayUrls/maxDimensionImageUrls in lockstep and follows
  // the moved image with the selection so the main preview doesn't jump elsewhere.
  const moveImage = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= displayUrls.length) return;

    hasUserEditedImagesRef.current = true;
    const swap = (arr) => {
      const next = [...arr];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    };

    setDisplayUrls((prev) => swap(prev));
    setmaxDimensionImageUrls((prev) => {
      const next = swap(prev);
      if (typeof onUpdateItem === 'function') {
        onUpdateItem({ scrapedData: { ...scrapedOverride, pictureUrls: next } });
      }
      return next;
    });
    setSelectedImageIdx((prev) => (prev === idx ? targetIdx : prev === targetIdx ? idx : prev));
  };

  const canAddMoreImages = displayUrls.length < MAX_LISTING_IMAGES;
  const handleAddImage = () => {
    if (!canAddMoreImages) return;
    setEditingImageIdx(displayUrls.length);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleItemSpecificChange = (specIndex, value) => {
    setItemSpecifics((prev) => {
      const next = [...prev];
      next[specIndex] = { ...next[specIndex], value };
      return next;
    });
  };

  // Shared basic validation — used by both the immediate "List" submit and the
  // "Planlaşdırılmış Listing" button, so a user can't schedule an incomplete listing.
  const validateBasicFields = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.price || Number(form.price) <= 0) return 'Price must be a positive number';
    if (!form.categoryId.trim()) return 'Category ID is required';
    return null;
  };

  // Builds the exact payload sent to POST /ebay/quick-list — also reused, as-is,
  // by the "Planlaşdırılmış Listing" flow (POST /ebay/scheduled-listings expects
  // the identical shape plus scheduledFor/ebayAccountId).
  const buildListingPayload = () => {
    const pictureUrlsHiRes = [...new Set(maxDimensionImageUrls.filter(Boolean))];
    const EXCLUDED_SPECIFICS = new Set(['condition', 'item condition']);
    const itemSpecificsMap = {};
    itemSpecifics.forEach(({ name, label, value }) => {
      const key = name || label;
      if (key && value && !EXCLUDED_SPECIFICS.has(String(key).toLowerCase().trim())) {
        itemSpecificsMap[key] = value;
      }
    });

    return {
      title: form.title.trim(),
      description: form.useRawDewisoHtml
        ? (getDescriptionHtml() || markdownToPlainText(form.title.trim()))
        : (getDescriptionPlainText() || form.title.trim()),
      useRawDewisoHtml: !!form.useRawDewisoHtml,
      price: Number(form.price),
      quantity: Math.max(1, Number(form.quantity) || 1),
      categoryId: form.categoryId.trim(),
      conditionId: Number(form.conditionId),
      freeShipping: form.freeShipping,
      dispatchTimeMax: Number(form.dispatchTimeMax) || 3,
      currency: 'USD',
      pictureUrls: pictureUrlsHiRes,
      itemSpecifics: Object.keys(itemSpecificsMap).length > 0 ? itemSpecificsMap : null,
      ...(form.paymentPolicyId ? { paymentPolicyId: form.paymentPolicyId } : {}),
      ...(form.returnPolicyId ? { returnPolicyId: form.returnPolicyId } : {}),
      ...(form.fulfillmentPolicyId ? { fulfillmentPolicyId: form.fulfillmentPolicyId } : {}),
    };
  };

  const handleOpenSchedule = () => {
    const validationError = validateBasicFields();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setShowScheduleModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const validationError = validateBasicFields();
    if (validationError) return setError(validationError);

    if (isEditBucketItem) {
      // Save changes to bucket item only
      setSubmitting(true);
      try {
        const pictureUrlsHiRes = [...new Set(maxDimensionImageUrls.filter(Boolean))];
        // Always build a new scrapedData object, never mutate or spread scrapedOverride
        const newScrapedData = {
          title: form.title.trim(),
          // Convert Markdown to plain text for safety
          description: getDescriptionHtml() || markdownToPlainText(form.title.trim()),
          useRawDewisoHtml: !!form.useRawDewisoHtml,
          price: Number(form.price),
          quantity: Math.max(1, Number(form.quantity) || 1),
          categoryId: form.categoryId.trim(),
          conditionId: Number(form.conditionId),
          freeShipping: form.freeShipping,
          dispatchTimeMax: Number(form.dispatchTimeMax) || 3,
          currency: 'USD',
          pictureUrls: pictureUrlsHiRes,
          itemSpecifics: Array.isArray(itemSpecifics) ? itemSpecifics.map(s => ({ ...s })) : [],
          paymentPolicyId: form.paymentPolicyId,
          returnPolicyId: form.returnPolicyId,
          fulfillmentPolicyId: form.fulfillmentPolicyId,
        };
        onUpdateItem({ scrapedData: newScrapedData });
        setSubmitting(false);
        onClose();
      } catch (err) {
        setError(err?.message || 'Failed to save changes');
        setSubmitting(false);
      }
      return;
    }

    // Normal listing flow — runs as a background job (backend services/listingJobs.js):
    // the user can close the modal right away and is notified when it's done.
    try {
      setSubmitting(true);
      const payload = buildListingPayload();
      const res = await ebayAPI.startListingJob(payload);
      const jobId = res?.data?.jobId;
      if (!jobId) throw new Error(t('listingModal.failedToList'));
      const job = { id: jobId, status: 'pending', title: payload.title, imageUrl: payload.pictureUrls?.[0] || null, hiddenWhileModalOpen: true };
      trackListingJob(job);
      setJobState(job);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('listingModal.failedToList'));
    } finally {
      setSubmitting(false);
    }
  };

  // Follow the background job while the modal is open (the tracker does the polling).
  useEffect(() => {
    if (!jobState?.id) return undefined;
    const jobId = jobState.id;
    const unsubscribe = subscribeListingJobs((all) => {
      const next = all.find((j) => j.id === jobId);
      if (next) setJobState({ ...next });
    });
    return () => {
      unsubscribe();
      setListingJobHidden(jobId, false);
    };
  }, [jobState?.id]);

  useEffect(() => {
    if (jobState?.status === 'done' && !successReportedRef.current) {
      successReportedRef.current = true;
      setResult({ success: true, itemId: jobState.itemId, listingUrl: jobState.listingUrl });
      if (typeof onSuccess === 'function') onSuccess({ success: true, itemId: jobState.itemId, listingUrl: jobState.listingUrl });
    }
  }, [jobState?.status]);

  const resetForAnother = () => {
    if (jobState?.id) setListingJobHidden(jobState.id, false);
    successReportedRef.current = false;
    setJobState(null);
    setResult(null);
    setError(null);
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputClass = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500'
  }`;
  const labelClass = `mb-1.5 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const sectionBox = `rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/70'}`;
  const SectionTitle = ({ icon: Icon, children, extra }) => (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className={`flex items-center gap-2 text-sm font-semibold ${strong}`}>
        <Icon size={15} className="text-indigo-500" />
        {children}
      </p>
      {extra}
    </div>
  );
  const policyName = (list, idKey, id) => list.find((p) => p[idKey] === id)?.name;
  const titleLen = form.title.length;
  const jobRunning = jobState && (jobState.status === 'pending' || jobState.status === 'processing');
  const jobFailed = jobState && (jobState.status === 'failed' || jobState.status === 'gone');

  const statusScreen = (icon, tone, title, text, actions, extra = null) => (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      <h3 className={`mt-5 text-lg font-bold ${strong}`}>{title}</h3>
      <p className={`mt-2 max-w-md text-sm leading-relaxed ${muted}`}>{text}</p>
      {extra}
      <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
        <div className={`flex max-h-[94vh] w-full ${jobState || result ? 'max-w-xl' : 'max-w-5xl'} flex-col overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>

          {/* Header */}
          <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Store size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{isEditBucketItem ? t('listingModal.ui.editBucketTitle') : t('listingModal.title')}</h2>
                <p className={`truncate text-xs ${muted}`}>
                  {scrapedOverride ? t('listingModal.activeAccountFromBucket') : t('listingModal.activeAccount')}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={t('listingModal.close')} className={`rounded-lg p-2 transition ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>

          {/* ── Background job / result screens ── */}
          {jobRunning ? (
            statusScreen(
              <Loader2 size={28} className="animate-spin text-indigo-500" />,
              isDark ? 'bg-indigo-500/15' : 'bg-indigo-50',
              t('listingModal.job.runningTitle'),
              t('listingModal.job.runningText'),
              <button type="button" onClick={onClose} className="btn-primary px-6 py-2.5">{t('listingModal.job.closeAndContinue')}</button>,
              <div className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                {jobState.imageUrl && <img src={jobState.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />}
                <div className="min-w-0">
                  <p className={`line-clamp-2 text-sm font-semibold ${strong}`}>{jobState.title}</p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${muted}`}><Bell size={12} /> {t('listingModal.job.notifyHint')}</p>
                </div>
              </div>
            )
          ) : jobFailed ? (
            statusScreen(
              <XCircle size={30} className="text-rose-500" />,
              isDark ? 'bg-rose-500/15' : 'bg-rose-50',
              t('listingModal.job.failedTitle'),
              jobState.error || t('listingModal.failedToList'),
              <>
                <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5">{t('listingModal.close')}</button>
                <button type="button" onClick={() => { setListingJobHidden(jobState.id, false); setJobState(null); }} className="btn-primary px-5 py-2.5">{t('listingModal.job.backToForm')}</button>
              </>
            )
          ) : result ? (
            statusScreen(
              <CheckCircle2 size={30} className="text-emerald-500" />,
              isDark ? 'bg-emerald-500/15' : 'bg-emerald-50',
              t('listingModal.listedSuccessfully'),
              t('listingModal.job.doneText'),
              <>
                <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5">{t('listingModal.close')}</button>
                <button type="button" onClick={resetForAnother} className="btn-primary px-5 py-2.5">{t('listingModal.listAnother')}</button>
              </>,
              <div className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                <span className={`text-xs ${muted}`}>{t('listingModal.itemId')}</span>
                <span className={`font-mono text-sm font-bold ${strong}`}>{result.itemId}</span>
                {result.listingUrl && (
                  <a href={result.listingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:underline">
                    {t('listingModal.viewOnEbay')} <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {error && (
                  <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${isDark ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* Left: gallery */}
                  <div className="lg:col-span-5">
                    <div className="lg:sticky lg:top-0">
                      <div className={`overflow-hidden rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                        {displayUrls.length > 0 ? (
                          <div className="group relative aspect-square w-full bg-white">
                            <img
                              src={displayUrls[selectedImageIdx] || displayUrls[0]}
                              alt={`Picture ${selectedImageIdx + 1} of ${displayUrls.length}`}
                              className="h-full w-full object-contain"
                              onError={(e) => { e.target.src = displayUrls[0]; }}
                            />
                            <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white">
                              {selectedImageIdx + 1} / {displayUrls.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingImageIdx(selectedImageIdx)}
                              className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-md transition hover:bg-indigo-600 hover:text-white focus:opacity-100 group-hover:opacity-100"
                            >
                              <Pencil size={12} /> {t('listingModal.ui.replaceImage')}
                            </button>
                            {loadingSpecifics && (
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-slate-900/60 py-1.5 text-xs text-white">
                                <Loader2 size={12} className="animate-spin" /> {t('listingModal.ui.loadingImages')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAddImage}
                            className={`flex aspect-square w-full flex-col items-center justify-center gap-2 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:bg-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
                          >
                            <ImagePlus size={28} />
                            {loadingSpecifics ? t('listingModal.ui.loadingImages') : t('listingModal.ui.addImage')}
                          </button>
                        )}

                        {/* Thumbnails — click to select, ‹ › to reorder, + to add */}
                        <div className="flex items-center gap-1.5 overflow-x-auto p-2">
                          {displayUrls.map((url, idx) => (
                            <div key={idx} className="group/thumb relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedImageIdx(idx)}
                                className={`block h-14 w-14 overflow-hidden rounded-lg border-2 bg-white transition ${
                                  selectedImageIdx === idx ? 'border-indigo-500' : isDark ? 'border-slate-700 opacity-70 hover:opacity-100' : 'border-slate-200 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <img src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-contain" />
                              </button>
                              {displayUrls.length > 1 && (
                                <div className="absolute inset-x-0 -bottom-1 flex justify-center gap-0.5 opacity-0 transition group-hover/thumb:opacity-100">
                                  {[[-1, '‹', idx === 0], [1, '›', idx === displayUrls.length - 1]].map(([dir, glyph, disabled]) => (
                                    <button
                                      key={dir}
                                      type="button"
                                      onClick={() => moveImage(idx, dir)}
                                      disabled={disabled}
                                      className={`flex h-4 w-4 items-center justify-center rounded text-[10px] leading-none shadow disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'border border-slate-600 bg-slate-900 text-slate-200' : 'border border-slate-300 bg-white text-slate-700'}`}
                                    >
                                      {glyph}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {canAddMoreImages && (
                            <button
                              type="button"
                              onClick={handleAddImage}
                              title={t('listingModal.ui.addImage')}
                              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition ${isDark ? 'border-slate-700 text-slate-500 hover:border-indigo-500 hover:text-indigo-400' : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'}`}
                            >
                              <Plus size={18} />
                            </button>
                          )}
                        </div>
                        {displayUrls.length > 0 && (
                          <p className={`px-3 pb-2.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t('listingModal.ui.imagesCount', { count: displayUrls.length, max: MAX_LISTING_IMAGES })}
                          </p>
                        )}
                      </div>

                      {/* Summary card */}
                      {!isEditBucketItem && (
                        <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{t('listingModal.ui.summary')}</p>
                          <p className={`mt-1 text-2xl font-extrabold tabular-nums ${strong}`}>{form.price ? `$${Number(form.price).toFixed(2)}` : '—'}</p>
                          <div className={`mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold`}>
                            <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{t('listingModal.ui.qtyShort', { count: Math.max(1, Number(form.quantity) || 1) })}</span>
                            <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{CONDITION_OPTIONS.find((c) => String(c.id) === String(form.conditionId))?.label || 'New'}</span>
                            {form.freeShipping && <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{t('listingModal.ui.freeShipping')}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: form */}
                  <div className="space-y-4 lg:col-span-7">
                    <section className={sectionBox}>
                      <SectionTitle icon={FileText}>{t('listingModal.ui.detailsTitle')}</SectionTitle>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <label className={labelClass.replace('mb-1.5 ', '')}>{t('listingModal.ui.titleLabel')} <span className="text-rose-500">*</span></label>
                        <span className={`text-[11px] font-semibold tabular-nums ${titleLen >= 80 ? 'text-amber-500' : muted}`}>{titleLen}/80</span>
                      </div>
                      <input type="text" name="title" value={form.title} onChange={handleChange} className={inputClass} maxLength={80} placeholder={t('listingModal.ui.titlePlaceholder')} disabled={submitting} />

                      <div className="mt-4 mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <label className={labelClass.replace('mb-1.5 ', '')}>{t('listingModal.ui.descriptionLabel')}</label>
                        <label className="inline-flex cursor-pointer items-center gap-2" title={t('listingModal.sendRawDewisoHtmlHint')}>
                          <input type="checkbox" name="useRawDewisoHtml" checked={form.useRawDewisoHtml} onChange={handleChange} disabled={submitting} className="peer sr-only" />
                          <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${form.useRawDewisoHtml ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${form.useRawDewisoHtml ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </span>
                          <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('listingModal.sendRawDewisoHtml')}</span>
                        </label>
                      </div>
                      <div
                        ref={quillContainerRef}
                        className={`max-h-48 overflow-y-auto rounded-xl border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}
                        data-placeholder="Item description"
                      />
                      <p className={`mt-1.5 text-xs ${muted}`}>
                        {form.useRawDewisoHtml ? t('listingModal.rawHtmlWillBeSent') : t('listingModal.textWillBeConverted')}
                      </p>
                    </section>

                    <section className={sectionBox}>
                      <SectionTitle icon={CircleDollarSign}>{t('listingModal.ui.pricingTitle')}</SectionTitle>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{t('listingModal.ui.price')} <span className="text-rose-500">*</span></label>
                          <div className="relative">
                            <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>$</span>
                            <input type="number" name="price" value={form.price} onChange={handleChange} min="0.01" step="0.01" className={`${inputClass} pl-7 tabular-nums`} placeholder="0.00" disabled={submitting} />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>{t('listingModal.ui.quantity')}</label>
                          <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" step="1" className={`${inputClass} tabular-nums`} disabled={submitting} />
                        </div>
                        <div>
                          <label className={labelClass}>{t('listingModal.ui.categoryId')} <span className="text-rose-500">*</span></label>
                          <input type="text" name="categoryId" value={form.categoryId} onChange={handleChange} className={`${inputClass} font-mono`} placeholder="e.g. 9355" disabled={submitting} />
                        </div>
                        <div>
                          <label className={labelClass}>{t('listingModal.ui.condition')}</label>
                          <select name="conditionId" value={form.conditionId} onChange={handleChange} className={inputClass} disabled={submitting}>
                            {CONDITION_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className={sectionBox}>
                      <SectionTitle icon={Truck} extra={loadingPolicies ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : null}>
                        {t('listingModal.ui.shippingTitle')}
                      </SectionTitle>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{t('listingModal.ui.dispatchTime')}</label>
                          <input type="number" name="dispatchTimeMax" value={form.dispatchTimeMax} onChange={handleChange} min="1" step="1" className={`${inputClass} tabular-nums`} disabled={submitting} />
                        </div>
                        <label className={`flex cursor-pointer items-center justify-between gap-3 self-end rounded-xl border px-3 py-2.5 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>
                          <span className={`text-sm font-medium ${strong}`}>{t('listingModal.ui.freeShipping')}</span>
                          <input type="checkbox" name="freeShipping" checked={form.freeShipping} onChange={handleChange} disabled={submitting} className="peer sr-only" />
                          <span aria-hidden="true" className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${form.freeShipping ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${form.freeShipping ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </span>
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          ['fulfillmentPolicyId', t('listingModal.ui.shippingPolicy'), sellerPolicies.fulfillmentPolicies],
                          ['returnPolicyId', t('listingModal.ui.returnPolicy'), sellerPolicies.returnPolicies],
                          ['paymentPolicyId', t('listingModal.ui.paymentPolicy'), sellerPolicies.paymentPolicies],
                        ].map(([policyKey, label, pList]) => (
                          <div key={policyKey}>
                            <label className={labelClass}>{label}</label>
                            <select name={policyKey} value={form[policyKey]} onChange={handleChange} className={inputClass} disabled={submitting || loadingPolicies} title={policyName(pList, policyKey, form[policyKey]) || ''}>
                              <option value="">{pList.length === 0 ? t('listingModal.ui.accountDefault') : t('listingModal.ui.selectPolicy')}</option>
                              {pList.map((p) => <option key={p[policyKey]} value={p[policyKey]}>{p.name}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </section>

                    {(loadingSpecifics || itemSpecifics.length > 0) && (
                      <section className={sectionBox}>
                        <SectionTitle icon={ListChecks} extra={loadingSpecifics ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <span className={`text-xs ${muted}`}>{itemSpecifics.length}</span>}>
                          {t('listingModal.ui.specificsTitle')}
                        </SectionTitle>
                        {loadingSpecifics && itemSpecifics.length === 0 ? (
                          <p className={`text-xs ${muted}`}>{t('listingModal.ui.loadingSpecifics')}</p>
                        ) : (
                          <div className={`max-h-56 divide-y overflow-y-auto rounded-xl border text-xs ${isDark ? 'divide-slate-800 border-slate-800' : 'divide-slate-100 border-slate-200'}`}>
                            {itemSpecifics.map((spec, i) => {
                              const specLabel = spec.name || spec.label || '';
                              const specValue = spec.value || '';
                              const isOrigin = isItemOriginSpec(spec);
                              const originOptions = COUNTRY_OPTIONS.includes(specValue) ? COUNTRY_OPTIONS : [specValue, ...COUNTRY_OPTIONS].filter(Boolean);
                              return (
                                <div key={`${specLabel}-${i}`} className={`grid grid-cols-2 items-center gap-3 px-3 py-2 ${isDark ? 'bg-slate-950/40' : 'bg-white'}`}>
                                  <span className={`font-medium ${muted}`}>{specLabel}</span>
                                  {isOrigin ? (
                                    <select
                                      value={specValue || COUNTRY_OPTIONS[0]}
                                      onChange={(e) => handleItemSpecificChange(i, e.target.value)}
                                      disabled={submitting}
                                      className={`w-full rounded-lg border px-2 py-1 text-xs outline-none ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
                                    >
                                      {originOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  ) : (
                                    <span className={`truncate ${strong}`} title={specValue}>{specValue}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-white'}`}>
                {!isEditBucketItem ? (
                  <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
                    <Info size={13} className="shrink-0 text-amber-500" />
                    {t('listingModal.ui.liveWarning')}
                  </p>
                ) : <span />}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary px-4 py-2.5 disabled:opacity-60">{t('listingModal.cancel')}</button>
                  {!isEditBucketItem && (
                    <button type="button" onClick={handleOpenSchedule} disabled={submitting} className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-60">
                      <CalendarClock size={15} />
                      {t('scheduleListing.button')}
                    </button>
                  )}
                  <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-60">
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : isEditBucketItem ? <Check size={15} /> : <Rocket size={15} />}
                    {isEditBucketItem
                      ? (submitting ? t('listingModal.saving') : t('listingModal.save'))
                      : (submitting ? t('listingModal.listing') : t('listingModal.list'))}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Image Edit Sub-Modal */}
      {editingImageIdx !== null && (
        <ImageEditModal
          isDark={isDark}
          currentUrl={displayUrls[editingImageIdx] ?? null}
          imageIndex={editingImageIdx}
          mode={editingImageIdx >= displayUrls.length ? 'add' : 'edit'}
          onConfirm={handleImageEdited}
          onClose={() => setEditingImageIdx(null)}
        />
      )}

      {/* Schedule Listing Sub-Modal */}
      {showScheduleModal && (
        <ScheduleListingModal
          isDark={isDark}
          listingPayload={buildListingPayload()}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </>
  );
}
