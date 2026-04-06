import React, { useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, calculateProfit } from '../utils/helpers';
import { Calculator } from 'lucide-react';

export default function EbayCalculatorPage() {
  const { isDark } = useTheme();

  const [amazonCost, setAmazonCost] = useState('0');
  const [targetProfit, setTargetProfit] = useState('0');
  const [fvfRate, setFvfRate] = useState('12.9'); // %
  const [taxRate, setTaxRate] = useState('0'); // %
  const [adRate, setAdRate] = useState('0'); // %
  const [fixedFee, setFixedFee] = useState('0.25'); // USD

  const parsed = useMemo(() => {
    const cost = parseFloat(amazonCost) || 0;
    const profitTarget = parseFloat(targetProfit) || 0;
    const fvf = (parseFloat(fvfRate) || 0) / 100;
    const tax = (parseFloat(taxRate) || 0) / 100;
    const ad = (parseFloat(adRate) || 0) / 100;
    const fixed = parseFloat(fixedFee) || 0;

    const denominator = 1 - fvf * (1 + tax) - ad;
    if (cost <= 0 || denominator <= 0) {
      return {
        cost,
        profitTarget,
        salePrice: 0,
        netProfit: 0,
      };
    }

    const salePrice = (cost + profitTarget + fixed) / denominator;
    const netProfit = calculateProfit(salePrice, cost);

    return {
      cost,
      profitTarget,
      salePrice: Math.round(salePrice * 100) / 100,
      netProfit,
    };
  }, [amazonCost, targetProfit, fvfRate, taxRate, adRate, fixedFee]);

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Calculator size={22} className="text-indigo-500" />
          <div>
            <h1 className="page-title mb-0">eBay Profit Calculator</h1>
            <p className="page-subtitle">
              Enter Amazon cost and fees to see the recommended eBay sale price and resulting profit.
            </p>
          </div>
        </div>

        <div
          className={`glass-card grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 ${isDark ? 'bg-slate-950 border-slate-800' : ''}`}
        >
          <div className="space-y-4">
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Inputs
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Amazon cost (COGS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amazonCost}
                  onChange={(e) => setAmazonCost(e.target.value)}
                  className="input-base"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Target profit (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(e.target.value)}
                  className="input-base"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Final value fee rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fvfRate}
                    onChange={(e) => setFvfRate(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Tax rate on fees (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Ad / promoted rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={adRate}
                    onChange={(e) => setAdRate(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Fixed fee (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fixedFee}
                  onChange={(e) => setFixedFee(e.target.value)}
                  className="input-base"
                />
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Formula:&nbsp;
                <code className="font-mono">
                  P_sale = (Cost_amazon + Profit_target + Fee_fixed) / (1 - (Rate_fvf × (1 + Rate_tax)) - Rate_ad)
                </code>
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 md:p-5 flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="space-y-3">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Results
              </h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recommended eBay price</span>
                  <span className="font-semibold">
                    {parsed.salePrice > 0 ? formatCurrency(parsed.salePrice) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expected net profit</span>
                  <span
                    className={`font-semibold ${
                      parsed.netProfit > 0
                        ? 'text-emerald-600'
                        : parsed.netProfit < 0
                        ? 'text-rose-600'
                        : isDark
                        ? 'text-slate-100'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(parsed.netProfit)}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>
                  This calculator uses the same fee assumptions as your app: 12.9% final value fee and
                  a $0.25 fixed managed payment fee by default. You can adjust rates to match your eBay
                  category/promoted settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

