import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { learningAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// Route path -> the same TAB_KEYS values used for plan-access gating
// (src/utils/planAccess.js) and shown in Sidebar.jsx — a single shared
// vocabulary for "which page is this", reused here instead of inventing a
// second one. Ordered doesn't matter: no two paths here are prefixes of
// each other.
const PATH_TO_PAGE_KEY = {
  '/dashboard': 'dashboard',
  '/products': 'products',
  '/listings': 'listings',
  '/orders': 'orders',
  '/tracking': 'tracking',
  '/cases': 'cases',
  '/support': 'support',
  '/buyers': 'buyer_crm',
  '/amazon-lookup': 'amazon_lookup',
  '/ebay-calculator': 'ebay_calculator',
  '/market-analysis': 'market_analysis',
  '/market-insight': 'market_insight',
  '/dewiso': 'dewiso',
  '/studio': 'design_studio',
  '/learning': 'learning',
  '/profit-table': 'profit_table',
  '/referals': 'referrals',
  '/settings': 'settings',
  '/admin': 'admin',
};

function resolvePageKey(pathname) {
  // Exact segment match on the first path component (so `/studio/abc123`,
  // the editor route, still resolves to `design_studio` — but doesn't get a
  // button anyway, since the editor hides the whole sidebar/chrome).
  const firstSegment = `/${String(pathname || '').split('/').filter(Boolean)[0] || ''}`;
  return PATH_TO_PAGE_KEY[firstSegment] || null;
}

// Mounted ONCE in App.jsx (alongside <Sidebar/>, not per-page) — fetches the
// admin-configured page->video links a single time for the whole session,
// then just re-resolves which (if any) video applies as the route changes.
// Renders nothing when the current page has no linked video, or none was
// ever configured for it.
export default function TutorialVideoButton() {
  const location = useLocation();
  const { isDark } = useTheme();
  const [links, setLinks] = useState(null); // null = not loaded yet

  useEffect(() => {
    let cancelled = false;
    learningAPI.getPageLinks()
      .then((res) => { if (!cancelled) setLinks(res?.data?.links || {}); })
      .catch(() => { if (!cancelled) setLinks({}); });
    return () => { cancelled = true; };
  }, []);

  const pageKey = resolvePageKey(location.pathname);
  const videoId = pageKey && links ? links[pageKey] : null;
  if (!videoId) return null;

  return (
    <button
      type="button"
      onClick={() => window.open(`/learning?video=${encodeURIComponent(videoId)}`, '_blank', 'noopener,noreferrer')}
      className={`fixed right-5 top-3 z-30 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition hover:shadow-md ${
        isDark
          ? 'border-indigo-500/30 bg-slate-900/90 text-indigo-300 hover:bg-slate-800'
          : 'border-indigo-100 bg-white/90 text-indigo-600 hover:bg-indigo-50'
      }`}
    >
      <PlayCircle size={14} />
      Təlim videosu
    </button>
  );
}
