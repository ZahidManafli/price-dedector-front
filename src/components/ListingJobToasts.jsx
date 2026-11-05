// Bottom-right cards for background "List on eBay" jobs (utils/listingJobTracker.js):
// "listing in the background…" while running, then the result with the eBay id.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { dismissListingJob, getListingJobs, pruneFinishedJobs, subscribeListingJobs } from '../utils/listingJobTracker';

export default function ListingJobToasts() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState(getListingJobs);

  useEffect(() => {
    const unsubscribe = subscribeListingJobs((next) => setJobs([...next]));
    const timer = setInterval(() => pruneFinishedJobs(), 30_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const visible = jobs.filter((j) => !j.hiddenWhileModalOpen && j.status !== 'gone');
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {visible.map((job) => {
        const running = job.status === 'pending' || job.status === 'processing';
        const done = job.status === 'done';
        return (
          <div
            key={job.id}
            className={`pointer-events-auto flex gap-3 rounded-2xl border p-3.5 shadow-xl ${
              isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {job.imageUrl ? <img src={job.imageUrl} alt="" className="h-full w-full object-contain" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {running && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                {done && <CheckCircle2 size={14} className="text-emerald-500" />}
                {!running && !done && <XCircle size={14} className="text-rose-500" />}
                {running ? t('listingModal.job.runningTitle') : done ? t('listingModal.job.doneTitle') : t('listingModal.job.failedTitle')}
              </p>
              <p className={`mt-0.5 truncate text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={job.title}>{job.title}</p>
              {running && <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('listingModal.job.runningHint')}</p>}
              {done && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold">ID {job.itemId}</span>
                  {job.listingUrl && (
                    <a href={job.listingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-500 hover:underline">
                      {t('listingModal.viewOnEbay')} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
              {job.status === 'failed' && <p className="mt-1 line-clamp-2 text-xs text-rose-500">{job.error}</p>}
            </div>
            {!running && (
              <button
                type="button"
                onClick={() => dismissListingJob(job.id)}
                aria-label={t('listingModal.close')}
                className={`h-7 w-7 shrink-0 rounded-lg p-1.5 transition ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
