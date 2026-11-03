// "What's new" slide-over (opened from the sidebar's WhatsNewButton). Lists
// published announcements newest first; opening it marks everything seen.
// Post bodies are plain text: blank line = paragraph, "- " line = bullet.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ExternalLink, Megaphone, Rocket, Sparkles, Wrench, X, Zap } from 'lucide-react';
import { whatsNewAPI } from '../../services/api';
import { formatLongDate } from '../../utils/dateFormat';

export const CATEGORY_META = {
  feature: { icon: Rocket, light: 'bg-indigo-50 text-indigo-700', dark: 'bg-indigo-500/15 text-indigo-300', accent: 'from-indigo-500 to-violet-500' },
  improvement: { icon: Zap, light: 'bg-emerald-50 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300', accent: 'from-emerald-500 to-teal-400' },
  fix: { icon: Wrench, light: 'bg-amber-50 text-amber-700', dark: 'bg-amber-500/15 text-amber-300', accent: 'from-amber-400 to-orange-400' },
  announcement: { icon: Megaphone, light: 'bg-sky-50 text-sky-700', dark: 'bg-sky-500/15 text-sky-300', accent: 'from-sky-500 to-indigo-400' },
};

const BULLET_RE = /^\s*[-•]\s+/;

// Groups lines into paragraphs and bullet lists: a blank line ends a
// paragraph, consecutive "- " lines form one list.
export function parsePostBody(body) {
  const groups = [];
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      groups.push(null);
      continue;
    }
    const bullet = BULLET_RE.test(line);
    const last = groups[groups.length - 1];
    if (last && last.type === (bullet ? 'list' : 'paragraph')) {
      last.lines.push(bullet ? line.replace(BULLET_RE, '') : line.trim());
    } else {
      groups.push({ type: bullet ? 'list' : 'paragraph', lines: [bullet ? line.replace(BULLET_RE, '') : line.trim()] });
    }
  }
  return groups.filter(Boolean);
}

export function PostBody({ body, isDark }) {
  const groups = useMemo(() => parsePostBody(body), [body]);
  const text = isDark ? 'text-slate-300' : 'text-slate-600';
  return (
    <div className="space-y-2.5">
      {groups.map((group, i) =>
        group.type === 'list' ? (
          <ul key={i} className="space-y-1.5">
            {group.lines.map((line, j) => (
              <li key={j} className={`flex gap-2 text-sm leading-relaxed ${text}`}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className={`text-sm leading-relaxed ${text}`}>
            {group.lines.join(' ')}
          </p>
        )
      )}
    </div>
  );
}

export const formatPostDate = formatLongDate;

export function PostCard({ post, isDark, onLink }) {
  const { t, i18n } = useTranslation();
  const meta = CATEGORY_META[post.category] || CATEGORY_META.feature;
  const Icon = meta.icon;
  const external = post.linkUrl && /^https:\/\//.test(post.linkUrl);
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.accent}`} />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDark ? meta.dark : meta.light}`}>
          <Icon size={11} />
          {t(`whatsNew.category.${post.category}`)}
        </span>
        <time className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatPostDate(post.publishedAt, i18n.language)}</time>
        {post.isNew && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {t('whatsNew.newBadge')}
          </span>
        )}
      </div>
      <h3 className={`mt-3 text-base font-semibold leading-snug ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{post.title}</h3>
      <div className="mt-2">
        <PostBody body={post.body} isDark={isDark} />
      </div>
      {post.linkUrl && (
        <button
          type="button"
          onClick={() => onLink?.(post.linkUrl, external)}
          className={`mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            isDark ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          {post.linkLabel || t('whatsNew.learnMore')}
          {external ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
        </button>
      )}
    </article>
  );
}

const FILTERS = ['all', 'feature', 'improvement', 'fix', 'announcement'];

export default function WhatsNewPanel({ open, onClose, isDark, onSeen }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    whatsNewAPI
      .list()
      .then((res) => {
        if (cancelled) return;
        setPosts(Array.isArray(res?.data?.posts) ? res.data.posts : []);
        // Opening the panel is "seeing" it: clear the badge.
        whatsNewAPI.markSeen().then(() => onSeen?.()).catch(() => {});
      })
      .catch((err) => !cancelled && setError(err?.response?.data?.error || t('whatsNew.loadFailed')))
      .finally(() => !cancelled && setLoading(false));

    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = filter === 'all' ? posts : posts.filter((post) => post.category === filter);
  const presentCategories = new Set(posts.map((post) => post.category));

  const handleLink = (url, external) => {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    onClose();
    navigate(url);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <button type="button" aria-label={t('whatsNew.close')} onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
      <div className={`relative flex h-full w-full max-w-md flex-col shadow-2xl ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <header className={`relative overflow-hidden border-b px-5 pb-4 pt-5 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 id="whats-new-title" className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('whatsNew.title')}</h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('whatsNew.subtitle')}</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t('whatsNew.close')}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <X size={18} />
            </button>
          </div>
          {presentCategories.size > 1 && (
            <div className="relative mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTERS.filter((key) => key === 'all' || presentCategories.has(key)).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filter === key
                      ? 'bg-indigo-600 text-white'
                      : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t(`whatsNew.filter.${key}`)}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`animate-pulse rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className={`h-3 w-24 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`mt-4 h-4 w-3/4 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`mt-3 h-3 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`mt-2 h-3 w-5/6 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              </div>
            ))}
          {!loading && error && (
            <p className={`rounded-xl px-4 py-3 text-sm ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{error}</p>
          )}
          {!loading && !error && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'}`}>
                <Sparkles size={26} />
              </div>
              <p className={`mt-4 text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('whatsNew.emptyTitle')}</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('whatsNew.emptyText')}</p>
            </div>
          )}
          {!loading && !error && visible.map((post) => <PostCard key={post.id} post={post} isDark={isDark} onLink={handleLink} />)}
        </div>
      </div>
    </div>,
    document.body
  );
}
