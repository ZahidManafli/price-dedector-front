import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Sparkles, Users } from 'lucide-react';
import { zikAPI } from '../services/api';

const POLL_MS = 2000;
const TIMEOUT_MS = 45000;
const MAX_PILLS = 8;

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
  const [activeTab, setActiveTab] = useState('niches');
  const [niches, setNiches] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const jobRes = await zikAPI.requestMarketInsights();
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
              setNiches(Array.isArray(jobData?.niches) ? jobData.niches : []);
              setSellers(Array.isArray(jobData?.sellers) ? jobData.sellers : []);
            }
            return;
          }
          if (status === 'error') throw new Error(jobError || 'Market insights job failed');
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

  if (failed || (!loading && niches.length === 0 && sellers.length === 0)) return null;

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

  const topSellers = [...sellers]
    .sort((a, b) => Number(b?.sales || 0) - Number(a?.sales || 0))
    .slice(0, MAX_PILLS);

  const tabs = [
    { key: 'niches', label: t('marketAnalysisPage.trendingNichesTab'), icon: Flame },
    { key: 'sellers', label: t('marketAnalysisPage.trendingDropshippersTab'), icon: Users },
  ];

  const renderPillSkeleton = () => (
    <div className="mt-3 flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
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
        topNiches.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">{t('marketAnalysisPage.trendingNoData')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {topNiches.map((item, i) => {
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
      ) : topSellers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">{t('marketAnalysisPage.trendingNoData')}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {topSellers.map((item, i) => {
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
