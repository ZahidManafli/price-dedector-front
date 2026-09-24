import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Canvas, FabricObject, Textbox, Rect, Circle, Triangle, Line, FabricImage } from 'fabric';
import {
  ArrowLeft, Loader2, Undo2, Redo2, Save, Download, Type, Shapes as ShapesIcon,
  ImageUp, Trash2, Copy, BringToFront, SendToBack, ZoomIn, ZoomOut, Maximize,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown,
  Search, LayoutGrid, ImageOff,
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
  const fabricCanvasRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1, suppress: false, timer: null });
  const autosaveTimerRef = useRef(null);
  const uploadInputRef = useRef(null);
  const zoomRef = useRef(1);
  const dimsRef = useRef({ widthPx: 1080, heightPx: 1080 });
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
  const [elementSearch, setElementSearch] = useState('');
  const [elementResults, setElementResults] = useState([]);
  const [elementsLoading, setElementsLoading] = useState(false);
  const [addingElementId, setAddingElementId] = useState(null);
  const elementSearchTimerRef = useRef(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { dimsRef.current = dims; }, [dims]);

  // 40rem × 50rem is a MAX bound on the on-screen page frame, not a fixed
  // size every design gets forced into — the frame's own box always shrink-
  // wraps the canvas's actual (zoomed) pixel size (see the canvas wrapper's
  // inline style below), so a design narrower/shorter than 40:50 never picks
  // up dead white space above/below or left/right of it (that used to make a
  // border/frame element the user placed at the design's own edge look
  // disconnected from the visible edge of the page). Reads the root
  // font-size so the bound still respects a user's browser zoom/accessibility
  // font-size settings.
  const getFramePx = () => {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return { w: 40 * rootPx, h: 50 * rootPx };
  };

  // The design is scaled down only as far as needed to fit within the 40×50rem
  // bound (whichever dimension is the tighter constraint) — never scaled up
  // past 100% just to fill it, since the frame now sizes itself to the result
  // instead of the other way around.
  const computeFitZoom = useCallback((widthPx, heightPx) => {
    const { w, h } = getFramePx();
    return Math.min(4, Math.max(0.05, Math.min(w / widthPx, h / heightPx)));
  }, []);

  // ── Export (download / thumbnail) ───────────────────────────────────────
  // toDataURL renders at the canvas's CURRENT pixel size, which tracks the
  // on-screen zoom level (see setZoom/setDimensions above) — exporting at
  // 67% zoom would silently produce a 67%-resolution file. Reset to 1:1
  // design resolution for the export, then restore whatever zoom the user
  // was looking at.
  //
  // toDataURL THROWS synchronously (a SecurityError) instead of returning if
  // the canvas is ever "tainted" (a cross-origin image drawn onto it without
  // the browser validating CORS for it — every image added to a design is a
  // data: URL now, see addImageFromUrl, specifically to make this
  // impossible, but this guard stays as a safety net). Without a try/finally
  // here, that throw would skip the setZoom/setDimensions restore below
  // entirely, permanently stranding the canvas at 1:1/no-zoom inside the
  // fixed-size frame — on-screen the design suddenly looks "zoomed in" and
  // cropped even though the % label still shows the old value. Restoring in
  // `finally` keeps the visible canvas correct regardless of whether the
  // export itself succeeds; a failed export just yields no thumbnail/
  // download this time.
  const exportDataUrl = useCallback((multiplier = 1) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return null;
    const currentZoom = canvas.getZoom();
    canvas.discardActiveObject();
    canvas.setZoom(1);
    canvas.setDimensions({ width: dims.widthPx, height: dims.heightPx });
    canvas.renderAll();
    try {
      return canvas.toDataURL({ format: 'png', multiplier });
    } catch (err) {
      console.error('[design-studio] Export failed — canvas contains a cross-origin image that could not be verified (CORS):', err);
      return null;
    } finally {
      canvas.setZoom(currentZoom);
      canvas.setDimensions({ width: dims.widthPx * currentZoom, height: dims.heightPx * currentZoom });
      canvas.renderAll();
    }
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
      // No offset needed — the wrapper around <canvas> always shrink-wraps
      // it exactly (see the wrapper's inline style further down), so canvas
      // coordinates map directly onto the wrapper's own coordinate space.
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
        // Fabric enlivens each saved object independently (Promise.allSettled
        // under the hood) — if one of them fails (e.g. an image whose src
        // can't be (re)loaded), it is dropped SILENTLY, with the rest of the
        // design restored normally. This reviver at least surfaces that in
        // the console instead of a design quietly missing a piece with no
        // trace of why.
        await canvas.loadFromJSON(initialJson, (_objData, instance, error) => {
          if (error) {
            console.error('[design-studio] An object failed to restore from the saved design and was skipped:', error, _objData);
          }
          return instance;
        });
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

  // New elements are placed at the CANVAS's own center (matching Canva's own
  // behavior) rather than a small fixed offset from the top-left corner —
  // the latter tucked every new object into the corner, easy to miss on a
  // large canvas and confusing to find ("appears far to the left").
  const addHeading = () => {
    const width = Math.min(400, dims.widthPx - 120);
    addObject(new Textbox(t('studioEditorPage.addHeading'), {
      left: (dims.widthPx - width) / 2, top: dims.heightPx / 2 - 32,
      fontSize: 48, fontWeight: 'bold', fill: '#111827', fontFamily: 'Arial', width,
    }));
  };
  const addText = () => {
    const width = Math.min(300, dims.widthPx - 120);
    addObject(new Textbox(t('studioEditorPage.addText'), {
      left: (dims.widthPx - width) / 2, top: dims.heightPx / 2 - 14,
      fontSize: 24, fill: '#111827', fontFamily: 'Arial', width,
    }));
  };
  const addRectangle = () => addObject(new Rect({ left: dims.widthPx / 2 - 90, top: dims.heightPx / 2 - 60, width: 180, height: 120, fill: '#6366F1' }));
  const addCircle = () => addObject(new Circle({ left: dims.widthPx / 2 - 70, top: dims.heightPx / 2 - 70, radius: 70, fill: '#22C55E' }));
  const addTriangleShape = () => addObject(new Triangle({ left: dims.widthPx / 2 - 75, top: dims.heightPx / 2 - 65, width: 150, height: 130, fill: '#F97316' }));
  const addLine = () => addObject(new Line(
    [dims.widthPx / 2 - 100, dims.heightPx / 2, dims.widthPx / 2 + 100, dims.heightPx / 2],
    { stroke: '#111827', strokeWidth: 4 }
  ));

  // Images added to a design are always data: URLs — produced locally by
  // FileReader for an uploaded file (see handleFileUpload), or fetched as
  // base64 from the backend for a shared library element (see
  // addLibraryElement) — never a bare URL pointing at our own backend.
  // A data: URL is never "cross-origin" from the canvas's point of view (it
  // isn't fetched over the network at all), so it can never taint the
  // canvas — Download/thumbnail export always works regardless of any
  // reverse-proxy CORS-header quirk. This used to also accept a plain
  // http(s) URL loaded with crossOrigin:'anonymous' for library elements,
  // but that depended on the server sending exactly one correct
  // Access-Control-Allow-Origin header, which broke repeatedly in front of
  // this app's reverse proxy — moving element images through the backend as
  // base64 instead removes that whole dependency.
  const addImageFromUrl = async (url) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let img;
    try {
      img = await FabricImage.fromURL(url);
    } catch (err) {
      console.error('[design-studio] Failed to load image:', err);
      return;
    }

    const maxW = dims.widthPx * 0.8;
    const maxH = dims.heightPx * 0.8;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    img.scale(scale);
    img.set({ left: (dims.widthPx - img.width * scale) / 2, top: (dims.heightPx - img.height * scale) / 2 });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  };

  // Fetches the element's image as base64 from our own backend (server-to-
  // server, no browser CORS involved at all) and adds it exactly like a
  // local upload.
  const addLibraryElement = async (elementId) => {
    setAddingElementId(elementId);
    try {
      const res = await studioAPI.getElementImage(elementId);
      const dataUrl = res?.data?.dataUrl;
      if (!dataUrl) return;
      await addImageFromUrl(dataUrl);
    } catch (err) {
      console.error('[design-studio] Failed to load library element:', err);
    } finally {
      setAddingElementId(null);
    }
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const handleFileUpload = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await readFileAsDataUrl(file);
      setUploadedImages((prev) => [url, ...prev]);
      await addImageFromUrl(url);
    } catch {
      // best-effort — user can retry the upload
    } finally {
      setUploading(false);
    }
  };

  // ── Element library (admin-imported stock graphics) ─────────────────────
  // Debounced so every keystroke doesn't fire its own request; runs an
  // initial (empty-query) search as soon as the Elements panel is opened so
  // it isn't blank until the user types something.
  useEffect(() => {
    if (activePanel !== 'elements') return undefined;
    clearTimeout(elementSearchTimerRef.current);
    elementSearchTimerRef.current = setTimeout(async () => {
      setElementsLoading(true);
      try {
        const res = await studioAPI.searchElements(elementSearch.trim());
        setElementResults(Array.isArray(res?.data?.items) ? res.data.items : []);
      } catch {
        setElementResults([]);
      } finally {
        setElementsLoading(false);
      }
    }, 300);
    return () => clearTimeout(elementSearchTimerRef.current);
  }, [activePanel, elementSearch]);

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
    const clamped = Math.min(4, Math.max(0.1, Math.round(z * 100) / 100));
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
  // Recomputes the fit-to-frame zoom (40×50rem is a MAX bound the frame
  // shrink-wraps down to fit within — see getFramePx — so this doesn't
  // depend on window size at all).
  const resetZoom = () => applyZoom(computeFitZoom(dims.widthPx, dims.heightPx));

  const panelBase = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const toggleColorPopover = (key) => setOpenColorPopover((cur) => (cur === key ? null : key));

  // IMPORTANT: the <canvas> element below must be present in the DOM on the
  // very first render, unconditionally — the mount effect above creates the
  // Fabric Canvas synchronously against canvasElRef.current, and Fabric does
  // NOT bind to a ref reactively. If this whole tree were replaced by a
  // loading-only placeholder (as it used to be, via an early `if (loading)
  // return <spinner/>`), canvasElRef.current would be null when the effect
  // runs — Fabric silently creates a detached, invisible canvas instead of
  // throwing, and every add/select/zoom call afterwards keeps controlling
  // that detached canvas while the *real* one (mounted later, once loading
  // flips false) sits untouched at the browser's default 300×150 size. That
  // was the actual root cause of every "nothing renders at the right size"
  // report — not the zoom math itself. Loading/error states are now rendered
  // as an overlay INSIDE this same tree instead of replacing it.
  return (
    <div
      className={`flex flex-col h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Safety net for the whole editor, not just the Uploads dropzone —
        // without this, dropping a file anywhere else (e.g. onto an actively-
        // edited text box) falls through to the browser's own default drop
        // handling, which can insert the file's path as literal text into
        // whatever input/contenteditable happens to be focused. Prevented
        // here regardless of where the drop lands, and treated the same as a
        // real upload if it's an image.
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
      }}
    >
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
          <button type="button" onClick={() => setActivePanel(activePanel === 'elements' ? null : 'elements')} className={iconButtonClass(isDark, activePanel === 'elements')}>
            <LayoutGrid size={18} />{t('studioEditorPage.elements')}
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileUpload(e.dataTransfer.files?.[0]);
                  }}
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

            {activePanel === 'elements' && (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-white'}`}>
                  <Search size={14} className={isDark ? 'text-slate-400' : 'text-slate-400'} />
                  <input
                    type="text"
                    value={elementSearch}
                    onChange={(e) => setElementSearch(e.target.value)}
                    placeholder={t('studioEditorPage.searchElements')}
                    className={`flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
                  />
                </div>

                {elementsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-purple-500" />
                  </div>
                ) : elementResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {elementResults.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        title={el.name || ''}
                        onClick={() => addLibraryElement(el.id)}
                        disabled={addingElementId === el.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border p-1.5 flex items-center justify-center transition-colors disabled:opacity-60 ${isDark ? 'border-slate-700 bg-slate-800 hover:border-purple-500' : 'border-slate-200 bg-white hover:border-purple-400'}`}
                      >
                        {/* Deliberately a plain <img> — no crossOrigin, no CORS check at all. The
                            element's actual pixels are only ever fetched once, server-to-server, by
                            addLibraryElement (via GET /studio/elements/:id/image) when this button
                            is clicked — this thumbnail is just a normal same-page preview. */}
                        <img src={el.thumbnailUrl} alt={el.name || ''} className="max-w-full max-h-full object-contain" />
                        {addingElementId === el.id && (
                          <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-slate-900/60' : 'bg-white/60'}`}>
                            <Loader2 size={16} className="animate-spin text-purple-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={`flex flex-col items-center gap-2 py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <ImageOff size={22} />
                    <span className="text-xs">{t('studioEditorPage.noElementsFound')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            {/* The frame's own box always shrink-wraps the canvas's actual (zoomed)
                pixel size exactly — width/height here just mirror whatever
                Fabric's own setZoom()/setDimensions() (see applyZoom) already
                rendered the <canvas> element at, capped at 40×50rem (see
                computeFitZoom/getFramePx). No CSS transform is used for the
                zoom itself. Deliberately NOT a fixed 40rem×50rem box: that
                used to letterbox any design whose aspect ratio isn't 40:50
                with dead white space above/below or left/right, which made a
                border/frame element placed at the design's own edge look
                disconnected from the frame's visible edge. */}
            <div
              className="relative bg-white shrink-0"
              style={{ width: Math.round(dims.widthPx * zoom), height: Math.round(dims.heightPx * zoom), boxShadow: '0 8px 30px rgba(0,0,0,0.18)', borderRadius: 2 }}
            >
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
            <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{dims.widthPx} × {dims.heightPx}px</span>
            <div className={`w-px h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <button type="button" onClick={() => adjustZoom(-0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomOut size={16} /></button>
            <span className={`text-xs w-10 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => adjustZoom(0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomIn size={16} /></button>
            <button type="button" onClick={resetZoom} title="Fit" className={isDark ? 'text-slate-300' : 'text-slate-600'}><Maximize size={14} /></button>
          </div>
        </div>
      </div>

      {/* Loading / error overlays — sit on top of the always-mounted canvas,
          never replace it (see the comment above this return). */}
      {loading && !loadError && (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center ${isDark ? 'bg-slate-950/80' : 'bg-white/80'}`}>
          <Loader2 className="animate-spin text-purple-600" size={28} />
        </div>
      )}
      {loadError && (
        <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
          <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>{loadError}</p>
          <button type="button" onClick={() => navigate('/studio')} className="btn-primary">{t('studioEditorPage.back')}</button>
        </div>
      )}
    </div>
  );
}
