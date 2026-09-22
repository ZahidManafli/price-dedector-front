import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette, Loader2, Plus, Pencil, Download, Trash2, ImageOff,
  CheckCircle2, XCircle, Unlink,
} from 'lucide-react';
import { canvaAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SIZE_PRESETS = [
  { key: 'square', labelKey: 'presetSquare', width: 1080, height: 1080 },
  { key: 'instaStory', labelKey: 'presetInstagramStory', width: 1080, height: 1920 },
  { key: 'fbPost', labelKey: 'presetFacebookPost', width: 1200, height: 630 },
  { key: 'product', labelKey: 'presetProductImage', width: 1000, height: 1000 },
];

const STATUS_META = {
  editing: { icon: Pencil, colorLight: 'text-blue-600 bg-blue-50 border-blue-200', colorDark: 'text-blue-300 bg-blue-950/30 border-blue-800' },
  exporting: { icon: Loader2, colorLight: 'text-amber-600 bg-amber-50 border-amber-200', colorDark: 'text-amber-300 bg-amber-950/30 border-amber-800' },
  ready: { icon: CheckCircle2, colorLight: 'text-emerald-600 bg-emerald-50 border-emerald-200', colorDark: 'text-emerald-300 bg-emerald-950/30 border-emerald-800' },
  failed: { icon: XCircle, colorLight: 'text-red-600 bg-red-50 border-red-200', colorDark: 'text-red-300 bg-red-950/30 border-red-800' },
};

function NewDesignModal({ isDark, onClose, onCreate, creating, error }) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState(SIZE_PRESETS[0].key);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [title, setTitle] = useState('');

  const isCustom = selectedPreset === 'custom';
  const preset = SIZE_PRESETS.find((p) => p.key === selectedPreset);
  const width = isCustom ? Number(customWidth) : preset?.width;
  const height = isCustom ? Number(customHeight) : preset?.height;

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
  }`;
  const cardBase = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`rounded-2xl border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${cardBase}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Palette size={18} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
            {t('canvaPage.newDesignModalTitle')}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs ${isDark ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {SIZE_PRESETS.map((p) => {
              const selected = selectedPreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPreset(p.key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? isDark ? 'border-purple-500 bg-purple-950/30' : 'border-purple-400 bg-purple-50'
                      : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold">{t(`canvaPage.${p.labelKey}`)}</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.width}×{p.height}</p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedPreset('custom')}
              className={`rounded-xl border p-3 text-left transition-colors col-span-2 ${
                isCustom
                  ? isDark ? 'border-purple-500 bg-purple-950/30' : 'border-purple-400 bg-purple-50'
                  : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold">{t('canvaPage.presetCustom')}</p>
            </button>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('canvaPage.customWidth')}</label>
                <input type="number" min={40} max={8000} value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('canvaPage.customHeight')}</label>
                <input type="number" min={40} max={8000} value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={creating} className="btn-secondary flex-1 py-2.5 disabled:opacity-60">
              {t('canvaPage.cancel')}
            </button>
            <button
              type="button"
              disabled={creating || !width || !height}
              onClick={() => onCreate({ title: title.trim() || undefined, widthPx: width, heightPx: height })}
              className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : null}
              {creating ? t('canvaPage.creating') : t('canvaPage.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CanvaPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [designs, setDesigns] = useState([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [error, setError] = useState(null);
  const [showNewDesignModal, setShowNewDesignModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const pollRef = useRef(null);

  const loadDesigns = async () => {
    setLoadingDesigns(true);
    try {
      const res = await canvaAPI.listDesigns();
      setDesigns(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch {
      setError(t('canvaPage.failedToLoad'));
    } finally {
      setLoadingDesigns(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await canvaAPI.getStatus();
        const isConnected = !!res?.data?.connected;
        setConnected(isConnected);
        if (isConnected) await loadDesigns();
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The design-editing tab (opened via window.open) posts a message back here
  // once its export finishes, so the gallery updates without a manual refresh.
  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data === 'canva:design-updated') loadDesigns();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defensive polling for any row still 'exporting' — covers the case where the
  // user closed the return tab before it finished notifying us.
  useEffect(() => {
    const hasExporting = designs.some((d) => d.status === 'exporting');
    if (!hasExporting) {
      clearInterval(pollRef.current);
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      const exportingIds = designs.filter((d) => d.status === 'exporting').map((d) => d.id);
      for (const id of exportingIds) {
        try {
          const res = await canvaAPI.getExportStatus(id);
          const updated = res?.data;
          if (updated && updated.status !== 'exporting') {
            setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
          }
        } catch {
          // best-effort — will retry next tick
        }
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs]);

  const handleConnect = async () => {
    try {
      const res = await canvaAPI.getConnectUrl();
      const authUrl = res?.data?.authUrl;
      if (!authUrl) throw new Error('missing authUrl');
      window.location.href = authUrl;
    } catch {
      setError(t('canvaPage.failedToConnect'));
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('canvaPage.confirmDisconnect'))) return;
    try {
      await canvaAPI.disconnect();
      setConnected(false);
      setDesigns([]);
    } catch {
      setError(t('canvaPage.failedToConnect'));
    }
  };

  const handleCreate = async ({ title, widthPx, heightPx }) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await canvaAPI.createDesign({ title, widthPx, heightPx });
      const editUrl = res?.data?.editUrl;
      if (editUrl) window.open(editUrl, '_blank', 'noopener');
      setShowNewDesignModal(false);
      await loadDesigns();
    } catch (err) {
      setCreateError(err?.response?.data?.error || t('canvaPage.failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleReopen = async (id) => {
    try {
      const res = await canvaAPI.reopenDesign(id);
      const editUrl = res?.data?.editUrl;
      if (editUrl) window.open(editUrl, '_blank', 'noopener');
    } catch {
      setError(t('canvaPage.failedToLoad'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('canvaPage.confirmDelete'))) return;
    try {
      await canvaAPI.deleteDesign(id);
      setDesigns((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError(t('canvaPage.failedToLoad'));
    }
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`page-title flex items-center gap-2 ${isDark ? 'text-slate-100' : ''}`}>
            <Palette size={18} />
            {t('canvaPage.title')}
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('canvaPage.subtitle')}</p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setCreateError(null); setShowNewDesignModal(true); }} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> {t('canvaPage.newDesign')}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDisconnect}
                title={t('canvaPage.disconnectButton')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                  isDark ? 'border-slate-700 text-slate-400 hover:border-red-700 hover:text-red-400' : 'border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'
                }`}
              >
                <Unlink size={14} /> {t('canvaPage.disconnectButton')}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {!connected ? (
        <div className={`rounded-xl p-8 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
          <div className="flex items-center justify-center mb-4">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-950/40 border border-purple-800' : 'bg-purple-50 border border-purple-100'}`}>
              <Palette className={isDark ? 'text-purple-400' : 'text-purple-600'} size={24} />
            </div>
          </div>
          <h2 className={`text-lg font-semibold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {isAdmin ? t('canvaPage.connectTitle') : t('canvaPage.notReadyTitle')}
          </h2>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-4 text-sm`}>
            {isAdmin ? t('canvaPage.connectSubtitle') : t('canvaPage.notReadySubtitle')}
          </p>
          {isAdmin && (
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Palette size={16} /> {t('canvaPage.connectButton')}
            </button>
          )}
        </div>
      ) : loadingDesigns ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
        </div>
      ) : designs.length === 0 ? (
        <div className={`rounded-xl p-10 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
          <ImageOff className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} size={36} />
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('canvaPage.emptyState')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {designs.map((design) => {
            const meta = STATUS_META[design.status] || STATUS_META.editing;
            const StatusIcon = meta.icon;
            return (
              <div key={design.id} className={`rounded-xl border overflow-hidden flex flex-col ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                <div className={`aspect-square flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  {design.thumbnailUrl ? (
                    <img src={design.thumbnailUrl} alt={design.title || 'Canva design'} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className={isDark ? 'text-slate-600' : 'text-slate-300'} size={28} />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={design.title || ''}>
                    {design.title || t('canvaPage.title')}
                  </p>
                  <span className={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${isDark ? meta.colorDark : meta.colorLight}`}>
                    <StatusIcon size={11} className={design.status === 'exporting' ? 'animate-spin' : ''} />
                    {t(`canvaPage.status${design.status.charAt(0).toUpperCase()}${design.status.slice(1)}`)}
                  </span>
                  {design.status === 'failed' && design.errorMessage && (
                    <p className="text-[11px] text-red-500 line-clamp-2">{design.errorMessage}</p>
                  )}
                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleReopen(design.id)}
                      title={t('canvaPage.editAction')}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold border transition-colors ${
                        isDark ? 'border-slate-600 text-slate-200 hover:border-purple-500 hover:text-purple-400' : 'border-slate-300 text-slate-700 hover:border-purple-400 hover:text-purple-600'
                      }`}
                    >
                      <Pencil size={12} /> {t('canvaPage.editAction')}
                    </button>
                    {design.status === 'ready' && design.exportUrl && (
                      <a
                        href={design.exportUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        title={t('canvaPage.downloadAction')}
                        className={`flex items-center justify-center rounded-lg p-1.5 border transition-colors ${
                          isDark ? 'border-slate-600 text-slate-200 hover:border-emerald-500 hover:text-emerald-400' : 'border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        <Download size={13} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(design.id)}
                      title={t('canvaPage.deleteAction')}
                      className={`flex items-center justify-center rounded-lg p-1.5 border transition-colors ${
                        isDark ? 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400' : 'border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-600'
                      }`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewDesignModal && (
        <NewDesignModal
          isDark={isDark}
          creating={creating}
          error={createError}
          onClose={() => setShowNewDesignModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
