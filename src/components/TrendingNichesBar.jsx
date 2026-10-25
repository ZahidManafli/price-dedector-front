import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Sparkles } from 'lucide-react';
import { zikAPI } from '../services/api';

const POLL_MS = 2000;
const TIMEOUT_MS = 45000;
const MAX_PILLS = 8;

// "Try Suggested Searches" strip above MarketSearchBar — reuses the exact same
// extension-job pattern as MarketInsightPage.jsx's trending data (ZIK's
// TrendingeBayNiches, via the extension since that's what holds a live ZIK
// session). Fails silently (renders nothing) rather than showing an error box,
// since this is a convenience shortcut, not core search functionality — a
// disconnected extension shouldn't block or clutter the real search bar below.
export default function TrendingNichesBar({ onPick, disabled }) {
  const { t } = useTranslation();
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const jobRes = await zikAPI.requestTrendingNiches();
        const jobId = jobRes.data?.jobId;
        if (!jobId) throw new Error('Failed to create trending niches job');

        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          if (cancelled) return;
          const pollRes = await zikAPI.pollJob(jobId);
          const { status, data: jobData, error: jobError } = pollRes.data;
          if (status === 'done') {
            const list = Array.isArray(jobData?.niches) ? jobData.niches : [];
            if (!cancelled) setNiches(list);
            return;
          }
          if (status === 'error') throw new Error(jobError || 'Trending niches job failed');
        }
        throw new Error('Timed out');
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (failed || (!loading && niches.length === 0)) return null;

  // Fire-flagged niches surface first (ZIK's own "hot right now" signal), then
  // the rest by estimated sales — same ordering convention as
  // MarketInsightPage.jsx's trending niches list.
  const topNiches = [...niches]
    .sort((a, b) => {
      const fireDiff = (b?.isFire ? 1 : 0) - (a?.isFire ? 1 : 0);
      if (fireDiff !== 0) return fireDiff;
      return Number(b?.salesEarning || 0) - Number(a?.salesEarning || 0);
    })
    .slice(0, MAX_PILLS);

  return (
    <div className="mb-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-500/20 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-indigo-500" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('marketAnalysisPage.trendingNichesTitle')}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('marketAnalysisPage.trendingNichesSubtitle')}
      </p>

      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-8 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {topNiches.map((item, i) => {
            // ZIK's own currencySymbol field comes back null — estimated sales
            // are always USD regardless, so the tooltip hardcodes $ rather than
            // trusting/blanking on that field.
            const estSales = Number(item?.salesEarning || 0);
            return (
              <button
                key={`${item.keywords}-${i}`}
                type="button"
                disabled={disabled}
                title={estSales > 0 ? `~$${estSales.toLocaleString('en-US')} est. sales` : undefined}
                onClick={() => onPick(item.keywords)}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              >
                {item.isFire && <Flame size={12} className="text-orange-500" />}
                {item.keywords}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
