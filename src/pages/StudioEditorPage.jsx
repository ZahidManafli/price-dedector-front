import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Canvas, FabricObject, Textbox, Rect, Circle, Triangle, Line, FabricImage } from 'fabric';
import {
  ArrowLeft, Loader2, Undo2, Redo2, Save, Download, Type, Shapes as ShapesIcon,
  ImageUp, Trash2, Copy, BringToFront, SendToBack, ZoomIn, ZoomOut, Maximize,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown,
} from 'lucide-react';
import { studioAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New', 'Trebuchet MS'];
const AUTOSAVE_DELAY_MS = 5000;
const HISTORY_DEBOUNCE_MS = 300;
const COLOR_PALETTE = [
  '#000000', '#374151', '#FFFFFF', '#EF4444', '#F97316', '#F59E0B',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

// Gives every Fabric object a consistent, Canva-like selection look (round
// handles, brand-purple border) instead of Fabric's default green squares.
FabricObject.ownDefaults = {
  ...FabricObject.ownDefaults,
  cornerColor: '#7c3aed',
  cornerStyle: 'circle',
  cornerSize: 11,
  cornerStrokeColor: '#ffffff',
  transparentCorners: false,
  borderColor: '#7c3aed',
  borderScaleFactor: 2,
  padding: 4,
};

function ColorSwatchButton({ value, onChange, open, onToggle, isDark }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}
      >
        <span className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: value }} />
        <ChevronDown size={12} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div
            className={`absolute z-50 top-full mt-1.5 left-0 rounded-xl border shadow-xl p-3 w-48 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-purple-500 ring-offset-1' : 'border-black/10'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-8 rounded-lg cursor-pointer" />
          </div>
        </>
      )}
    </div>
  );
}

function iconButtonClass(isDark, active) {
  return `flex flex-col items-center gap-1 w-full py-3 text-[11px] font-medium rounded-lg transition-all ${
    active
      ? isDark ? 'bg-purple-950/50 text-purple-300' : 'bg-purple-50 text-purple-700'
      : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
  }`;
}

function toolbarBtnClass(isDark, active) {
  return `p-1.5 rounded-lg transition-colors ${
    active
      ? isDark ? 'bg-purple-950/50 text-purple-300' : 'bg-purple-100 text-purple-700'
      : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
  }`;
}

export default function StudioEditorPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const canvasElRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1, suppress: false, timer: null });
  const autosaveTimerRef = useRef(null);
  const uploadInputRef = useRef(null);
  const zoomRef = useRef(1);
  const rafRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dims, setDims] = useState({ widthPx: 1080, heightPx: 1080 });
  const [title, setTitle] = useState('');
  const [zoom, setZoom] = useState(1);
  const [activePanel, setActivePanel] = useState('shapes');
  const [selected, setSelected] = useState(null);
  const [toolbarPos, setToolbarPos] = useState(null);
  const [openColorPopover, setOpenColorPopover] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // How much the design should fill the available canvas viewport — measured
  // from the actual scroll container (not a fixed guess), the same way a real
  // design tool fits the page to whatever screen space it's given rather than
  // a small constant that looks tiny on a large monitor. Never zooms IN past
  // 100% for the initial/"Fit" view, matching standard editor conventions.
  const computeFitZoom = useCallback((widthPx, heightPx) => {
    const el = canvasAreaRef.current;
    const padding = 80; // matches this container's p-10 (40px each side)
    const availW = Math.max(200, (el?.clientWidth || 1000) - padding);
    const availH = Math.max(200, (el?.clientHeight || 700) - padding);
    return Math.min(1, availW / widthPx, availH / heightPx);
  }, []);

  // ── Export (download / thumbnail) ───────────────────────────────────────
  // toDataURL renders at the canvas's CURRENT pixel size, which tracks the
  // on-screen zoom level (see setZoom/setDimensions above) — exporting at
  // 67% zoom would silently produce a 67%-resolution file. Reset to 1:1
  // design resolution for the export, then restore whatever zoom the user
  // was looking at.
  const exportDataUrl = useCallback((multiplier = 1) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return null;
    const currentZoom = canvas.getZoom();
    canvas.discardActiveObject();
    canvas.setZoom(1);
    canvas.setDimensions({ width: dims.widthPx, height: dims.heightPx });
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier });
    canvas.setZoom(currentZoom);
    canvas.setDimensions({ width: dims.widthPx * currentZoom, height: dims.heightPx * currentZoom });
    canvas.renderAll();
    return dataUrl;
  }, [dims]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveProject = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const canvasJson = JSON.stringify(canvas.toJSON());
      const maxDim = Math.max(dims.widthPx, dims.heightPx);
      const thumbnailDataUrl = exportDataUrl(Math.min(1, 400 / maxDim));
      await studioAPI.saveProject(projectId, { title: title || undefined, canvasJson, thumbnailDataUrl });
    } catch {
      // best-effort — local edits stay in the canvas either way; next autosave/Save retries
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, title, dims]);

  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { saveProject(); }, AUTOSAVE_DELAY_MS);
  }, [saveProject]);

  // ── History (undo/redo) ─────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyRef.current.suppress) return;
    clearTimeout(historyRef.current.timer);
    historyRef.current.timer = setTimeout(() => {
      const h = historyRef.current;
      const json = JSON.stringify(canvas.toJSON());
      if (h.stack[h.index] === json) return;
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(json);
      h.index = h.stack.length - 1;
      setCanUndo(h.index > 0);
      setCanRedo(false);
      scheduleAutosave();
    }, HISTORY_DEBOUNCE_MS);
  }, [scheduleAutosave]);

  const restoreHistory = async (index) => {
    const canvas = fabricCanvasRef.current;
    const h = historyRef.current;
    if (!canvas || index < 0 || index >= h.stack.length) return;
    h.suppress = true;
    h.index = index;
    await canvas.loadFromJSON(h.stack[index]);
    canvas.requestRenderAll();
    h.suppress = false;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
    setSelected(null);
    setToolbarPos(null);
    scheduleAutosave();
  };

  const handleUndo = () => restoreHistory(historyRef.current.index - 1);
  const handleRedo = () => restoreHistory(historyRef.current.index + 1);

  // ── Init Fabric canvas + load project ───────────────────────────────────
  // The Canvas instance is created SYNCHRONOUSLY, before any `await` — under
  // React 18 StrictMode (dev only), effects mount → cleanup → mount again to
  // surface exactly this kind of bug: if canvas creation were deferred behind
  // an async call, the first invocation's cleanup could fire (or not) at the
  // wrong time relative to canvas creation, leaving two Fabric instances
  // fighting over the same raw <canvas> DOM node — which is what caused every
  // toolbar button to silently do nothing. Creating it synchronously and
  // disposing it synchronously in cleanup removes that race entirely.
  useEffect(() => {
    if (fabricCanvasRef.current) return undefined;
    let cancelled = false;

    const canvas = new Canvas(canvasElRef.current, {
      width: dims.widthPx,
      height: dims.heightPx,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = canvas;

    const updateSelection = () => {
      const obj = canvas.getActiveObject();
      if (!obj) { setSelected(null); return; }
      setSelected({
        type: obj.type,
        fill: obj.fill || '#000000',
        stroke: obj.stroke || '#000000',
        strokeWidth: obj.strokeWidth || 0,
        opacity: obj.opacity ?? 1,
        fontFamily: obj.fontFamily || 'Arial',
        fontSize: obj.fontSize || 24,
        fontWeight: obj.fontWeight || 'normal',
        fontStyle: obj.fontStyle || 'normal',
        underline: !!obj.underline,
        textAlign: obj.textAlign || 'left',
      });
    };

    const updateToolbarPos = () => {
      const obj = canvas.getActiveObject();
      if (!obj) { setToolbarPos(null); return; }
      const rect = obj.getBoundingRect();
      const z = zoomRef.current;
      setToolbarPos({
        left: (rect.left + rect.width / 2) * z,
        top: Math.max(0, rect.top * z - 46),
      });
    };
    const scheduleToolbarUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => { rafRef.current = null; updateToolbarPos(); });
    };

    canvas.on('selection:created', () => { updateSelection(); updateToolbarPos(); });
    canvas.on('selection:updated', () => { updateSelection(); updateToolbarPos(); });
    canvas.on('selection:cleared', () => { setSelected(null); setToolbarPos(null); setOpenColorPopover(null); });
    canvas.on('object:moving', scheduleToolbarUpdate);
    canvas.on('object:scaling', scheduleToolbarUpdate);
    canvas.on('object:rotating', scheduleToolbarUpdate);
    canvas.on('object:modified', () => { updateSelection(); updateToolbarPos(); pushHistory(); });
    canvas.on('text:changed', () => pushHistory());
    canvas.on('object:added', () => pushHistory());
    canvas.on('object:removed', () => { pushHistory(); setToolbarPos(null); });

    (async () => {
      try {
        const res = await studioAPI.getProject(projectId);
        const data = res?.data;
        if (!data || cancelled) return;

        // Defensive clamping — a project row with a missing/zero/corrupted
        // width_px or height_px (e.g. saved by an earlier, buggy build of this
        // page) would otherwise silently produce a degenerate near-invisible
        // canvas with no error. Fall back to a sane square default instead.
        const safeWidth = Math.min(8000, Math.max(40, Math.round(Number(data.widthPx)) || 1080));
        const safeHeight = Math.min(8000, Math.max(40, Math.round(Number(data.heightPx)) || 1080));

        setTitle(data.title || '');
        setDims({ widthPx: safeWidth, heightPx: safeHeight });
        const initialFit = computeFitZoom(safeWidth, safeHeight);
        setZoom(initialFit);
        // Zoom is implemented via Fabric's own viewport transform (setZoom), not
        // CSS transforms — setDimensions sets the canvas element's actual pixel
        // size to the already-zoomed size, while object coordinates (left/top)
        // stay in un-zoomed "design space" the whole time. Mixing in an extra
        // CSS `transform: scale()` on top of Fabric's own canvas sizing fought
        // with Fabric's internal DPI/sizing handling and was the actual cause
        // of newly-added objects failing to paint in an earlier version of
        // this page.
        canvas.setDimensions({ width: Math.round(safeWidth * initialFit), height: Math.round(safeHeight * initialFit) });
        canvas.setZoom(initialFit);

        let initialJson = data.canvasJson;
        try {
          const parsed = JSON.parse(initialJson);
          if (!parsed || !Array.isArray(parsed.objects)) throw new Error('malformed');
        } catch {
          initialJson = JSON.stringify({ version: '6.0.0', objects: [] });
        }

        // Suppress history/autosave side effects while objects already saved on
        // this project are being restored — object:added fires once per
        // restored object, and without this guard each one would (harmlessly
        // but pointlessly) queue an autosave and pre-enable the Undo button
        // before the user has made any change of their own.
        historyRef.current.suppress = true;
        await canvas.loadFromJSON(initialJson);
        if (cancelled) return;
        canvas.requestRenderAll();
        historyRef.current = { stack: [JSON.stringify(canvas.toJSON())], index: 0, suppress: false, timer: null };
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoadError(t('studioEditorPage.loadFailed'));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(autosaveTimerRef.current);
      clearTimeout(historyRef.current.timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.dispose();
      if (fabricCanvasRef.current === canvas) fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const active = canvas.getActiveObject();
      if (active?.isEditing) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && active) {
        e.preventDefault();
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'd' && active) {
        e.preventDefault();
        handleDuplicate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add elements ─────────────────────────────────────────────────────────
  const addObject = (obj) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  };

  const addHeading = () => addObject(new Textbox(t('studioEditorPage.addHeading'), {
    left: 60, top: 60, fontSize: 48, fontWeight: 'bold', fill: '#111827', fontFamily: 'Arial', width: Math.min(400, dims.widthPx - 120),
  }));
  const addText = () => addObject(new Textbox(t('studioEditorPage.addText'), {
    left: 60, top: 140, fontSize: 24, fill: '#111827', fontFamily: 'Arial', width: Math.min(300, dims.widthPx - 120),
  }));
  const addRectangle = () => addObject(new Rect({ left: 80, top: 80, width: 180, height: 120, fill: '#6366F1' }));
  const addCircle = () => addObject(new Circle({ left: 80, top: 80, radius: 70, fill: '#22C55E' }));
  const addTriangleShape = () => addObject(new Triangle({ left: 80, top: 80, width: 150, height: 130, fill: '#F97316' }));
  const addLine = () => addObject(new Line([60, 100, 260, 100], { stroke: '#111827', strokeWidth: 4 }));

  const addImageFromUrl = async (url) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    const maxW = dims.widthPx * 0.8;
    const maxH = dims.heightPx * 0.8;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    img.scale(scale);
    img.set({ left: (dims.widthPx - img.width * scale) / 2, top: (dims.heightPx - img.height * scale) / 2 });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await studioAPI.uploadImage(formData);
      const url = res?.data?.url;
      if (url) {
        setUploadedImages((prev) => [url, ...prev]);
        await addImageFromUrl(url);
      }
    } catch {
      // best-effort — user can retry the upload
    } finally {
      setUploading(false);
    }
  };

  // ── Selected-object actions ──────────────────────────────────────────────
  const updateSelectedProp = (props) => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set(props);
    canvas.requestRenderAll();
    setSelected((prev) => (prev ? { ...prev, ...props } : prev));
    pushHistory();
  };

  const handleDelete = () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  };

  const handleDuplicate = async () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    const clone = await obj.clone();
    clone.set({ left: (obj.left || 0) + 20, top: (obj.top || 0) + 20 });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
  };

  const handleBringToFront = () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.bringObjectToFront(obj);
    canvas.requestRenderAll();
    pushHistory();
  };

  const handleSendToBack = () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.sendObjectToBack(obj);
    canvas.requestRenderAll();
    pushHistory();
  };

  const handleDownload = () => {
    const dataUrl = exportDataUrl(1);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${title || t('studioEditorPage.untitled')}.png`;
    a.click();
  };

  // Single source of truth for zoom — every zoom change (initial fit, +/-
  // buttons, "Fit" reset) goes through this one function so the Fabric canvas's
  // actual pixel size, its internal viewport zoom, and the React `zoom` state
  // driving the on-screen % label can never drift apart from each other.
  const applyZoom = (z) => {
    const canvas = fabricCanvasRef.current;
    const clamped = Math.min(2, Math.max(0.1, Math.round(z * 100) / 100));
    const w = Math.max(40, dims.widthPx || 1080);
    const h = Math.max(40, dims.heightPx || 1080);
    if (canvas) {
      canvas.setZoom(clamped);
      canvas.setDimensions({ width: Math.round(w * clamped), height: Math.round(h * clamped) });
      canvas.requestRenderAll();
      const active = canvas.getActiveObject();
      if (active) {
        const rect = active.getBoundingRect();
        setToolbarPos({ left: (rect.left + rect.width / 2) * clamped, top: Math.max(0, rect.top * clamped - 46) });
      }
    }
    setZoom(clamped);
  };
  const adjustZoom = (delta) => applyZoom(zoomRef.current + delta);
  // Recomputes from the container's CURRENT size rather than replaying the
  // stale value captured at load, so it still fits correctly if the window
  // was resized since.
  const resetZoom = () => applyZoom(computeFitZoom(dims.widthPx, dims.heightPx));

  const panelBase = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const toggleColorPopover = (key) => setOpenColorPopover((cur) => (cur === key ? null : key));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-purple-600" size={28} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>{loadError}</p>
        <button type="button" onClick={() => navigate('/studio')} className="btn-primary">{t('studioEditorPage.back')}</button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Top bar */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b shrink-0 ${panelBase}`}>
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <ArrowLeft size={16} /> {t('studioEditorPage.back')}
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveProject}
          placeholder={t('studioEditorPage.untitled')}
          className={`text-sm font-semibold rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-slate-300 shrink-0 w-40 ${isDark ? 'bg-transparent text-slate-100 focus:bg-slate-800' : 'bg-transparent text-slate-900 focus:bg-slate-50'}`}
        />

        <div className={`h-6 w-px mx-1 shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Contextual controls for the current selection */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto min-w-0">
          {selected?.type === 'textbox' && (
            <>
              <select
                value={selected.fontFamily}
                onChange={(e) => updateSelectedProp({ fontFamily: e.target.value })}
                className={`text-sm rounded-lg border px-2 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input
                type="number" min={8} max={300} value={selected.fontSize}
                onChange={(e) => updateSelectedProp({ fontSize: Number(e.target.value) })}
                className={`w-16 text-sm rounded-lg border px-2 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
              />
              <ColorSwatchButton isDark={isDark} value={selected.fill} open={openColorPopover === 'fill'} onToggle={() => toggleColorPopover('fill')} onChange={(c) => updateSelectedProp({ fill: c })} />
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => updateSelectedProp({ fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })} className={toolbarBtnClass(isDark, selected.fontWeight === 'bold')}><Bold size={15} /></button>
                <button type="button" onClick={() => updateSelectedProp({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })} className={toolbarBtnClass(isDark, selected.fontStyle === 'italic')}><Italic size={15} /></button>
                <button type="button" onClick={() => updateSelectedProp({ underline: !selected.underline })} className={toolbarBtnClass(isDark, selected.underline)}><Underline size={15} /></button>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => updateSelectedProp({ textAlign: 'left' })} className={toolbarBtnClass(isDark, selected.textAlign === 'left')}><AlignLeft size={15} /></button>
                <button type="button" onClick={() => updateSelectedProp({ textAlign: 'center' })} className={toolbarBtnClass(isDark, selected.textAlign === 'center')}><AlignCenter size={15} /></button>
                <button type="button" onClick={() => updateSelectedProp({ textAlign: 'right' })} className={toolbarBtnClass(isDark, selected.textAlign === 'right')}><AlignRight size={15} /></button>
              </div>
            </>
          )}

          {['rect', 'circle', 'triangle'].includes(selected?.type) && (
            <>
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('studioEditorPage.fill')}</span>
              <ColorSwatchButton isDark={isDark} value={selected.fill} open={openColorPopover === 'fill'} onToggle={() => toggleColorPopover('fill')} onChange={(c) => updateSelectedProp({ fill: c })} />
              <span className={`text-xs font-medium ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('studioEditorPage.stroke')}</span>
              <ColorSwatchButton isDark={isDark} value={selected.stroke} open={openColorPopover === 'stroke'} onToggle={() => toggleColorPopover('stroke')} onChange={(c) => updateSelectedProp({ stroke: c })} />
              <input
                type="number" min={0} max={40} value={selected.strokeWidth}
                onChange={(e) => updateSelectedProp({ strokeWidth: Number(e.target.value) })}
                className={`w-14 text-sm rounded-lg border px-2 py-1.5 outline-none ml-1 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </>
          )}

          {selected?.type === 'line' && (
            <>
              <ColorSwatchButton isDark={isDark} value={selected.stroke} open={openColorPopover === 'stroke'} onToggle={() => toggleColorPopover('stroke')} onChange={(c) => updateSelectedProp({ stroke: c })} />
              <input
                type="number" min={1} max={40} value={selected.strokeWidth}
                onChange={(e) => updateSelectedProp({ strokeWidth: Number(e.target.value) })}
                className={`w-14 text-sm rounded-lg border px-2 py-1.5 outline-none ml-1 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </>
          )}

          {selected?.type === 'image' && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('studioEditorPage.opacity')}</span>
              <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(e) => updateSelectedProp({ opacity: Number(e.target.value) })} className="w-28" />
            </div>
          )}
        </div>

        <div className={`h-6 w-px mx-1 shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        <button type="button" onClick={handleUndo} disabled={!canUndo} title={t('studioEditorPage.undo')} className={`p-2 rounded-lg transition-colors disabled:opacity-30 shrink-0 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} title={t('studioEditorPage.redo')} className={`p-2 rounded-lg transition-colors disabled:opacity-30 shrink-0 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Redo2 size={16} />
        </button>
        <button type="button" onClick={saveProject} disabled={saving} className="btn-secondary inline-flex items-center gap-1.5 text-sm py-1.5 px-3 shrink-0">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? t('studioEditorPage.saving') : t('studioEditorPage.save')}
        </button>
        <button type="button" onClick={handleDownload} className="btn-primary inline-flex items-center gap-1.5 text-sm py-1.5 px-3 shrink-0">
          <Download size={14} /> {t('studioEditorPage.download')}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <div className={`w-16 shrink-0 border-r flex flex-col gap-1 p-1.5 ${panelBase}`}>
          <button type="button" onClick={() => setActivePanel(activePanel === 'text' ? null : 'text')} className={iconButtonClass(isDark, activePanel === 'text')}>
            <Type size={18} />{t('studioEditorPage.text')}
          </button>
          <button type="button" onClick={() => setActivePanel(activePanel === 'shapes' ? null : 'shapes')} className={iconButtonClass(isDark, activePanel === 'shapes')}>
            <ShapesIcon size={18} />{t('studioEditorPage.shapes')}
          </button>
          <button type="button" onClick={() => setActivePanel(activePanel === 'uploads' ? null : 'uploads')} className={iconButtonClass(isDark, activePanel === 'uploads')}>
            <ImageUp size={18} />{t('studioEditorPage.uploads')}
          </button>
        </div>

        {/* Add-element panel */}
        {activePanel && (
          <div className={`w-64 shrink-0 border-r overflow-y-auto p-4 space-y-4 ${panelBase}`}>
            {activePanel === 'text' && (
              <div className="space-y-2">
                <button type="button" onClick={addHeading} className={`w-full text-left px-3 py-2.5 rounded-lg border text-lg font-bold transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-100' : 'border-slate-200 hover:bg-slate-50 text-slate-900'}`}>
                  {t('studioEditorPage.addHeading')}
                </button>
                <button type="button" onClick={addText} className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-100' : 'border-slate-200 hover:bg-slate-50 text-slate-900'}`}>
                  {t('studioEditorPage.addText')}
                </button>
              </div>
            )}

            {activePanel === 'shapes' && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={addRectangle} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-all hover:scale-105 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="w-8 h-6 bg-indigo-500 rounded-sm" /> <span className="text-xs">{t('studioEditorPage.rectangle')}</span>
                </button>
                <button type="button" onClick={addCircle} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-all hover:scale-105 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="w-7 h-7 bg-emerald-500 rounded-full" /> <span className="text-xs">{t('studioEditorPage.circle')}</span>
                </button>
                <button type="button" onClick={addTriangleShape} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-all hover:scale-105 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[24px] border-b-orange-500" /> <span className="text-xs">{t('studioEditorPage.triangle')}</span>
                </button>
                <button type="button" onClick={addLine} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-all hover:scale-105 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="w-8 h-0.5 bg-slate-700 mt-3" /> <span className="text-xs">{t('studioEditorPage.line')}</span>
                </button>
              </div>
            )}

            {activePanel === 'uploads' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors disabled:opacity-60 ${isDark ? 'border-slate-600 hover:border-purple-500 text-slate-300' : 'border-slate-300 hover:border-purple-400 text-slate-600'}`}
                >
                  {uploading ? <Loader2 size={22} className="animate-spin" /> : <ImageUp size={22} />}
                  <span className="text-xs">{uploading ? t('studioEditorPage.uploading') : t('studioEditorPage.dragDropHint')}</span>
                </button>
                <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {uploadedImages.map((url) => (
                      <button key={url} type="button" onClick={() => addImageFromUrl(url)} className="aspect-square rounded-lg overflow-hidden border border-slate-300 hover:opacity-80 transition-opacity">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={canvasAreaRef} className="flex-1 overflow-auto flex items-center justify-center p-10">
            {/* No CSS transform here — zoom is applied via Fabric's own setZoom()/
                setDimensions() (see applyZoom), so this wrapper just hugs the
                canvas element at whatever pixel size Fabric has already set it to. */}
            <div className="relative inline-block" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.18)', borderRadius: 2, overflow: 'hidden' }}>
              <canvas ref={canvasElRef} />

              {/* Floating action cluster above the selected object */}
              {toolbarPos && (
                <div
                  className={`absolute z-30 flex items-center gap-0.5 rounded-xl border shadow-lg px-1 py-1 -translate-x-1/2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                  style={{ left: toolbarPos.left, top: toolbarPos.top }}
                >
                  <button type="button" onClick={handleDuplicate} title={t('studioEditorPage.duplicate')} className={toolbarBtnClass(isDark, false)}><Copy size={14} /></button>
                  <button type="button" onClick={handleBringToFront} title={t('studioEditorPage.bringToFront')} className={toolbarBtnClass(isDark, false)}><BringToFront size={14} /></button>
                  <button type="button" onClick={handleSendToBack} title={t('studioEditorPage.sendToBack')} className={toolbarBtnClass(isDark, false)}><SendToBack size={14} /></button>
                  <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <button type="button" onClick={handleDelete} title={t('studioEditorPage.delete')} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-950/40' : 'text-red-500 hover:bg-red-50'}`}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </div>
          <div className={`flex items-center justify-center gap-3 py-2 border-t shrink-0 ${panelBase}`}>
            <button type="button" onClick={() => adjustZoom(-0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomOut size={16} /></button>
            <span className={`text-xs w-10 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => adjustZoom(0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomIn size={16} /></button>
            <button type="button" onClick={resetZoom} title="Fit" className={isDark ? 'text-slate-300' : 'text-slate-600'}><Maximize size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
