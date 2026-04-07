import React, { useEffect, useMemo, useState } from 'react';
import { dewisoAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

const AWESOME_DEFAULT_HTML = `
<section class="dewiso-nav">
  <div class="dewiso-nav-row">
    <span class="dewiso-chip">STORE_LOGO</span>
    <span class="dewiso-chip dewiso-chip-solid">OEM & Aftermarket</span>
  </div>
</section>

<section class="dewiso-content">
  <div class="dewiso-hero-wrap">
    <div class="dewiso-hero-copy">
      <span class="dewiso-chip dewiso-chip-solid">VEHICLE READY</span>
      <h1 class="dewiso-title">[product_name]</h1>
      <p class="dewiso-subtitle">
        Precision-fit part engineered for performance, clean install, and long-term durability.
      </p>
      <div class="dewiso-meta">
        <div><strong>MPN:</strong> [metafield('Product','auto:mpn')]</div>
        <div><strong>ePID:</strong> [metafield('Product','auto:epid')]</div>
        <div><strong>Brand:</strong> [metafield('Product','auto:brand')]</div>
      </div>
    </div>
    <div class="dewiso-hero-media dewiso-card">
      <img src="https://via.placeholder.com/960x640.png?text=Product+Hero+Image" alt="Hero product image" />
    </div>
  </div>

  <div class="dewiso-gallery-note">[product_new_gallery]</div>

  <div class="dewiso-spec-grid">
    <div class="dewiso-card">
      <h3>Fitment</h3>
      <ul>
        <li>Make: [metafield('Product','auto:make')]</li>
        <li>Model: [metafield('Product','auto:model')]</li>
        <li>Year: [metafield('Product','auto:year_range')]</li>
        <li>Engine: [metafield('Product','auto:engine')]</li>
      </ul>
    </div>
    <div class="dewiso-card">
      <h3>Part Details</h3>
      <ul>
        <li>Part Type: [metafield('Product','auto:part_type')]</li>
        <li>Position: [metafield('Product','auto:position')]</li>
        <li>Finish: [metafield('Product','auto:finish')]</li>
        <li>Material: [metafield('Product','auto:material')]</li>
      </ul>
    </div>
    <div class="dewiso-card">
      <h3>In The Box</h3>
      <ul>
        <li>[metafield('Product','auto:bundle_1')]</li>
        <li>[metafield('Product','auto:bundle_2')]</li>
        <li>[metafield('Product','auto:bundle_3')]</li>
        <li>Install guide + protective packaging</li>
      </ul>
    </div>
  </div>

  <div class="dewiso-card">
    <h2>Product Description</h2>
    <p>
      Built to meet or exceed OEM specs. Every unit is inspected before dispatch for confidence and consistency.
      Ideal for quick repairs, restoration projects, and daily-use reliability.
    </p>
    <div class="dewiso-badges">
      <span>Quality Tested</span>
      <span>Fast Dispatch</span>
      <span>Trusted Support</span>
      <span>Secure Packaging</span>
    </div>
  </div>

  <div class="dewiso-cta">
    <strong>Ready to install.</strong> Order now to keep your vehicle running at peak performance.
  </div>
</section>
`;

function buildThemedPreviewHtml(rawHtml, { navBg, navText, contentBg, contentText }) {
  const themeStyle = `
<style>
  :root {
    --dewiso-nav-bg: ${navBg};
    --dewiso-nav-text: ${navText};
    --dewiso-content-bg: ${contentBg};
    --dewiso-content-text: ${contentText};
  }
  body.dewiso-body {
    margin: 0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: var(--dewiso-content-bg);
    color: var(--dewiso-content-text);
  }
  .dewiso-nav {
    background: linear-gradient(135deg, var(--dewiso-nav-bg), color-mix(in srgb, var(--dewiso-nav-bg) 78%, #000 22%));
    color: var(--dewiso-nav-text);
    padding: 22px 30px;
  }
  .dewiso-nav-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .dewiso-chip {
    border: 1px solid color-mix(in srgb, var(--dewiso-nav-text) 35%, transparent 65%);
    color: var(--dewiso-nav-text);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .7px;
    text-transform: uppercase;
  }
  .dewiso-chip-solid {
    background: color-mix(in srgb, var(--dewiso-nav-text) 92%, #ff8c00 8%);
    color: color-mix(in srgb, var(--dewiso-nav-bg) 75%, #111 25%);
    border-color: transparent;
  }
  .dewiso-title { margin: 14px 0 0; font-size: 46px; font-weight: 900; letter-spacing: .2px; }
  .dewiso-subtitle { margin: 10px 0 0; font-size: 18px; opacity: .95; }
  .dewiso-content { padding: 24px 30px; }
  .dewiso-hero-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; margin-bottom: 18px; }
  .dewiso-hero-copy { min-width: 0; }
  .dewiso-meta { margin-top: 14px; display: grid; gap: 6px; font-size: 15px; color: color-mix(in srgb, var(--dewiso-content-text) 72%, #ff8c00 28%); }
  .dewiso-card {
    background: color-mix(in srgb, var(--dewiso-content-bg) 88%, #fff 12%);
    border: 1px solid color-mix(in srgb, var(--dewiso-content-text) 16%, transparent 84%);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 8px 26px rgba(0,0,0,.08);
  }
  .dewiso-hero img {
    width: 100%;
    border-radius: 12px;
    display: block;
  }
  .dewiso-hero-media {
    border-color: color-mix(in srgb, #ff8c00 45%, transparent 55%);
    box-shadow: 0 10px 28px rgba(0,0,0,.16);
  }
  .dewiso-gallery-note {
    margin: 14px 0 18px;
    font-size: 14px;
    opacity: .85;
  }
  .dewiso-spec-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 16px;
  }
  .dewiso-card h3 {
    margin: 0 0 10px;
    font-size: 24px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: color-mix(in srgb, #ff8c00 78%, var(--dewiso-content-text) 22%);
  }
  .dewiso-card h2 { margin: 0 0 12px; font-size: 42px; font-weight: 900; color: var(--dewiso-content-text); }
  .dewiso-card p, .dewiso-card li { font-size: 28px; line-height: 1.55; }
  .dewiso-card ul { margin: 0 0 12px 22px; }
  .dewiso-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .dewiso-badges span {
    border: 1px solid color-mix(in srgb, var(--dewiso-nav-bg) 40%, transparent 60%);
    color: color-mix(in srgb, var(--dewiso-nav-bg) 70%, #111 30%);
    background: color-mix(in srgb, var(--dewiso-nav-bg) 12%, #fff 88%);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 22px;
    font-weight: 700;
  }
  .dewiso-cta {
    margin-top: 16px;
    border-radius: 14px;
    padding: 16px 18px;
    border: 1px solid color-mix(in srgb, var(--dewiso-nav-bg) 32%, transparent 68%);
    background: color-mix(in srgb, var(--dewiso-nav-bg) 10%, var(--dewiso-content-bg) 90%);
    font-size: 26px;
  }
  @media (max-width: 900px) {
    .dewiso-hero-wrap { grid-template-columns: 1fr; }
    .dewiso-spec-grid { grid-template-columns: 1fr; }
    .dewiso-title { font-size: 36px; }
    .dewiso-card h2 { font-size: 34px; }
    .dewiso-card p, .dewiso-card li, .dewiso-cta { font-size: 22px; }
  }
</style>`;

  const source = String(rawHtml || '').trim();
  if (!source) {
    return `<!doctype html><html><head>${themeStyle}</head><body class="dewiso-body">${AWESOME_DEFAULT_HTML}</body></html>`;
  }

  if (/<html[\s>]/i.test(source)) {
    let out = source;
    if (/<head[\s>]/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}${themeStyle}`);
    } else {
      out = out.replace(/<html[^>]*>/i, (m) => `${m}<head>${themeStyle}</head>`);
    }
    if (/<body[\s>]/i.test(out)) {
      out = out.replace(/<body([^>]*)>/i, '<body$1 class="dewiso-body">');
    }
    return out;
  }

  return `<!doctype html><html><head>${themeStyle}</head><body class="dewiso-body">${source}</body></html>`;
}

export default function DewisoPage() {
  const { isDark } = useTheme();
  const [layout, setLayout] = useState('own_html');
  const [navBg, setNavBg] = useState('#2A0948');
  const [navText, setNavText] = useState('#ffffff');
  const [contentBg, setContentBg] = useState('#F5F5F5');
  const [contentText, setContentText] = useState('#000000');
  const [templateName, setTemplateName] = useState('My Dewiso Template');
  const [ownHtml, setOwnHtml] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingHistory(true);
        const res = await dewisoAPI.getHistory(30);
        setHistory(res?.data?.items || []);
      } catch (error) {
        setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to load Dewiso history' });
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, []);

  const generatedHtml = useMemo(() => {
    if (layout === 'own_html') {
      return buildThemedPreviewHtml(ownHtml || AWESOME_DEFAULT_HTML, {
        navBg,
        navText,
        contentBg,
        contentText,
      });
    }

    // For non-own layouts, use same beautiful template but keep mode metadata for future variants.
    return buildThemedPreviewHtml(AWESOME_DEFAULT_HTML, {
      navBg,
      navText,
      contentBg,
      contentText,
    });
  }, [layout, ownHtml, navBg, navText, contentBg, contentText]);

  const handleUploadHtmlFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setAlert({ type: 'error', message: 'Please upload an .html file' });
      return;
    }
    const text = await file.text();
    setOwnHtml(text);
    setLayout('own_html');
    setAlert({ type: 'success', message: `Loaded ${file.name}` });
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      const payload = {
        id: selectedHistoryId || undefined,
        name: templateName || 'Untitled Dewiso Template',
        mode: layout,
        html: generatedHtml,
        meta: { navBg, navText, contentBg, contentText },
      };
      const res = await dewisoAPI.saveHistory(payload);
      const nextId = res?.data?.id || selectedHistoryId;
      const list = await dewisoAPI.getHistory(30);
      setHistory(list?.data?.items || []);
      setSelectedHistoryId(nextId || null);
      setAlert({ type: 'success', message: 'Dewiso template saved to history' });
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const loadFromHistory = (item) => {
    setSelectedHistoryId(item.id);
    setTemplateName(item.name || 'Untitled Dewiso Template');
    setLayout(item.mode || 'own_html');
    setOwnHtml(item.html || '');
    if (item.meta) {
      setNavBg(item.meta.navBg || '#2A0948');
      setNavText(item.meta.navText || '#ffffff');
      setContentBg(item.meta.contentBg || '#F5F5F5');
      setContentText(item.meta.contentText || '#000000');
    }
  };

  return (
    <div className="page-shell">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`page-title ${isDark ? 'text-slate-100' : ''}`}>Dewiso</h1>
        <button className="btn-primary" onClick={saveTemplate} disabled={saving}>
          {saving ? 'Saving...' : 'Save to History'}
        </button>
      </div>

      {alert ? <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
        <div className={`xl:col-span-5 rounded-2xl border p-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Select a layout</p>
          <div className="flex gap-2 mb-4">
            <button className={`btn-secondary ${layout === 'one_col' ? 'ring-2 ring-indigo-500' : ''}`} onClick={() => setLayout('one_col')}>1-Column</button>
            <button className={`btn-secondary ${layout === 'two_col' ? 'ring-2 ring-indigo-500' : ''}`} onClick={() => setLayout('two_col')}>2-Columns</button>
            <button className={`btn-secondary ${layout === 'own_html' ? 'ring-2 ring-indigo-500' : ''}`} onClick={() => setLayout('own_html')}>Own HTML</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Nav Background<input type="color" value={navBg} onChange={(e) => setNavBg(e.target.value)} className="w-full h-10" /></label>
            <label className="text-sm">Nav Text<input type="color" value={navText} onChange={(e) => setNavText(e.target.value)} className="w-full h-10" /></label>
            <label className="text-sm">Content Background<input type="color" value={contentBg} onChange={(e) => setContentBg(e.target.value)} className="w-full h-10" /></label>
            <label className="text-sm">Content Text<input type="color" value={contentText} onChange={(e) => setContentText(e.target.value)} className="w-full h-10" /></label>
          </div>

          <div className="mt-4 space-y-2">
            <input className="input-base" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
            <div className="flex gap-2">
              <label className="btn-secondary cursor-pointer">
                Upload HTML file
                <input type="file" accept=".html,.htm,text/html" className="hidden" onChange={handleUploadHtmlFile} />
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setLayout('own_html');
                  setOwnHtml(AWESOME_DEFAULT_HTML);
                  setAlert({ type: 'success', message: 'Awesome default HTML inserted' });
                }}
              >
                Use Awesome Default HTML
              </button>
            </div>
            <textarea
              className="input-base min-h-[220px]"
              value={ownHtml}
              onChange={(e) => setOwnHtml(e.target.value)}
              placeholder="Paste your own HTML here..."
            />
          </div>

          <div className="mt-4">
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>History</p>
            <div className="max-h-56 overflow-auto space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-slate-500">Loading history...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">No saved templates yet.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadFromHistory(item)}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${
                      selectedHistoryId === item.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs opacity-70">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`xl:col-span-7 rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`px-4 py-2 border-b text-sm ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
            Live Preview
          </div>
          <iframe title="Dewiso Preview" srcDoc={generatedHtml} className="w-full h-[760px] bg-white" />
        </div>
      </div>
    </div>
  );
}

