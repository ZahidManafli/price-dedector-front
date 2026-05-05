import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dewisoAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────────────────────
   DEFAULT HTML TEMPLATE
───────────────────────────────────────────────────────────────────────────── */
// NOTE: No inline style="background:..." on title/copyright — colors come from CSS vars injected by buildFullHtml
const ONE_COL_BODY = `
<div id="title-part" class="py-3">
<div class="container"><div class="row"><div class="col-12">
<h1 class="primary-text-color">Insert item title here (click on text)</h1>
</div></div></div></div>
<div id="description-container" class="secondary-color-bg pb-3 pt-4">
<div class="container"><div class="row">
<div id="image-gallery" class="col-12 mb-4">
<img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" title="Product Image" />
</div>
<div id="description-part" class="col-12 secondary-color-text">
<p>Carefully describe your item. Focus on benefits, not features! Hold your readers attention by limiting all paragraphs to three sentences or less. Your description doesn't need a thousand words.</p>
<br/>
<p><strong>Features and further details</strong></p>
<ul>
<li><strong>Additional Features:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Details:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Package Includes:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
</ul>
</div></div></div></div>
<div id="copyright-part" class="py-3">
<div class="container primary-text-color" style="font-size:90%;">
<div>Free ebay template editor by <b>checkila.com</b></div>
</div></div>`;

const TWO_COL_BODY = `
<div id="title-part" class="py-3">
<div class="container"><div class="row"><div class="col-12">
<h1 class="primary-text-color">Insert item title here (click on text)</h1>
</div></div></div></div>
<div id="description-container" class="secondary-color-bg pb-3 pt-4">
<div class="container"><div class="row">
<div id="image-gallery" class="col-12 col-md-6 mb-4">
<img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" title="Product Image" />
</div>
<div id="description-part" class="col-12 col-md-6 secondary-color-text">
<p>Carefully describe your item. Focus on benefits, not features! Hold your readers attention by limiting all paragraphs to three sentences or less.</p>
<br/>
<p><strong>Features and further details</strong></p>
<ul>
<li><strong>Additional Features:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Details:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Package Includes:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
</ul>
</div></div></div></div>
<div id="copyright-part" class="py-3">
<div class="container primary-text-color" style="font-size:90%;">
<div>Free ebay template editor by <b>checkila.com</b></div>
</div></div>`;

const AWESOME_DEFAULT_HTML = ONE_COL_BODY; // kept for backward compat

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function extractEditableHtml(html) {
  const source = String(html || '').trim();
  if (!source) return '';
  if (/<html[\s>]/i.test(source)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    return doc.body?.innerHTML?.trim() || '';
  }
  return source;
}

