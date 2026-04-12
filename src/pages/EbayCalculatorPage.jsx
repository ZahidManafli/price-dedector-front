import React, { useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, calculateProfit, calculateRecommendedEbayPrice } from '../utils/helpers';
import { Calculator, Sparkles, TrendingUp } from 'lucide-react';

export default function EbayCalculatorPage() {
  const { isDark } = useTheme();

  const [amazonCost, setAmazonCost] = useState('23.99');
  const [ebayPrice, setEbayPrice] = useState('29.99');
  const [targetProfit, setTargetProfit] = useState('3.70');
  const [fvfRate, setFvfRate] = useState('12.9');
  const [taxRate, setTaxRate] = useState('0');
  const [adRate, setAdRate] = useState('0');
  const [fixedFee, setFixedFee] = useState('0.25');

  const parsed = useMemo(() => {
    const cost = parseFloat(amazonCost) || 0;
    const salePrice = parseFloat(ebayPrice) || 0;
    const profitTarget = parseFloat(targetProfit) || 0;
    const fvf = (parseFloat(fvfRate) || 0) / 100;
    const tax = (parseFloat(taxRate) || 0) / 100;
    const ad = (parseFloat(adRate) || 0) / 100;
    const fixed = parseFloat(fixedFee) || 0;

    const denominator = 1 - (1 + tax) * (fvf + ad);
    if (cost <= 0 || denominator <= 0) {
      return {
        cost,
        salePrice,
        profitTarget,
        denominator,
        netProfit: 0,
        recommendedSalePrice: 0,
        recommendedNetProfit: 0,
      };
    }

    const recommendedSalePrice = calculateRecommendedEbayPrice(cost, profitTarget, {
      taxRate: tax,
      fvfRate: fvf,
      adRate: ad,
      fixedFee: fixed,
    });
    const netProfit = calculateProfit(salePrice, cost, {
      taxRate: tax,
      fvfRate: fvf,
      adRate: ad,
      fixedFee: fixed,
    });
    const recommendedNetProfit = calculateProfit(recommendedSalePrice, cost, {
      taxRate: tax,
      fvfRate: fvf,
      adRate: ad,
      fixedFee: fixed,
    });

    return {
      cost,
      salePrice,
      profitTarget,
      denominator,
      netProfit,
      recommendedSalePrice: Math.round(recommendedSalePrice * 100) / 100,
      recommendedNetProfit,
    };
  }, [amazonCost, ebayPrice, targetProfit, fvfRate, taxRate, adRate, fixedFee]);

  const applyPreset = (preset) => {
    if (preset === 'default') {
      setFvfRate('12.9');
      setTaxRate('0');
      setAdRate('0');
      setFixedFee('0.25');
      return;
    }
    if (preset === 'promoted') {
      setFvfRate('12.9');
      setTaxRate('0');
      setAdRate('4');
      setFixedFee('0.25');
      return;
    }
    if (preset === 'highTax') {
      setFvfRate('12.9');
      setTaxRate('6');
      setAdRate('0');
      setFixedFee('0.25');
    }
  };

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
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => applyPreset('default')} className="btn-secondary text-xs px-3 py-1.5">
                  Default
                </button>
                <button type="button" onClick={() => applyPreset('promoted')} className="btn-secondary text-xs px-3 py-1.5">
                  Promoted
                </button>
                <button type="button" onClick={() => applyPreset('highTax')} className="btn-secondary text-xs px-3 py-1.5">
                  High Tax
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amazon cost (COGS)</label>
                  <input type="number" min="0" step="0.01" value={amazonCost} onChange={(e) => setAmazonCost(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">eBay price</label>
                  <input type="number" min="0" step="0.01" value={ebayPrice} onChange={(e) => setEbayPrice(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Target profit (USD)</label>
                  <input type="number" min="0" step="0.01" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} className="input-base" />
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Fee Model
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">FVF rate (%)</label>
                    <input type="number" min="0" step="0.01" value={fvfRate} onChange={(e) => setFvfRate(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tax on fees (%)</label>
                    <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Add rate (%)</label>
                    <input type="number" min="0" step="0.01" value={adRate} onChange={(e) => setAdRate(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fixed fee (USD)</label>
                    <input type="number" min="0" step="0.01" value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} className="input-base" />
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? 'border-indigo-900/60 bg-indigo-950/20' : 'border-indigo-100 bg-indigo-50'}`}>
                <p className={`text-xs ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                  <span className="font-semibold">Formula: </span>
                  <code className="font-mono">
                    P_sale = (Cost_amazon + Profit_target + Fee_fixed) / (1 - (1 + Rate_tax) x (Rate_fvf + Rate_add))
                  </code>
                </p>
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
                  <p className="text-xs text-slate-500">Net Profit at entered eBay Price</p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {parsed.salePrice > 0 ? formatCurrency(parsed.netProfit) : '—'}
                  </p>
                </div>

                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs text-slate-500">Recommended eBay Price for Target Profit</p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      parsed.recommendedSalePrice > 0
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {parsed.recommendedSalePrice > 0 ? formatCurrency(parsed.recommendedSalePrice) : '—'}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Profit at recommended price: {formatCurrency(parsed.recommendedNetProfit)}
                  </p>
                </div>

                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-slate-50'}`}>
                  <p className="text-xs text-slate-500">Current entered price</p>
                  <p className={`text-2xl font-bold mt-1 ${
                      parsed.netProfit > 0
                        ? 'text-emerald-600'
                        : parsed.netProfit < 0
                        ? 'text-rose-600'
                        : isDark
                        ? 'text-slate-100'
                        : 'text-slate-900'
                    }`}
                  >
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

