import React, { useEffect, useMemo, useState, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { dewisoAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

const AWESOME_DEFAULT_HTML = `<html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>1-Column Ebay Template dewiso.com</title>
    <!-- Bootstrap CSS for proper display when downloaded -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css">
    <style>
        /* Override Bootstrap defaults to ensure no gaps */
        body { margin: 0 !important; padding: 0 !important; font-size: 18px; }
        * { margin: 0; padding: 0; }
        img { max-width: 100%; }
        
        /* Primary color styles */
        .primary-text-color { color: #ffffff; }
        /* Secondary color styles */
        .secondary-color-text { color: #000000; }
        .secondary-color-bg { background-color: #F5F5F5; }
        
        /* Ensure container has proper max-width */
        .container { max-width: 800px !important; }
        
        /* Gallery Styles */
        .content__gallery {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        
        .thumb__float {
            display: block;
            cursor: pointer;
            width: 100px;
            height: 100px;
            border: none;
            box-shadow: none;
            transition: opacity 0.3s;
        }
        
        .thumb__float:hover {
            opacity: 0.8;
        }
        
        .thumb__wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .thumb__wrapper img {
            max-width: 100%;
            max-height: 100%;
            object-fit: cover;
        }
        
        .slider__wrapper {
            width: 100%;
            height: auto;
            aspect-ratio: 16/9;
            max-height: 400px;
            overflow: hidden;
            position: relative;
            border: none;
            outline: none;
        }
        
        .slider {
            display: flex;
            width: 300%;
            height: 100%;
            transition: transform 0.3s ease-in-out;
            transform: translateX(0);
        }
        
        .slider > div {
            width: 33.333%;
            height: 100%;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            background-color: inherit;
            border: none;
            outline: none;
        }
        
        .thumb1:focus ~ .slider__wrapper .slider { transform: translateX(0%); }
        .thumb2:focus ~ .slider__wrapper .slider { transform: translateX(-33.333%); }
        .thumb3:focus ~ .slider__wrapper .slider { transform: translateX(-66.666%); }
        .thumb1:hover ~ .slider__wrapper .slider { transform: translateX(0%); }
        .thumb2:hover ~ .slider__wrapper .slider { transform: translateX(-33.333%); }
        .thumb3:hover ~ .slider__wrapper .slider { transform: translateX(-66.666%); }
        .thumb__float:focus { outline: none; opacity: 0.7; }
        @media (max-width: 768px) {
            .slider__wrapper { max-height: 300px; }
            .thumb__float { width: 75px; height: 75px; }
            .thumb__container { gap: 5px; }
        }
    </style>
</head>
<body id="border-color" style="border: 1px solid #2A0948; margin: 0; padding: 0;">
<!-- TITLE --->
<div id="title-part" class="py-3" style="background: #2A0948;">
<div class="container" style="max-width: 800px;">
<div class="row">
<div class="col-12">
<h1 class="primary-text-color">Insert item title here (click on text)</h1>
</div>
</div>
</div>
</div>
<!-- DESCRIPTION/GALLERY CONTAINER -->
<div id="description-container" class="secondary-color-bg pb-3 pt-4">
<div class="container" style="max-width: 800px;">
<div class="row"><!-- GALLERY -->
<div id="image-gallery" class="col-12 mb-4"><!-- Free User - Single Image (consistent with 2-column template) --> <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" title="Product Image" /></div>
<!-- DESCRIPTION -->
<div id="description-part" class="col-12 secondary-color-text">
<div class="secondary-color-text">
<p>Carefully describe your item. Focus on benefits, not features! Hold your readers attention by limiting all paragraphs to three sentences or less. Your description doesn't need a thousand words. Get to the point and provide the most important info. Be enthusiastic when you list all the reasons everyone should buy your item. You want to make the customer feel comfortable shopping with you.</p>
<br />
<p><strong>Features and further details</strong></p>
<p>After the benefits you can follow up with an overview of the features and (technical) details. A great source for a the required product information are other websites like Amazon. Aim to add value to your description!</p>
<ul>
<li><strong>Additional Features:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat. labore et dolore magna aliquyam erat.</li>
<li><strong>Details:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat. labore et dolore magna aliquyam erat.</li>
<li><strong>Package Includes:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat. labore et dolore magna aliquyam erat.</li>
</ul>
</div>
</div>
</div>
</div>
</div>
<!-- ICONS -->
<div id="info-part" class="secondary-color-bg pt-3">
<div class="container" style="max-width: 800px;">
<div class="row">
<div class="col-12 col-md-6 pb-2">
<div class="row pb-1 secondary-color-text">
<div class="col-3 my-auto"><svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 512 512" style="height: auto; max-height: 60px; fill: currentColor;" title="Shipping"> <path d="M476.158,231.363l-13.259-53.035c3.625-0.77,6.345-3.986,6.345-7.839v-8.551c0-18.566-15.105-33.67-33.67-33.67h-60.392 V110.63c0-9.136-7.432-16.568-16.568-16.568H50.772c-9.136,0-16.568,7.432-16.568,16.568V256c0,4.427,3.589,8.017,8.017,8.017 c4.427,0,8.017-3.589,8.017-8.017V110.63c0-0.295,0.239-0.534,0.534-0.534h307.841c0.295,0,0.534,0.239,0.534,0.534v145.372 c0,4.427,3.589,8.017,8.017,8.017c4.427,0,8.017-3.589,8.017-8.017v-9.088h94.569c0.008,0,0.014,0.002,0.021,0.002 c0.008,0,0.015-0.001,0.022-0.001c11.637,0.008,21.518,7.646,24.912,18.171h-24.928c-4.427,0-8.017,3.589-8.017,8.017v17.102 c0,13.851,11.268,25.119,25.119,25.119h9.086v35.273h-20.962c-6.886-19.883-25.787-34.205-47.982-34.205 s-41.097,14.322-47.982,34.205h-3.86v-60.393c0-4.427-3.589-8.017-8.017-8.017c-4.427,0-8.017,3.589-8.017,8.017v60.391H192.817 c-6.886-19.883-25.787-34.205-47.982-34.205s-41.097,14.322-47.982,34.205H50.772c-0.295,0-0.534-0.239-0.534-0.534v-17.637 h34.739c4.427,0,8.017-3.589,8.017-8.017s-3.589-8.017-8.017-8.017H8.017c-4.427,0-8.017,3.589-8.017,8.017 s3.589,8.017,8.017,8.017h26.188v17.637c0,9.136,7.432,16.568,16.568,16.568h43.304c-0.002,0.178-0.014,0.355-0.014,0.534 c0,27.996,22.777,50.772,50.772,50.772s50.772-22.776,50.772-50.772c0-0.18-0.012-0.356-0.014-0.534h180.67 c-0.002,0.178-0.014,0.355-0.014,0.534c0,27.996,22.777,50.772,50.772,50.772c27.995,0,50.772-22.776,50.772-50.772 c0-0.18-0.012-0.356-0.014-0.534h26.203c4.427,0,8.017-3.589,8.017-8.017v-85.511C512,251.989,496.423,234.448,476.158,231.363z M375.182,144.301h60.392c9.725,0,17.637,7.912,17.637,17.637v0.534h-78.029V144.301z M375.182,230.881v-52.376h71.235 l13.094,52.376H375.182z M144.835,401.904c-19.155,0-34.739-15.583-34.739-34.739s15.584-34.739,34.739-34.739 c19.155,0,34.739,15.583,34.739,34.739S163.99,401.904,144.835,401.904z M427.023,401.904c-19.155,0-34.739-15.583-34.739-34.739 s15.584-34.739,34.739-34.739c19.155,0,34.739,15.583,34.739,34.739S446.178,401.904,427.023,401.904z M495.967,299.29h-9.086 c-5.01,0-9.086-4.076-9.086-9.086v-9.086h18.171V299.29z"></path> </svg></div>
<div class="col-9 my-auto"><span>Delivery within 3-4 days. Shipping as fast as possible</span></div>
</div>
</div>
<div class="col-12 col-md-6 pb-3">
<div class="row pb-1 secondary-color-text">
<div class="col-3 my-auto"><svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 44 44" style="height: auto; max-height: 60px; fill: currentColor;" title="Contact"> <path d="M43,6H1C0.447,6,0,6.447,0,7v30c0,0.553,0.447,1,1,1h42c0.552,0,1-0.447,1-1V7C44,6.447,43.552,6,43,6z M42,33.581 L29.612,21.194l-1.414,1.414L41.59,36H2.41l13.392-13.392l-1.414-1.414L2,33.581V8h40V33.581z"></path> <path d="M39.979,8L22,25.979L4.021,8H2v0.807L21.293,28.1c0.391,0.391,1.023,0.391,1.414,0L42,8.807V8H39.979z"></path> </svg></div>
<div class="col-9 my-auto"><span>Please contact if you have a question!</span></div>
</div>
</div>
</div>
</div>
</div>
<!-- FOOTER -->
<div id="copyright-part" class="py-3" style="background: #2A0948;">
<div class="container primary-text-color" style="font-size: 90%;">
<div>Free ebay template editor by <b>dewiso.com</b></div>
</div>
</div>
</body></html>`;

function buildThemedPreviewHtml(rawHtml, { navBg, navText, contentBg, contentText }, layout = 'two_col') {
  const heroColumns = layout === 'one_col' ? '1fr' : layout === 'two_col' ? '1fr 1fr' : '1fr 1fr';
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
  .dewiso-hero-wrap { display: grid; grid-template-columns: ${heroColumns}; gap: 20px; align-items: center; margin-bottom: 18px; }
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

function extractEditableHtml(html) {
  const source = String(html || '').trim();
  if (!source) return '';

  if (/<html[\s>]/i.test(source)) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(source, 'text/html');
    return documentNode.body?.innerHTML?.trim() || '';
  }

  return source;
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
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [alert, setAlert] = useState(null);

  const quillRef = useRef(null);
  const quillContainerRef = useRef(null);
  const previewRef = useRef(null);
  const previewEditingRef = useRef(false);
  const previewImageInputRef = useRef(null);
  const previewImageTargetRef = useRef(null);

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

  useEffect(() => {
    if (!quillContainerRef.current) return;
    if (quillRef.current) return; // Already initialized

    const quill = new Quill(quillContainerRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ header: 1 }, { header: 2 }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
      },
      placeholder: 'Edit your HTML content here...',
    });

    quillRef.current = quill;

    quill.on('text-change', () => {
      setOwnHtml(quill.root.innerHTML);
    });
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;

    const handleInput = () => {
      const newHtml = previewRef.current.innerHTML;
      setOwnHtml(newHtml);
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(newHtml);
      }
    };

    const handleFocus = () => {
      previewEditingRef.current = true;
    };

    const handleBlur = () => {
      previewEditingRef.current = false;
      const newHtml = previewRef.current.innerHTML;
      setOwnHtml(newHtml);
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(newHtml);
      }
    };

    const handleClick = (event) => {
      const image = event.target?.closest?.('img');
      if (!image) return;

      previewImageTargetRef.current = image;
      const chooseUpload = window.confirm('OK: upload an image file for this image. Cancel: enter an image URL.');
      if (chooseUpload) {
        previewImageInputRef.current?.click();
        return;
      }

      const imageUrl = window.prompt('Paste image URL');
      if (imageUrl) {
        image.setAttribute('src', imageUrl.trim());
        const newHtml = previewRef.current.innerHTML;
        setOwnHtml(newHtml);
        if (quillRef.current) {
          quillRef.current.clipboard.dangerouslyPasteHTML(newHtml);
        }
      }
    };

    const handleMouseDown = () => {
      previewEditingRef.current = true;
    };

    previewRef.current.addEventListener('input', handleInput);
    previewRef.current.addEventListener('focus', handleFocus);
    previewRef.current.addEventListener('blur', handleBlur);
    previewRef.current.addEventListener('click', handleClick);
    previewRef.current.addEventListener('mousedown', handleMouseDown);
    return () => {
      if (previewRef.current) {
        previewRef.current.removeEventListener('input', handleInput);
        previewRef.current.removeEventListener('focus', handleFocus);
        previewRef.current.removeEventListener('blur', handleBlur);
        previewRef.current.removeEventListener('click', handleClick);
        previewRef.current.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, []);

  const generatedHtml = useMemo(() => {
    if (layout === 'own_html') {
      return buildThemedPreviewHtml(ownHtml || AWESOME_DEFAULT_HTML, {
        navBg,
        navText,
        contentBg,
        contentText,
      }, layout);
    }

    // For non-own layouts, use same beautiful template but keep mode metadata for future variants.
    return buildThemedPreviewHtml(AWESOME_DEFAULT_HTML, {
      navBg,
      navText,
      contentBg,
      contentText,
    }, layout);
  }, [layout, ownHtml, navBg, navText, contentBg, contentText]);

  useEffect(() => {
    if (!previewRef.current) return;
    if (!previewEditingRef.current) {
      previewRef.current.innerHTML = extractEditableHtml(generatedHtml);
    }
  }, [generatedHtml]);

  const handleUploadHtmlFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setAlert({ type: 'error', message: 'Please upload an .html file' });
      return;
    }
    const text = await file.text();
    setOwnHtml(extractEditableHtml(text));
    if (quillRef.current) {
      quillRef.current.clipboard.dangerouslyPasteHTML(extractEditableHtml(text));
    }
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
        meta: { navBg, navText, contentBg, contentText, images: uploadedImages },
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
    setOwnHtml(extractEditableHtml(item.html || ''));
    if (quillRef.current) {
      quillRef.current.clipboard.dangerouslyPasteHTML(extractEditableHtml(item.html || ''));
    }
    if (item.meta) {
      setNavBg(item.meta.navBg || '#2A0948');
      setNavText(item.meta.navText || '#ffffff');
      setContentBg(item.meta.contentBg || '#F5F5F5');
      setContentText(item.meta.contentText || '#000000');
      setUploadedImages(Array.isArray(item.meta.images) ? item.meta.images : []);
    } else {
      setUploadedImages([]);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      setUploadingImages(true);
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      if (selectedHistoryId) {
        formData.append('templateId', selectedHistoryId);
      }

      const res = await dewisoAPI.uploadImages(formData);
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      const summary = res?.data?.summary || {};

      if (items.length) {
        setUploadedImages((prev) => {
          const merged = [...prev, ...items];
          const seen = new Set();
          return merged.filter((img) => {
            const key = `${img?.localUrl || ''}|${img?.ebayUrl || ''}|${img?.fileName || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
      }

      if (summary.failedCount > 0 || summary.localOnlyCount > 0) {
        setAlert({
          type: 'warning',
          message: `Uploaded ${summary.uploadedCount || 0}/${summary.total || items.length} to eBay. Some images were saved locally only.`,
        });
      } else {
        setAlert({ type: 'success', message: `Uploaded ${summary.uploadedCount || items.length} image(s) to server and eBay` });
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to upload Dewiso images' });
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const handlePreviewImageFile = async (event) => {
    const file = event.target.files?.[0];
    const target = previewImageTargetRef.current;
    if (!file || !target) return;

    try {
      const formData = new FormData();
      formData.append('images', file);
      if (selectedHistoryId) {
        formData.append('templateId', selectedHistoryId);
      }

      const res = await dewisoAPI.uploadImages(formData);
      const item = Array.isArray(res?.data?.items) ? res.data.items[0] : null;
      const nextUrl = item?.localUrl || item?.ebayUrl || '';
      if (!nextUrl) {
        setAlert({ type: 'error', message: 'Image upload failed' });
        return;
      }

      target.setAttribute('src', nextUrl);
      const newHtml = previewRef.current?.innerHTML || '';
      setOwnHtml(newHtml);
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(newHtml);
      }
      setAlert({ type: 'success', message: 'Image updated in preview' });
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to upload image' });
    } finally {
      event.target.value = '';
      previewImageTargetRef.current = null;
    }
  };

  const copyText = async (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setAlert({ type: 'success', message: 'Copied link to clipboard' });
    } catch {
      setAlert({ type: 'warning', message: 'Could not copy link automatically' });
    }
  };

  const downloadHtml = () => {
    const filename = `${templateName || 'dewiso'}.html`;
    const link = document.createElement('a');
    link.href = `data:text/html;charset=utf-8,${encodeURIComponent(generatedHtml)}`;
    link.download = filename;
    link.click();
    setAlert({ type: 'success', message: `Downloaded ${filename}` });
  };

  const copyHtmlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedHtml);
      setAlert({ type: 'success', message: 'HTML copied to clipboard' });
    } catch {
      setAlert({ type: 'error', message: 'Could not copy HTML to clipboard' });
    }
  };

  const handlePreviewKeyDown = (event) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      previewEditingRef.current = true;
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
              <label className="btn-secondary cursor-pointer">
                {uploadingImages ? 'Uploading images...' : 'Upload Images'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImages}
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setLayout('own_html');
                  setOwnHtml(extractEditableHtml(AWESOME_DEFAULT_HTML));
                  if (quillRef.current) {
                    quillRef.current.clipboard.dangerouslyPasteHTML(extractEditableHtml(AWESOME_DEFAULT_HTML));
                  }
                  setAlert({ type: 'success', message: 'Awesome default HTML inserted' });
                }}
              >
                Use Awesome Default HTML
              </button>
            </div>
            <div ref={quillContainerRef} className={`rounded-lg border min-h-[220px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />

            <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Uploaded Images (Server + eBay Links)
              </p>
              {uploadedImages.length === 0 ? (
                <p className="text-xs text-slate-500">No uploaded images yet.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-auto pr-1">
                  {uploadedImages.map((img, idx) => (
                    <div
                      key={`${img?.localUrl || ''}-${img?.ebayUrl || ''}-${idx}`}
                      className={`rounded-lg border p-2 ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={img?.localUrl || ''}
                          alt={img?.fileName || `image-${idx + 1}`}
                          className="h-12 w-12 rounded object-cover border border-slate-300/30"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {img?.fileName || `Image ${idx + 1}`}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">Local: {img?.localUrl || '-'}</p>
                          <p className="text-[11px] text-slate-500 truncate">eBay: {img?.ebayUrl || '-'}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                img?.status === 'uploaded'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : img?.status === 'local_only'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {img?.status || 'unknown'}
                            </span>
                            {img?.ebayUrl ? (
                              <button type="button" className="text-[11px] text-indigo-500 hover:underline" onClick={() => copyText(img.ebayUrl)}>
                                Copy eBay link
                              </button>
                            ) : null}
                          </div>
                          {img?.error ? <p className="text-[11px] text-rose-500 mt-1">{img.error}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

        <div className={`xl:col-span-7 rounded-2xl border overflow-hidden flex flex-col ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`px-4 py-2 border-b text-sm flex justify-between items-center ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
            <span>Live Preview (Click to edit)</span>
            <div className="flex gap-2">
              <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={copyHtmlToClipboard}>
                Copy HTML
              </button>
              <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={downloadHtml}>
                Download HTML
              </button>
            </div>
          </div>
          <div
            ref={previewRef}
            contentEditable
            suppressContentEditableWarning
            className="flex-1 overflow-auto p-6 bg-white outline-none focus:outline-none text-base"
            onKeyDown={handlePreviewKeyDown}
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
          />
          <input
            ref={previewImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePreviewImageFile}
          />
        </div>
      </div>
    </div>
  );
}

