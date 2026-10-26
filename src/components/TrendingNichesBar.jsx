import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Lock, Sparkles, Users } from 'lucide-react';
import { zikAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TAB_KEYS } from '../utils/planAccess';

const POLL_MS = 2000;
const TIMEOUT_MS = 45000;
const PILL_COUNT = 6;

// Fisher-Yates partial shuffle — picks `count` random, non-repeating items
// without disturbing the source array.
function sampleRandom(list, count) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// "Try Suggested Searches" strip above MarketSearchBar, with a tab switch
// between trending niches and trending dropshippers (sellers) — fetched the
// exact same way MarketInsightPage.jsx fetches its own trending data
// (zikAPI.requestMarketInsights(), same extension-job + poll contract), since
// both pages want the same single underlying ZIK call. Fails silently
// (renders nothing) rather than showing an error box, since this is a
// convenience shortcut, not core search functionality — a disconnected
// extension shouldn't block or clutter the real search bar below.
export default function TrendingNichesBar({ onPick, onPickSeller, disabled }) {
  const { t } = useTranslation();
  // The data comes from Market Insight's endpoint (plan tab 'market_insight').
  // Without that tab the strip shows a lock and never calls the endpoint —
  // the 403 would otherwise send the user from Checkila Analysis to /dashboard.
  const { hasTabAccess } = useAuth();
  const canUseMarketInsight = hasTabAccess(TAB_KEYS.MARKET_INSIGHT);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState('niches');
  // A random 6-of-N picked once when the job's data arrives, not recomputed
  // on every render — otherwise switching tabs or any unrelated re-render
  // (e.g. the disabled prop flipping during a search) would reshuffle the
  // pills shown to the user.
  const [displayNiches, setDisplayNiches] = useState([]);
  const [displaySellers, setDisplaySellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canUseMarketInsight) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const jobRes = await zikAPI.requestMarketInsights({ skipPlanTabRedirect: true });
        const jobId = jobRes.data?.jobId;
        if (!jobId) throw new Error('Failed to create market insights job');

        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          if (cancelled) return;
          const pollRes = await zikAPI.pollJob(jobId);
          const { status, data: jobData, error: jobError } = pollRes.data;
          if (status === 'done') {
            if (!cancelled) {
              const niches = Array.isArray(jobData?.niches) ? jobData.niches : [];
              const sellers = Array.isArray(jobData?.sellers) ? jobData.sellers : [];
              setDisplayNiches(sampleRandom(niches, PILL_COUNT));
              setDisplaySellers(sampleRandom(sellers, PILL_COUNT));
            }
            return;
          }
          if (status === 'error') throw new Error(jobError || 'Market insights job failed');
        }
        throw new Error('Timed out');
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403 && err?.response?.data?.code === 'PLAN_TAB_ACCESS_DENIED') {
          setAccessDenied(true);
        } else {
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [canUseMarketInsight]);

  if (!canUseMarketInsight || accessDenied) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('marketAnalysisPage.trendingNichesTitle')}
          </p>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('marketAnalysisPage.trendingLocked')}
        </p>
        <div className="mt-3 flex gap-1.5">
          {['trendingNichesTab', 'trendingDropshippersTab'].map((key) => (
            <span
              key={key}
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            >
              <Lock size={12} />
              {t(`marketAnalysisPage.${key}`)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (failed || (!loading && displayNiches.length === 0 && displaySellers.length === 0)) return null;

  const tabs = [
    { key: 'niches', label: t('marketAnalysisPage.trendingNichesTab'), icon: Flame },
    { key: 'sellers', label: t('marketAnalysisPage.trendingDropshippersTab'), icon: Users },
  ];

  const renderPillSkeleton = () => (
    <div className="mt-3 flex flex-wrap gap-2">
      {Array.from({ length: PILL_COUNT }).map((_, i) => (
        <span key={i} className="h-8 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );

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

      <div className="mt-3 flex gap-1.5">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        renderPillSkeleton()
      ) : activeTab === 'niches' ? (
        displayNiches.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">{t('marketAnalysisPage.trendingNoData')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {displayNiches.map((item, i) => {
              // ZIK's own currencySymbol field comes back null — estimated sales
              // are always USD regardless, so the tooltip hardcodes $ rather
              // than trusting/blanking on that field.
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
        )
      ) : displaySellers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">{t('marketAnalysisPage.trendingNoData')}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {displaySellers.map((item, i) => {
            const sales = Number(item?.sales || 0);
            const feedback = Number(item?.feedback || 0);
            return (
              <button
                key={`${item.sellerName}-${i}`}
                type="button"
                disabled={disabled}
                title={`${sales > 0 ? `${sales.toLocaleString('en-US')} sales` : ''}${
                  feedback > 0 ? `${sales > 0 ? ' • ' : ''}${feedback.toLocaleString('en-US')} fb` : ''
                }`}
                onClick={() => onPickSeller(item.sellerName)}
                className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3.5 py-1.5 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
              >
                {item.sellerName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
