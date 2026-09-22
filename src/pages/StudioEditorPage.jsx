import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Canvas, Textbox, Rect, Circle, Triangle, Line, FabricImage } from 'fabric';
import {
  ArrowLeft, Loader2, Undo2, Redo2, Save, Download, Type, Shapes as ShapesIcon,
  ImageUp, Trash2, Copy, BringToFront, SendToBack, ZoomIn, ZoomOut,
} from 'lucide-react';
import { studioAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
const AUTOSAVE_DELAY_MS = 5000;
const HISTORY_DEBOUNCE_MS = 300;

function iconButtonClass(isDark, active) {
  return `flex flex-col items-center gap-1 w-full py-3 text-[11px] font-medium rounded-lg transition-colors ${
    active
      ? isDark ? 'bg-purple-950/40 text-purple-300' : 'bg-purple-50 text-purple-700'
      : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dims, setDims] = useState({ widthPx: 1080, heightPx: 1080 });
  const [title, setTitle] = useState('');
  const [zoom, setZoom] = useState(1);
  const [activePanel, setActivePanel] = useState('shapes');
  const [selected, setSelected] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveProject = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const canvasJson = JSON.stringify(canvas.toJSON());
      const maxDim = Math.max(dims.widthPx, dims.heightPx);
      const thumbnailDataUrl = canvas.toDataURL({ format: 'png', multiplier: Math.min(1, 400 / maxDim) });
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
    scheduleAutosave();
  };

  const handleUndo = () => restoreHistory(historyRef.current.index - 1);
  const handleRedo = () => restoreHistory(historyRef.current.index + 1);

  // ── Load project + init Fabric canvas ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let canvas;

    const init = async () => {
      try {
        const res = await studioAPI.getProject(projectId);
        const data = res?.data;
        if (!data || cancelled) return;

        setTitle(data.title || '');
        setDims({ widthPx: data.widthPx, heightPx: data.heightPx });
        const fitZoom = Math.min(1, 720 / Math.max(data.widthPx, data.heightPx));
        setZoom(fitZoom);

        canvas = new Canvas(canvasElRef.current, {
          width: data.widthPx,
          height: data.heightPx,
          backgroundColor: '#ffffff',
          preserveObjectStacking: true,
        });
        fabricCanvasRef.current = canvas;

        let initialJson = data.canvasJson;
        try {
          JSON.parse(initialJson);
        } catch {
          initialJson = JSON.stringify({ version: '6.0.0', objects: [] });
        }
        await canvas.loadFromJSON(initialJson);
        canvas.requestRenderAll();
        historyRef.current = { stack: [JSON.stringify(canvas.toJSON())], index: 0, suppress: false, timer: null };

        const updateSelection = () => {
          const obj = canvas.getActiveObject();
          if (!obj) { setSelected(null); return; }
          setSelected({
            id: obj,
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
          });
        };
        canvas.on('selection:created', updateSelection);
        canvas.on('selection:updated', updateSelection);
        canvas.on('selection:cleared', () => setSelected(null));
        canvas.on('object:modified', () => { updateSelection(); pushHistory(); });
        canvas.on('object:added', pushHistory);
        canvas.on('object:removed', pushHistory);

        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoadError(t('studioEditorPage.loadFailed'));
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      clearTimeout(autosaveTimerRef.current);
      clearTimeout(historyRef.current.timer);
      canvas?.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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

  const addHeading = () => addObject(new Textbox('Başlıq', {
    left: 60, top: 60, fontSize: 48, fontWeight: 'bold', fill: '#111827', fontFamily: 'Arial', width: Math.min(400, dims.widthPx - 120),
  }));
  const addText = () => addObject(new Textbox('Mətn', {
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

  // ── Selected-object property controls ───────────────────────────────────
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
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${title || t('studioEditorPage.untitled')}.png`;
    a.click();
  };

  const adjustZoom = (delta) => setZoom((z) => Math.min(2, Math.max(0.1, Math.round((z + delta) * 100) / 100)));

  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const panelBase = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';

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
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b shrink-0 ${panelBase}`}>
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <ArrowLeft size={16} /> {t('studioEditorPage.back')}
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveProject}
          placeholder={t('studioEditorPage.untitled')}
          className={`text-sm font-semibold rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-slate-300 ${isDark ? 'bg-transparent text-slate-100 focus:bg-slate-800' : 'bg-transparent text-slate-900 focus:bg-slate-50'}`}
        />
        <div className="flex-1" />
        <button type="button" onClick={handleUndo} disabled={!canUndo} title={t('studioEditorPage.undo')} className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} title={t('studioEditorPage.redo')} className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Redo2 size={16} />
        </button>
        <button type="button" onClick={saveProject} disabled={saving} className="btn-secondary inline-flex items-center gap-1.5 text-sm py-1.5 px-3">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? t('studioEditorPage.saving') : t('studioEditorPage.save')}
        </button>
        <button type="button" onClick={handleDownload} className="btn-primary inline-flex items-center gap-1.5 text-sm py-1.5 px-3">
          <Download size={14} /> {t('studioEditorPage.download')}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <div className={`w-16 shrink-0 border-r flex flex-col gap-1 p-1.5 ${panelBase}`}>
          <button type="button" onClick={() => setActivePanel('text')} className={iconButtonClass(isDark, activePanel === 'text')}>
            <Type size={18} />{t('studioEditorPage.text')}
          </button>
          <button type="button" onClick={() => setActivePanel('shapes')} className={iconButtonClass(isDark, activePanel === 'shapes')}>
            <ShapesIcon size={18} />{t('studioEditorPage.shapes')}
          </button>
          <button type="button" onClick={() => setActivePanel('uploads')} className={iconButtonClass(isDark, activePanel === 'uploads')}>
            <ImageUp size={18} />{t('studioEditorPage.uploads')}
          </button>
        </div>

        {/* Tool / properties panel */}
        <div className={`w-64 shrink-0 border-r overflow-y-auto p-4 space-y-4 ${panelBase}`}>
          {selected ? (
            <div className="space-y-4">
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selected.type}</p>

              {selected.type === 'textbox' && (
                <>
                  <div>
                    <label className={labelClass}>{t('studioEditorPage.fontFamily')}</label>
                    <select value={selected.fontFamily} onChange={(e) => updateSelectedProp({ fontFamily: e.target.value })} className={`w-full rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}>
                      {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('studioEditorPage.fontSize')}</label>
                    <input type="number" min={8} max={300} value={selected.fontSize} onChange={(e) => updateSelectedProp({ fontSize: Number(e.target.value) })} className={`w-full rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('studioEditorPage.color')}</label>
                    <input type="color" value={selected.fill} onChange={(e) => updateSelectedProp({ fill: e.target.value })} className="w-full h-9 rounded-lg border border-slate-300" />
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => updateSelectedProp({ fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`flex-1 py-1.5 rounded-lg border text-sm font-bold ${selected.fontWeight === 'bold' ? 'border-purple-500 text-purple-500' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>B</button>
                    <button type="button" onClick={() => updateSelectedProp({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`flex-1 py-1.5 rounded-lg border text-sm italic ${selected.fontStyle === 'italic' ? 'border-purple-500 text-purple-500' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>I</button>
                    <button type="button" onClick={() => updateSelectedProp({ underline: !selected.underline })} className={`flex-1 py-1.5 rounded-lg border text-sm underline ${selected.underline ? 'border-purple-500 text-purple-500' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>U</button>
                  </div>
                </>
              )}

              {['rect', 'circle', 'triangle'].includes(selected.type) && (
                <>
                  <div>
                    <label className={labelClass}>{t('studioEditorPage.fill')}</label>
                    <input type="color" value={selected.fill} onChange={(e) => updateSelectedProp({ fill: e.target.value })} className="w-full h-9 rounded-lg border border-slate-300" />
                  </div>
                  <div>
                    <label className={labelClass}>{t('studioEditorPage.stroke')}</label>
                    <input type="color" value={selected.stroke} onChange={(e) => updateSelectedProp({ stroke: e.target.value })} className="w-full h-9 rounded-lg border border-slate-300" />
                  </div>
                </>
              )}

              {selected.type === 'line' && (
                <div>
                  <label className={labelClass}>{t('studioEditorPage.color')}</label>
                  <input type="color" value={selected.stroke} onChange={(e) => updateSelectedProp({ stroke: e.target.value })} className="w-full h-9 rounded-lg border border-slate-300" />
                </div>
              )}

              <div>
                <label className={labelClass}>{t('studioEditorPage.opacity')}</label>
                <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(e) => updateSelectedProp({ opacity: Number(e.target.value) })} className="w-full" />
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-2">
                <button type="button" onClick={handleDuplicate} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                  <Copy size={12} /> {t('studioEditorPage.duplicate')}
                </button>
                <button type="button" onClick={handleDelete} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs ${isDark ? 'border-red-800 text-red-400 hover:bg-red-950/30' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                  <Trash2 size={12} /> {t('studioEditorPage.delete')}
                </button>
                <button type="button" onClick={handleBringToFront} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                  <BringToFront size={12} /> {t('studioEditorPage.bringToFront')}
                </button>
                <button type="button" onClick={handleSendToBack} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                  <SendToBack size={12} /> {t('studioEditorPage.sendToBack')}
                </button>
              </div>
            </div>
          ) : activePanel === 'text' ? (
            <div className="space-y-2">
              <button type="button" onClick={addHeading} className={`w-full text-left px-3 py-2.5 rounded-lg border text-lg font-bold ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-100' : 'border-slate-200 hover:bg-slate-50 text-slate-900'}`}>
                {t('studioEditorPage.addHeading')}
              </button>
              <button type="button" onClick={addText} className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-100' : 'border-slate-200 hover:bg-slate-50 text-slate-900'}`}>
                {t('studioEditorPage.addText')}
              </button>
            </div>
          ) : activePanel === 'shapes' ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={addRectangle} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="w-8 h-6 bg-indigo-500 rounded-sm" /> <span className="text-xs">{t('studioEditorPage.rectangle')}</span>
              </button>
              <button type="button" onClick={addCircle} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="w-7 h-7 bg-emerald-500 rounded-full" /> <span className="text-xs">{t('studioEditorPage.circle')}</span>
              </button>
              <button type="button" onClick={addTriangleShape} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[24px] border-b-orange-500" /> <span className="text-xs">{t('studioEditorPage.triangle')}</span>
              </button>
              <button type="button" onClick={addLine} className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="w-8 h-0.5 bg-slate-700 mt-3" /> <span className="text-xs">{t('studioEditorPage.line')}</span>
              </button>
            </div>
          ) : activePanel === 'uploads' ? (
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
                    <button key={url} type="button" onClick={() => addImageFromUrl(url)} className="aspect-square rounded-lg overflow-hidden border border-slate-300">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('studioEditorPage.selectObjectHint')}</p>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div style={{ width: dims.widthPx * zoom, height: dims.heightPx * zoom }}>
              <div style={{ width: dims.widthPx, height: dims.heightPx, transform: `scale(${zoom})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                <canvas ref={canvasElRef} />
              </div>
            </div>
          </div>
          <div className={`flex items-center justify-center gap-3 py-2 border-t shrink-0 ${panelBase}`}>
            <button type="button" onClick={() => adjustZoom(-0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomOut size={16} /></button>
            <span className={`text-xs w-10 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => adjustZoom(0.1)} className={isDark ? 'text-slate-300' : 'text-slate-600'}><ZoomIn size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
