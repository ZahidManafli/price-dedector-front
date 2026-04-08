import React from 'react';

export default function MarketRefinementPanel({ refinement }) {
  const aspects = refinement?.aspectDistributions || [];
  const conditions = refinement?.conditionDistributions || [];
  const buying = refinement?.buyingOptionDistributions || [];

  return (
    <aside className="glass-card p-4 h-fit">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Refinements</h3>
      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 mb-3">
        Use these distributions to narrow your market opportunities.
      </p>

      <div className="space-y-4">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-2">Condition</p>
          <div className="space-y-1">
            {conditions.length === 0 ? (
              <p className="text-xs text-slate-400">No condition refinements returned.</p>
            ) : (
              conditions.slice(0, 6).map((item) => (
                <div key={`${item.conditionId}-${item.matchCount}`} className="flex justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{item.condition || item.conditionId}</span>
                  <span className="text-slate-500 dark:text-slate-400">{item.matchCount || 0}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-2">Buying Options</p>
          <div className="space-y-1">
            {buying.length === 0 ? (
              <p className="text-xs text-slate-400">No buying-option refinements returned.</p>
            ) : (
              buying.slice(0, 6).map((item) => (
                <div key={`${item.buyingOption}-${item.matchCount}`} className="flex justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{item.buyingOption}</span>
                  <span className="text-slate-500 dark:text-slate-400">{item.matchCount || 0}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-2">Top Aspects</p>
          <div className="space-y-2">
            {aspects.length === 0 ? (
              <p className="text-xs text-slate-400">Run a search with category context to populate aspects.</p>
            ) : (
              aspects.slice(0, 4).map((aspect) => (
                <div key={aspect.localizedAspectName} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{aspect.localizedAspectName}</p>
                  <div className="mt-1 space-y-1">
                    {(aspect.aspectValueDistributions || []).slice(0, 3).map((value) => (
                      <div key={`${value.localizedAspectValue}-${value.matchCount}`} className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-300">{value.localizedAspectValue}</span>
                        <span className="text-slate-500 dark:text-slate-400">{value.matchCount || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
