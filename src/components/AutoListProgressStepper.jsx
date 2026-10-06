import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Circle, AlertCircle } from 'lucide-react';

// The backend's /amazon-lookup/prepare and /confirm each do their work in one
// shot (no intermediate progress events) — adding real server-sent progress
// would mean a new SSE transport with no existing frontend consumer to reuse.
// Instead this shows the ACTUAL sequence of work (scrape → ChatGPT → ZIK →
// cover image → submit), auto-advancing on realistic estimated timings while
// the real request is in flight, and snapping straight to the true outcome
// (done/error) the instant the real response arrives — so it never claims
// more precision than it has, but still gives the user a sense of where the
// process is, instead of one opaque spinner.
const PREPARE_STEPS = [
  { key: 'scrape', labelKey: 'amazonLookupPage.stepScrape', estMs: 1800 },
  { key: 'zik', labelKey: 'amazonLookupPage.stepZik', estMs: 5000 },
  { key: 'copy', labelKey: 'amazonLookupPage.stepCopy', estMs: 2600 },
  { key: 'cover', labelKey: 'amazonLookupPage.stepCover', estMs: 1600 },
];

const CONFIRM_STEPS = [{ key: 'submit', labelKey: 'amazonLookupPage.stepSubmit', estMs: 3000 }];

// phase: 'prepare' | 'confirm' | null (idle/not running)
// outcome: 'listed' | 'awaiting_confirmation' | 'error' | null (not settled yet)
export default function AutoListProgressStepper({ phase, outcome, t, isDark = false, variant = 'full' }) {
  const steps = phase === 'confirm' ? CONFIRM_STEPS : PREPARE_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setStepIndex(0);
    if (!phase || outcome) return undefined;

    let elapsed = 0;
    for (let idx = 1; idx < steps.length; idx += 1) {
      elapsed += steps[idx - 1].estMs;
      const id = setTimeout(() => setStepIndex(idx), elapsed);
      timeoutsRef.current.push(id);
    }
    return () => timeoutsRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, outcome]);

  if (!phase) return null;

  const isError = outcome === 'error';
  const isDone = outcome === 'listed' || outcome === 'awaiting_confirmation';
  const effectiveIndex = isDone || isError ? steps.length - 1 : stepIndex;

  if (variant === 'compact') {
    const current = steps[Math.min(effectiveIndex, steps.length - 1)];
    const pct = isDone ? 100 : isError ? 100 : Math.round(((effectiveIndex + 0.5) / steps.length) * 100);
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className={`h-1.5 w-20 shrink-0 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${isError ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isError ? t('amazonLookupPage.stepFailed') : isDone ? t('amazonLookupPage.stepDone') : t(current.labelKey)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {steps.map((step, idx) => {
        const completed = idx < effectiveIndex || isDone;
        const failedHere = isError && idx === effectiveIndex;
        const active = idx === effectiveIndex && !isDone && !isError;

        return (
          <div key={step.key} className="flex items-center gap-2.5">
            {completed && <Check size={16} className="shrink-0 text-emerald-500" />}
            {failedHere && <AlertCircle size={16} className="shrink-0 text-red-500" />}
            {active && <Loader2 size={16} className="shrink-0 animate-spin text-blue-500" />}
            {!completed && !failedHere && !active && (
              <Circle size={16} className={`shrink-0 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            )}
            <span
              className={`text-sm ${
                completed
                  ? isDark
                    ? 'text-slate-300'
                    : 'text-slate-600'
                  : failedHere
                    ? 'text-red-500 font-medium'
                    : active
                      ? isDark
                        ? 'text-slate-100 font-medium'
                        : 'text-slate-900 font-medium'
                      : isDark
                        ? 'text-slate-600'
                        : 'text-slate-400'
              }`}
            >
              {t(step.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
