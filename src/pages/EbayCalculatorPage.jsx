import React, { useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, calculateProfit } from '../utils/helpers';
import { Calculator, Sparkles, TrendingUp } from 'lucide-react';

export default function EbayCalculatorPage() {
  const { isDark } = useTheme();

  const [amazonCost, setAmazonCost] = useState('23.99');
  const [ebayPrice, setEbayPrice] = useState('29.99');
  const [adRate, setAdRate] = useState('0');

  const parsed = useMemo(() => {
    const cost = parseFloat(amazonCost) || 0;
    const salePrice = parseFloat(ebayPrice) || 0;
    const ad = (parseFloat(adRate) || 0) / 100;
    const tax = 0.06;
    const fvf = 0.136;

    const denominator = 1 - (1 + tax) * (fvf + ad);
    if (cost <= 0 || salePrice <= 0 || denominator <= 0) {
      return {
        cost,
        salePrice,
        denominator,
        netProfit: 0,
      };
    }

    const netProfit = calculateProfit(salePrice, cost, {
      taxRate: 0.06,
      fvfRate: 0.136,
      adRate: ad,
      fixedFee: 0.30,
    });

    return {
      cost,
      salePrice,
      denominator,
      netProfit,
    };
  }, [amazonCost, ebayPrice, adRate]);

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div
          className={`rounded-2xl border p-5 mb-5 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Calculator size={22} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                eBay Profit Calculator
              </h1>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Professional calculator for recommended sale price using your fee structure and target margin.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Input Panel
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amazon cost (COGS)</label>
                  <input type="number" min="0" step="0.01" value={amazonCost} onChange={(e) => setAmazonCost(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">eBay price</label>
                  <input type="number" min="0" step="0.01" value={ebayPrice} onChange={(e) => setEbayPrice(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Add rate (%)</label>
                  <input type="number" min="0" step="0.01" value={adRate} onChange={(e) => setAdRate(e.target.value)} className="input-base" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Live Results
              </h2>

              <div className="space-y-3">
                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs text-slate-500">Estimated Profit</p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {parsed.salePrice > 0 ? formatCurrency(parsed.netProfit) : '—'}
                  </p>
                </div>
                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-slate-50'}`}>
                  <p className="text-xs text-slate-500">Current entered price</p>
                  <p className="text-2xl font-bold mt-1 text-white">
                    {formatCurrency(parsed.salePrice)}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Net profit: {formatCurrency(parsed.netProfit)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-indigo-500" />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Health Check</p>
              </div>
              <p className="text-xs text-slate-500">
                Denominator value: <span className="font-semibold">{parsed.denominator.toFixed(4)}</span>
              </p>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <TrendingUp size={14} />
                Keep denominator above 0 for valid pricing output.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