function buildFullHtml(bodyHtml, { navBg, navText, contentBg, contentText }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css">
<style>
  :root {
    --nav-bg: ${navBg};
    --nav-text: ${navText};
    --content-bg: ${contentBg};
    --content-text: ${contentText};
  }
  body { margin: 0 !important; padding: 0 !important; font-size: 18px; background: var(--content-bg); color: var(--content-text); }
  img { max-width: 100%; }
  /* Use !important to override any inline style="background:..." left in user-edited HTML */
  #title-part    { background: var(--nav-bg) !important; color: var(--nav-text) !important; }
  #copyright-part{ background: var(--nav-bg) !important; color: var(--nav-text) !important; }
  .primary-text-color   { color: var(--nav-text) !important; }
  .secondary-color-text { color: var(--content-text) !important; }
  .secondary-color-bg   { background-color: var(--content-bg) !important; }
  .container { max-width: 800px !important; margin-left: auto !important; margin-right: auto !important; }
</style>
</head><body>${bodyHtml}</body></html>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FLOATING TOOLBAR COMPONENT
   This is the key fix — toolbar stays above the preview iframe/div and uses
   document.execCommand on the iframe's document so focus never leaves.
───────────────────────────────────────────────────────────────────────────── */
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
const FONT_FAMILIES = [
  'system-ui, -apple-system, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Arial, sans-serif',
  'Trebuchet MS, sans-serif',
  'Impact, sans-serif',
];

function FloatingToolbar({ iframeRef }) {
  const { t } = useTranslation('common');
  const [activeFormats, setActiveFormats] = useState({});
  const [fontSize, setFontSize] = useState('18px');
  const [fontFamily, setFontFamily] = useState('system-ui, -apple-system, sans-serif');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef(null);

  // Get the iframe's document
  const getIframeDoc = useCallback(() => {
    return iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
  }, [iframeRef]);

  // Save selection before toolbar interaction
  const saveSelection = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, [getIframeDoc]);

  // Restore selection after toolbar interaction
  const restoreSelection = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc || !savedSelectionRef.current) return;
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionRef.current);
  }, [getIframeDoc]);

  // Execute formatting command in iframe
  const execCmd = useCallback((cmd, value = null) => {
    const doc = getIframeDoc();
    if (!doc) return;
    restoreSelection();
    doc.execCommand(cmd, false, value);
    // Keep focus in iframe
    iframeRef.current?.contentWindow?.focus();
    updateActiveFormats();
  }, [getIframeDoc, restoreSelection, iframeRef]);

  const updateActiveFormats = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    setActiveFormats({
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
      strikeThrough: doc.queryCommandState('strikeThrough'),
      justifyLeft: doc.queryCommandState('justifyLeft'),
      justifyCenter: doc.queryCommandState('justifyCenter'),
      justifyRight: doc.queryCommandState('justifyRight'),
      insertOrderedList: doc.queryCommandState('insertOrderedList'),
      insertUnorderedList: doc.queryCommandState('insertUnorderedList'),
    });
  }, [getIframeDoc]);

  // Listen for selection changes inside iframe
  useEffect(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    const handler = () => { saveSelection(); updateActiveFormats(); };
    doc.addEventListener('selectionchange', handler);
    return () => doc.removeEventListener('selectionchange', handler);
  }, [getIframeDoc, saveSelection, updateActiveFormats]);

  const handleFontSize = (e) => {
    const size = e.target.value;
    setFontSize(size);
    // execCommand fontSize only supports 1-7, so we wrap with a span
    restoreSelection();
    const doc = getIframeDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = doc.createElement('span');
    span.style.fontSize = size;
    range.surroundContents(span);
    iframeRef.current?.contentWindow?.focus();
  };

  const handleFontFamily = (e) => {
    const family = e.target.value;
    setFontFamily(family);
    execCmd('fontName', family);
  };

  const handleLink = () => {
    saveSelection();
    setShowLinkInput(true);
    setLinkUrl('');
  };

  const applyLink = () => {
    if (linkUrl.trim()) {
      execCmd('createLink', linkUrl.trim());
    }
    setShowLinkInput(false);
  };

  const handleImage = () => {
    const url = window.prompt(t('dewisoPage.enterImageUrl'));
    if (url?.trim()) {
      execCmd('insertImage', url.trim());
    }
  };

  const handleUndo = () => {
    const doc = getIframeDoc();
    if (!doc) return;
    doc.execCommand('undo', false, null);
    iframeRef.current?.contentWindow?.focus();
  };

  const handleRedo = () => {
    const doc = getIframeDoc();
    if (!doc) return;
    doc.execCommand('redo', false, null);
    iframeRef.current?.contentWindow?.focus();
  };

  const btn = (active) =>
    `px-2 py-1 rounded text-sm font-medium border transition-all select-none cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
    }`;

  return (
    <div
      className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50 border-slate-200"
      // CRITICAL: prevent mousedown from stealing focus from the iframe
      onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
    >
      {/* Undo / Redo */}
      <button className={btn(false)} onClick={handleUndo} title={t('dewisoPage.undo')}>↩</button>
      <button className={btn(false)} onClick={handleRedo} title={t('dewisoPage.redo')}>↪</button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Font family */}
      <select
        className="text-xs border border-slate-200 rounded px-1 py-1 bg-white text-slate-700 cursor-pointer"
        value={fontFamily}
        onChange={handleFontFamily}
        onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
        title={t('dewisoPage.fontFamily')}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f} style={{ fontFamily: f }}>
            {f.split(',')[0]}
          </option>
        ))}
      </select>

      {/* Font size */}
      <select
        className="text-xs border border-slate-200 rounded px-1 py-1 bg-white text-slate-700 cursor-pointer w-20"
        value={fontSize}
        onChange={handleFontSize}
        onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
        title={t('dewisoPage.fontSize')}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Bold / Italic / Underline / Strike */}
      <button className={btn(activeFormats.bold)} onClick={() => execCmd('bold')} title={t('dewisoPage.bold')}><b>B</b></button>
      <button className={btn(activeFormats.italic)} onClick={() => execCmd('italic')} title={t('dewisoPage.italic')}><i>I</i></button>
      <button className={btn(activeFormats.underline)} onClick={() => execCmd('underline')} title={t('dewisoPage.underline')}><u>U</u></button>
      <button className={btn(activeFormats.strikeThrough)} onClick={() => execCmd('strikeThrough')} title={t('dewisoPage.strikethrough')}><s>S</s></button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Alignment */}
      <button className={btn(activeFormats.justifyLeft)} onClick={() => execCmd('justifyLeft')} title={t('dewisoPage.alignLeft')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.justifyCenter)} onClick={() => execCmd('justifyCenter')} title={t('dewisoPage.alignCenter')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm3 4h12v2H6V9zm-3 4h18v2H3v-2zm3 4h12v2H6v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.justifyRight)} onClick={() => execCmd('justifyRight')} title={t('dewisoPage.alignRight')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm6 4h12v2H9V9zm-6 4h18v2H3v-2zm6 4h12v2H9v-2z"/></svg>
      </button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Lists */}
      <button className={btn(activeFormats.insertUnorderedList)} onClick={() => execCmd('insertUnorderedList')} title={t('dewisoPage.bulletList')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7V5zm-3 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7v-2zm-3 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.insertOrderedList)} onClick={() => execCmd('insertOrderedList')} title={t('dewisoPage.numberedList')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4h1v3H3V4zm4 1h14v2H7V5zM3 9h2v1H4v1h1v1H3V9zm4 2h14v2H7v-2zm-4 4h2v1H4l2 3H3l-1-1.5L4 15H3v-1zm4 1h14v2H7v-2z"/></svg>
      </button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Link */}
      <button className={btn(false)} onClick={handleLink} title={t('dewisoPage.insertLink')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
      </button>

      {/* Image */}
      <button className={btn(false)} onClick={handleImage} title={t('dewisoPage.insertImage')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
      </button>

      {/* Remove formatting */}
      <button className={btn(false)} onClick={() => execCmd('removeFormat')} title={t('dewisoPage.removeFormatting')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6zm-2.81-1L1.27 1.27 0 2.54 4.73 7.27 3.55 10h2.41l1.27 3h2.41l-1-2.41L13.45 15l-1.24 3H15l.72-1.71L18.46 20l1.27-1.27L3.19 4z"/></svg>
      </button>

      {/* Inline link input */}
      {showLinkInput && (
        <div className="flex items-center gap-1 ml-1">
          <input
            autoFocus
            className="text-xs border border-slate-300 rounded px-2 py-1 w-48"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
          />
          <button className="text-xs px-2 py-1 bg-indigo-600 text-white rounded" onClick={applyLink}>{t('dewisoPage.ok')}</button>
          <button className="text-xs px-2 py-1 bg-slate-200 rounded" onClick={() => setShowLinkInput(false)}>{t('dewisoPage.close')}</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function DewisoPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation('common');

  // Layout & colours
  const [layout, setLayout] = useState('one_col');
  const [navBg, setNavBg] = useState('#2A0948');
  const [navText, setNavText] = useState('#ffffff');
  const [contentBg, setContentBg] = useState('#F5F5F5');
  const [contentText, setContentText] = useState('#000000');

  // Template meta
  const [templateName, setTemplateName] = useState('My Dewiso Template');
  const [bodyHtml, setBodyHtml] = useState(() => ONE_COL_BODY);

  // History
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);

  // Images
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  // Alert
  const [alert, setAlert] = useState(null);

  // Iframe ref (the live editable preview lives inside an iframe so it has
  // its own document — this is the key to keeping focus stable)
  const iframeRef = useRef(null);

  // Tracks whether iframe content is initialised
  const iframeReadyRef = useRef(false);

  // Suppress re-inject while user is actively editing
  const isEditingRef = useRef(false);

  /* ── Load history ── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingHistory(true);
        const res = await dewisoAPI.getHistory(30);
        setHistory(res?.data?.items || []);
      } catch (err) {
        setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.failedToLoadHistory') });
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, []);

  /* ── Full HTML for download/copy ── */
  const fullHtml = useMemo(
    () => buildFullHtml(bodyHtml, { navBg, navText, contentBg, contentText }),
    [bodyHtml, navBg, navText, contentBg, contentText]
  );

  /* ── Write content into iframe ──
     We write the full themed page into the iframe but also set it
     contenteditable so the user can edit directly inside. */
  const writeIframe = useCallback((html) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Make body editable
    doc.body.contentEditable = 'true';
    doc.body.style.outline = 'none';
    doc.designMode = 'on'; // enables execCommand on the whole doc
    iframeReadyRef.current = true;

    // Listen for changes inside iframe
    const onInput = () => {
      isEditingRef.current = true;
      setBodyHtml(doc.body.innerHTML);
    };
    const onBlur = () => { isEditingRef.current = false; };
    const onFocus = () => { isEditingRef.current = true; };

    doc.body.addEventListener('input', onInput);
    doc.body.addEventListener('blur', onBlur, true);
    doc.body.addEventListener('focus', onFocus, true);

    // Image click → replace src
    doc.body.addEventListener('click', (e) => {
      const img = e.target?.closest?.('img');
      if (!img) return;
      const choice = window.confirm(t('dewisoPage.chooseImageAction'));
      if (!choice) return;
      const url = window.prompt(t('dewisoPage.imageUrl'));
      if (url?.trim()) {
        img.src = url.trim();
        setBodyHtml(doc.body.innerHTML);
      }
    });
  }, []);

  /* ── Initial iframe load ── */
  useEffect(() => {
    // Small delay to ensure iframe is mounted
    const t = setTimeout(() => {
      writeIframe(fullHtml);
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Live-update CSS vars in iframe when colors change ──
     Instead of full writeIframe (which destroys edits), we just patch
     the :root CSS variables directly in the iframe's document. ── */
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // Find or create our theme <style> tag
    let styleEl = doc.getElementById('__dewiso_theme__');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = '__dewiso_theme__';
      doc.head?.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --nav-bg: ${navBg} !important;
        --nav-text: ${navText} !important;
        --content-bg: ${contentBg} !important;
        --content-text: ${contentText} !important;
      }
      #title-part     { background: ${navBg} !important; color: ${navText} !important; }
      #copyright-part { background: ${navBg} !important; color: ${navText} !important; }
      .primary-text-color   { color: ${navText} !important; }
      .secondary-color-text { color: ${contentText} !important; }
      .secondary-color-bg   { background-color: ${contentBg} !important; }
      body { background: ${contentBg} !important; color: ${contentText} !important; }
    `;
  }, [navBg, navText, contentBg, contentText]);

  /* ── Handlers ── */
  const handleUploadHtmlFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const extracted = extractEditableHtml(text);
    setBodyHtml(extracted);
    writeIframe(buildFullHtml(extracted, { navBg, navText, contentBg, contentText }));
    setAlert({ type: 'success', message: t('dewisoPage.loadedFile', { fileName: file.name }) });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      setUploadingImages(true);
      const formData = new FormData();
      files.forEach((f) => formData.append('images', f));
      if (selectedHistoryId) formData.append('templateId', selectedHistoryId);
      const res = await dewisoAPI.uploadImages(formData);
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setUploadedImages((prev) => {
        const merged = [...prev, ...items];
        const seen = new Set();
        return merged.filter((img) => {
          const key = `${img?.localUrl}|${img?.ebayUrl}|${img?.fileName}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setAlert({ type: 'success', message: t('dewisoPage.uploadedImagesCount', { count: items.length }) });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.uploadFailed') });
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      const payload = {
        id: selectedHistoryId || undefined,
        name: templateName || 'Untitled',
        mode: layout,
        html: fullHtml,
        meta: { navBg, navText, contentBg, contentText, images: uploadedImages },
      };
      const res = await dewisoAPI.saveHistory(payload);
      const nextId = res?.data?.id || selectedHistoryId;
      const list = await dewisoAPI.getHistory(30);
      setHistory(list?.data?.items || []);
      setSelectedHistoryId(nextId || null);
      setAlert({ type: 'success', message: t('dewisoPage.templateSaved') });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const loadFromHistory = (item) => {
    setSelectedHistoryId(item.id);
    setTemplateName(item.name || 'Untitled');
    setLayout(item.mode || 'one_col');
    const extracted = extractEditableHtml(item.html || '');
    setBodyHtml(extracted);
    if (item.meta) {
      setNavBg(item.meta.navBg || '#2A0948');
      setNavText(item.meta.navText || '#ffffff');
      setContentBg(item.meta.contentBg || '#F5F5F5');
      setContentText(item.meta.contentText || '#000000');
      setUploadedImages(Array.isArray(item.meta.images) ? item.meta.images : []);
    }
    writeIframe(buildFullHtml(extracted, {
      navBg: item.meta?.navBg || navBg,
      navText: item.meta?.navText || navText,
      contentBg: item.meta?.contentBg || contentBg,
      contentText: item.meta?.contentText || contentText,
    }));
  };

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || '').trim());
      setAlert({ type: 'success', message: t('dewisoPage.copied') });
    } catch {
      setAlert({ type: 'warning', message: t('dewisoPage.copyFailed') });
    }
  };

  const downloadHtml = () => {
    const filename = `${templateName || 'dewiso'}.html`;
    const link = document.createElement('a');
    link.href = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`;
    link.download = filename;
    link.click();
  };

  /* ── UI ── */
  return (
    <div className="page-shell">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`page-title ${isDark ? 'text-slate-100' : ''}`}>{t('dewisoPage.title')}</h1>
        <button className="btn-primary" onClick={saveTemplate} disabled={saving}>
          {saving ? t('dewisoPage.saving') : t('dewisoPage.saveToHistory')}
        </button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
        {/* ── LEFT PANEL ── */}
        <div className={`xl:col-span-4 rounded-2xl border p-4 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>

          {/* Layout selector */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.selectLayout')}</p>
            <div className="flex gap-2 flex-wrap">
              {['one_col', 'two_col', 'own_html'].map((l) => (
                <button
                  key={l}
                  className={`btn-secondary text-xs ${layout === l ? 'ring-2 ring-indigo-500' : ''}`}
                  onClick={() => {
                    setLayout(l);
                    // Load the correct default body when switching layouts
                    if (l === 'one_col') {
                      setBodyHtml(ONE_COL_BODY);
                      writeIframe(buildFullHtml(ONE_COL_BODY, { navBg, navText, contentBg, contentText }));
                      setAlert({ type: 'success', message: t('dewisoPage.oneColumnTemplateLoaded') });
                    } else if (l === 'two_col') {
                      setBodyHtml(TWO_COL_BODY);
                      writeIframe(buildFullHtml(TWO_COL_BODY, { navBg, navText, contentBg, contentText }));
                      setAlert({ type: 'success', message: t('dewisoPage.twoColumnsTemplateLoaded') });
                    }
                    // 'own_html' keeps whatever is currently in the editor
                  }}
                >
                  {l === 'one_col' ? t('dewisoPage.layoutOneColumn') : l === 'two_col' ? t('dewisoPage.layoutTwoColumns') : t('dewisoPage.layoutOwnHtml')}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('dewisoPage.color')} <strong>{t('dewisoPage.navFooter')}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                {t('dewisoPage.background')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={navBg} onChange={(e) => setNavBg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={navBg} onChange={(e) => setNavBg(e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-slate-500">
                {t('dewisoPage.text')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={navText} onChange={(e) => setNavText(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={navText} onChange={(e) => setNavText(e.target.value)} />
                </div>
              </label>
            </div>
          </div>

          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('dewisoPage.color')} <strong>{t('dewisoPage.contentArea')}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                {t('dewisoPage.background')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={contentBg} onChange={(e) => setContentBg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={contentBg} onChange={(e) => setContentBg(e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-slate-500">
                {t('dewisoPage.text')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={contentText} onChange={(e) => setContentText(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={contentText} onChange={(e) => setContentText(e.target.value)} />
                </div>
              </label>
            </div>
          </div>

          {/* Template name + file upload */}
          <div className="space-y-2">
            <input
              className="input-base w-full"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('dewisoPage.templateNamePlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer text-xs">
                {t('dewisoPage.uploadHtml')}
                <input type="file" accept=".html,.htm" className="hidden" onChange={handleUploadHtmlFile} />
              </label>
              <label className={`btn-secondary cursor-pointer text-xs ${uploadingImages ? 'opacity-60' : ''}`}>
                {uploadingImages ? t('dewisoPage.uploading') : t('dewisoPage.uploadImages')}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
              </label>
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  const body = layout === 'two_col' ? TWO_COL_BODY : ONE_COL_BODY;
                  setBodyHtml(body);
                  writeIframe(buildFullHtml(body, { navBg, navText, contentBg, contentText }));
                  setAlert({ type: 'success', message: t('dewisoPage.defaultTemplateLoaded') });
                }}
              >
                {t('dewisoPage.resetToDefault')}
              </button>
            </div>
          </div>

          {/* Uploaded images */}
          {uploadedImages.length > 0 && (
            <div>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.uploadedImages')}</p>
              <div className="space-y-2 max-h-48 overflow-auto">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className={`rounded-lg border p-2 flex gap-2 items-start ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                    <img src={img?.localUrl || ''} alt="" className="h-10 w-10 rounded object-cover border border-slate-200" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{img?.fileName || t('dewisoPage.imageLabel', { index: idx + 1 })}</p>
                      {img?.ebayUrl && (
                        <button className="text-[11px] text-indigo-500 hover:underline" onClick={() => copyText(img.ebayUrl)}>
                          {t('dewisoPage.copyEbayLink')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.history')}</p>
            <div className="max-h-52 overflow-auto space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-slate-500">{t('dewisoPage.loading')}</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">{t('dewisoPage.noSavedTemplatesYet')}</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadFromHistory(item)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                      selectedHistoryId === item.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs opacity-70">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Preview with embedded toolbar ── */}
        <div className={`xl:col-span-8 rounded-2xl border overflow-hidden flex flex-col ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          {/* Preview header */}
          <div className={`px-4 py-2 border-b text-sm flex justify-between items-center ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
            <span className="font-medium">{t('dewisoPage.livePreviewHint')}</span>
            <div className="flex gap-2">
              <button className="text-xs btn-secondary px-2 py-1" onClick={() => copyText(fullHtml)}>{t('dewisoPage.copyHtml')}</button>
              <button className="text-xs btn-secondary px-2 py-1" onClick={downloadHtml}>{t('dewisoPage.downloadHtml')}</button>
            </div>
          </div>

          {/* ★ Floating toolbar that edits the iframe — no focus loss ★ */}
          <FloatingToolbar iframeRef={iframeRef} />

          {/* Iframe — the preview lives here, fully editable */}
          <iframe
            ref={iframeRef}
            title="Dewiso Preview"
            className="flex-1 w-full border-0"
            style={{ minHeight: '600px' }}
            sandbox="allow-same-origin allow-scripts"
            onLoad={() => {
              // Re-enable designMode on any navigation inside iframe
              const doc = iframeRef.current?.contentDocument;
              if (doc && doc.body) {
                doc.body.contentEditable = 'true';
                doc.designMode = 'on';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
