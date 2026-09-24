import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Palette, Loader2, Plus, Pencil, Trash2, ImageOff } from 'lucide-react';
import { studioAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

const SIZE_PRESETS = [
  { key: 'square', labelKey: 'presetSquare', width: 1080, height: 1080 },
  { key: 'instaStory', labelKey: 'presetInstagramStory', width: 1080, height: 1920 },
  { key: 'fbPost', labelKey: 'presetFacebookPost', width: 1200, height: 630 },
  { key: 'product', labelKey: 'presetProductImage', width: 1000, height: 1000 },
];

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
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-blue-500' : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
  }`;
  const cardBase = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`rounded-2xl border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${cardBase}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Palette size={18} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
            {t('studioPage.newDesignModalTitle')}
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
                  <p className="text-sm font-semibold">{t(`studioPage.${p.labelKey}`)}</p>
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
              <p className="text-sm font-semibold">{t('studioPage.presetCustom')}</p>
            </button>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('studioPage.customWidth')}</label>
                <input type="number" min={40} max={8000} value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('studioPage.customHeight')}</label>
                <input type="number" min={40} max={8000} value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={creating} className="btn-secondary flex-1 py-2.5 disabled:opacity-60">
              {t('studioPage.cancel')}
            </button>
            <button
              type="button"
              disabled={creating || !width || !height}
              onClick={() => onCreate({ title: title.trim() || undefined, widthPx: width, heightPx: height })}
              className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : null}
              {creating ? t('studioPage.creating') : t('studioPage.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Each user gets exactly ONE Design Studio workspace at a time (enforced
// backend-side too, see routes/designStudio.js) — they either keep editing
// it or delete it and start a fresh one. So this page shows at most a single
// workspace card, not a gallery grid, and only offers "+ New Design" when
// there isn't one yet.
export default function StudioGalleryPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);
  const [showNewDesignModal, setShowNewDesignModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const res = await studioAPI.listProjects();
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setWorkspace(items[0] || null);
    } catch {
      setError(t('studioPage.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async ({ title, widthPx, heightPx }) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await studioAPI.createProject({ title, widthPx, heightPx });
      const id = res?.data?.id;
      if (!id) throw new Error('missing id');
      navigate(`/studio/${id}`);
    } catch (err) {
      const apiError = err?.response?.data?.error;
      setCreateError(apiError || t('studioPage.failedToCreate'));
      setCreating(false);
      // A 409 here means our own local state was stale (e.g. two tabs) —
      // resync so the UI reflects the workspace that actually exists.
      if (err?.response?.status === 409) {
        setShowNewDesignModal(false);
        loadWorkspace();
      }
    }
  };

  const handleDelete = async () => {
    if (!workspace || !window.confirm(t('studioPage.confirmDelete'))) return;
    setDeleting(true);
    try {
      await studioAPI.deleteProject(workspace.id);
      setWorkspace(null);
    } catch {
      setError(t('studioPage.failedToLoad'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`page-title flex items-center gap-2 ${isDark ? 'text-slate-100' : ''}`}>
            <Palette size={18} />
            {t('studioPage.title')}
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('studioPage.subtitle')}</p>
        </div>
        {!loading && !workspace && (
          <button type="button" onClick={() => { setCreateError(null); setShowNewDesignModal(true); }} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('studioPage.newDesign')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
        </div>
      ) : !workspace ? (
        <div className={`rounded-xl p-10 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
          <ImageOff className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} size={36} />
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('studioPage.emptyState')}</p>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('studioPage.oneWorkspaceHint')}</p>
        </div>
      ) : (
        <div className="max-w-sm">
          <div className={`rounded-xl border overflow-hidden flex flex-col ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
            <button
              type="button"
              onClick={() => navigate(`/studio/${workspace.id}`)}
              className={`aspect-square flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
            >
              {workspace.thumbnailUrl ? (
                <img src={workspace.thumbnailUrl} alt={workspace.title || ''} className="w-full h-full object-cover" />
              ) : (
                <ImageOff className={isDark ? 'text-slate-600' : 'text-slate-300'} size={28} />
              )}
            </button>
            <div className="p-4 flex flex-col gap-1.5">
              <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={workspace.title || ''}>
                {workspace.title || t('studioEditorPage.untitled')}
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('studioPage.lastEdited')}: {new Date(workspace.updatedAt).toLocaleString()}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(`/studio/${workspace.id}`)}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm"
                >
                  <Pencil size={13} /> {t('studioPage.editAction')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  title={t('studioPage.deleteAction')}
                  className={`flex items-center justify-center rounded-lg p-2 border transition-colors disabled:opacity-60 ${
                    isDark ? 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400' : 'border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-600'
                  }`}
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('studioPage.oneWorkspaceHint')}</p>
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
