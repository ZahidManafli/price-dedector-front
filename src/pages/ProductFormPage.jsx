import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ebayAPI, productAPI } from '../services/api';
import {
  calculateProfit,
  extractAmazonAsin,
  formatCurrency,
  isValidAmazonAsin,
} from '../utils/helpers';
import Alert from '../components/Alert';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { Check, CircleDollarSign, Loader2, Mail, Package, PackagePlus, Pencil, ShieldCheck, ShoppingCart, Store, X } from 'lucide-react';

function trimAccountValue(value) {
  return String(value || '').trim();
}

function getAccountKeys(account = {}) {
  return [
    account.id,
    account.accountId,
    account.tradingAccountId,
    account.profileUserId,
    account.username,
  ]
    .map(trimAccountValue)
    .filter(Boolean);
}

function getProductAccountKeys(product = {}) {
  return [
    product.ebayAccountId,
    product.ebayAccountInternalId,
    product.ebayTradingAccountId,
    product.ebayProfileUserId,
  ]
    .map(trimAccountValue)
    .filter(Boolean);
}

function getPreferredAccountValue(account = {}) {
  return trimAccountValue(
    account.id || account.accountId || account.tradingAccountId || account.profileUserId || account.username
  );
}

function findMatchingAccount(accounts = [], keys = []) {
  const targetKeys = new Set(keys.map(trimAccountValue).filter(Boolean));
  if (!targetKeys.size) return null;
  return accounts.find((account) => getAccountKeys(account).some((key) => targetKeys.has(key))) || null;
}

export function ProductFormModal({ productId = null, onClose, onSuccess }) {
  const isEditMode = Boolean(productId);
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const profitOptions = {
    taxRate: 0.06,
    fvfRate: 0.136,
    adRate: 0,
    fixedFee: 0.3,
  };
  const [formData, setFormData] = useState({
    productName: '',
    amazonAsin: '',
    ebayItemId: '',
    isVariationProduct: false,
    variationSku: '',
    currentAmazonPrice: '',
    currentEbayPrice: '',
    adRate: '',
    userEmail: '',
    // New products start with every check unselected (false) until the user opts in
    // here or later from the Products page's per-row check-settings popover.
    checkPriceEnabled: false,
    checkStockEnabled: false,
    checkTitleEnabled: false,
    checkHighPriceEnabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [alert, setAlert] = useState(null);
  const [calculatedProfit, setCalculatedProfit] = useState(0);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [selectedEbayAccountId, setSelectedEbayAccountId] = useState('');
  const [boundProductAccountKeys, setBoundProductAccountKeys] = useState([]);

  useEffect(() => {
    const loadEbayAccounts = async () => {
      try {
        const res = await ebayAPI.getStatus();
        const status = res?.data || {};
        const accounts = Array.isArray(status.ebayAccounts) ? status.ebayAccounts : [];
        setEbayAccounts(accounts);
        setActiveEbayAccountId(status.activeEbayAccountId || null);
        if (!isEditMode) {
          const activeAcc = findMatchingAccount(accounts, [status.activeEbayAccountId]);
          const defaultAccount = activeAcc || accounts[0] || null;
          setSelectedEbayAccountId(getPreferredAccountValue(defaultAccount));
        }
      } catch {
        setEbayAccounts([]);
        setActiveEbayAccountId(null);
      }
    };
    loadEbayAccounts();
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchProduct = async () => {
      try {
        setInitialLoading(true);
        const response = await productAPI.getById(productId);
        const product = response.data;

        const nextData = {
          productName: product.productName || '',
          amazonAsin: product.amazonAsin || extractAmazonAsin(product.amazonLink || ''),
          ebayItemId: product.ebayItemId || '',
          isVariationProduct: !!product.isVariationProduct,
          variationSku: product.ebayVariationSku || '',
          currentAmazonPrice: product.currentAmazonPrice ?? '',
          currentEbayPrice: product.currentEbayPrice ?? '',
          adRate: product.adRate ?? '',
          userEmail: product.userEmail || '',
          // The API already resolves NULL (legacy, pre-feature) to enabled — default
          // to true here only as a further fallback if a field is ever missing.
          checkPriceEnabled: product.checkPriceEnabled !== false,
          checkStockEnabled: product.checkStockEnabled !== false,
          checkTitleEnabled: product.checkTitleEnabled !== false,
          checkHighPriceEnabled: product.checkHighPriceEnabled !== false,
        };

        setFormData(nextData);
        setCalculatedProfit(calculateProfit(nextData.currentEbayPrice, nextData.currentAmazonPrice, {
          ...profitOptions,
          adRate: (parseFloat(nextData.adRate) || 0) / 100,
        }));
        setBoundProductAccountKeys(getProductAccountKeys(product));
      } catch (error) {
        setAlert({ type: 'error', message: t('productFormPage.failedLoad') });
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProduct();
  }, [isEditMode, productId]);

  useEffect(() => {
    if (!isEditMode || !boundProductAccountKeys.length || !ebayAccounts.length) return;
    const matchedAccount = findMatchingAccount(ebayAccounts, boundProductAccountKeys);
    if (matchedAccount) {
      setSelectedEbayAccountId(getPreferredAccountValue(matchedAccount));
    }
  }, [isEditMode, boundProductAccountKeys, ebayAccounts]);

  useEffect(() => {
    setCalculatedProfit(
      calculateProfit(formData.currentEbayPrice, formData.currentAmazonPrice, {
        ...profitOptions,
        adRate: (parseFloat(formData.adRate) || 0) / 100,
      })
    );
  }, [formData.currentAmazonPrice, formData.currentEbayPrice, formData.adRate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    // Validation
    if (!formData.productName || !formData.amazonAsin || !formData.ebayItemId) {
      setAlert({ type: 'error', message: t('productFormPage.pleaseFillRequired') });
      return;
    }
    if (!/^\d{9,15}$/.test(String(formData.ebayItemId || '').trim())) {
      setAlert({ type: 'error', message: t('productFormPage.ebayIdInvalid') });
      return;
    }

    if (!isValidAmazonAsin(formData.amazonAsin)) {
      setAlert({ type: 'error', message: t('productFormPage.asinInvalid') });
      return;
    }

    if (formData.isVariationProduct && !String(formData.variationSku || '').trim()) {
      setAlert({ type: 'error', message: t('productFormPage.variationSkuRequired') });
      return;
    }

    if (!formData.currentAmazonPrice || !formData.currentEbayPrice) {
      setAlert({ type: 'error', message: t('productFormPage.enterBothPrices') });
      return;
    }

    if (!formData.userEmail) {
      setAlert({ type: 'error', message: t('productFormPage.enterEmail') });
      return;
    }

    try {
      setLoading(true);

      const formDataObj = new FormData();
      formDataObj.append('productName', formData.productName);
      formDataObj.append('amazonAsin', formData.amazonAsin.trim().toUpperCase());
      formDataObj.append('ebayItemId', String(formData.ebayItemId || '').trim());
      formDataObj.append('isVariationProduct', String(!!formData.isVariationProduct));
      formDataObj.append('variationSku', formData.isVariationProduct ? String(formData.variationSku || '').trim() : '');
      formDataObj.append('currentAmazonPrice', formData.currentAmazonPrice);
      formDataObj.append('currentEbayPrice', formData.currentEbayPrice);
      formDataObj.append('adRate', formData.adRate || '0');
      formDataObj.append('userEmail', formData.userEmail);
      formDataObj.append('checkPriceEnabled', String(!!formData.checkPriceEnabled));
      formDataObj.append('checkStockEnabled', String(!!formData.checkStockEnabled));
      formDataObj.append('checkTitleEnabled', String(!!formData.checkTitleEnabled));
      formDataObj.append('checkHighPriceEnabled', String(!!formData.checkHighPriceEnabled));
      if (selectedEbayAccountId) {
        const selectedAcc = findMatchingAccount(ebayAccounts, [selectedEbayAccountId]);
        const selectedAccountValue = getPreferredAccountValue(selectedAcc || {});
        formDataObj.append('ebayAccountId', selectedAccountValue);
        if (selectedAcc?.id) {
          formDataObj.append('ebayAccountInternalId', selectedAcc.id);
        }
        if (selectedAcc?.tradingAccountId) {
          formDataObj.append('tradingAccountId', selectedAcc.tradingAccountId);
          formDataObj.append('ebayTradingAccountId', selectedAcc.tradingAccountId);
        }
      }

      // Both now just queue a background job (an Amazon re-scrape can take up
      // to ~90s across its own internal retries — too slow to risk as one
      // synchronous request) and return a jobId right away. onSuccess hands
      // that jobId up to ProductsPage.jsx, which keeps polling it to
      // completion even after this modal closes (same pattern as its
      // existing bulk-import job) and refreshes the list when it's done; a
      // notification is also recorded server-side regardless.
      const response = isEditMode
        ? await productAPI.update(productId, formDataObj)
        : await productAPI.create(formDataObj);
      const jobId = response?.data?.jobId;

      setAlert({
        type: 'success',
        message: isEditMode ? t('productFormPage.updateQueued') : t('productFormPage.addQueued'),
      });
      setTimeout(() => {
        onSuccess?.(jobId, isEditMode ? 'update' : 'create');
        onClose?.();
      }, 600);
    } catch (error) {
      setAlert({
        type: 'error',
        message:
          error.response?.data?.error ||
          (isEditMode ? t('productFormPage.failedUpdate') : t('productFormPage.failedAdd')),
      });
    } finally {
      setLoading(false);
    }
  };

  const fees =
    Number(formData.currentEbayPrice) > 0 && Number(formData.currentAmazonPrice) > 0
      ? Math.max(0, Number(formData.currentEbayPrice) - Number(formData.currentAmazonPrice) - calculatedProfit)
      : null;
  const ebayPriceNum = Number(formData.currentEbayPrice) || 0;
  const margin = ebayPriceNum > 0 && fees !== null ? Math.round((calculatedProfit / ebayPriceNum) * 100) : null;
  const asinValid = !formData.amazonAsin || isValidAmazonAsin(formData.amazonAsin);
  const ebayIdValid = !formData.ebayItemId || /^\d{9,15}$/.test(String(formData.ebayItemId).trim());

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const labelCls = `mb-1.5 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const inputCls = (invalid = false) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:opacity-60 ${
      invalid
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
        : isDark ? 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
    } ${isDark ? 'bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'bg-white text-slate-900 placeholder:text-slate-400'}`;
  const section = `rounded-2xl border p-4 sm:p-5 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/60'}`;
  const SectionTitle = ({ icon: Icon, title, hint, accent = 'text-indigo-500' }) => (
    <div className="mb-4 flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm ring-1 ring-slate-200'}`}>
        <Icon size={16} className={accent} />
      </span>
      <div>
        <p className={`text-sm font-semibold ${strong}`}>{title}</p>
        {hint ? <p className={`text-xs ${muted}`}>{hint}</p> : null}
      </div>
    </div>
  );
  const Toggle = ({ name, checked, label, hint }) => (
    <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3.5 py-3 transition ${
      checked
        ? isDark ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-indigo-200 bg-indigo-50/60'
        : isDark ? 'border-slate-800 bg-slate-950/40 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${strong}`}>{label}</span>
        <span className={`mt-0.5 block text-xs leading-relaxed ${muted}`}>{hint}</span>
      </span>
      <input type="checkbox" name={name} checked={checked} onChange={handleChange} disabled={loading} className="peer sr-only" />
      <span aria-hidden="true" className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 ${checked ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </label>
  );
  const enabledChecks = ['checkPriceEnabled', 'checkStockEnabled', 'checkTitleEnabled', 'checkHighPriceEnabled'].filter((k) => formData[k]).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              {isEditMode ? <Pencil size={18} /> : <PackagePlus size={18} />}
            </span>
            <div className="min-w-0">
              <h1 className={`text-lg font-bold ${strong}`}>{isEditMode ? t('productFormPage.editTitle') : t('productFormPage.addTitle')}</h1>
              <p className={`truncate text-xs ${muted}`}>{isEditMode && formData.productName ? formData.productName : t('productFormPage.ui.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={t('common.cancel')}
            className={`rounded-lg p-2 transition ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />}

          {initialLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              {/* Basic info */}
              <section className={section}>
                <SectionTitle icon={Package} title={t('productFormPage.ui.basicTitle')} hint={t('productFormPage.ui.basicHint')} />
                <div className="space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="pf-name">{t('productFormPage.productName')}</label>
                    <input id="pf-name" type="text" name="productName" value={formData.productName} onChange={handleChange} placeholder={t('productFormPage.productNamePlaceholder')} className={inputCls()} disabled={loading} required />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="pf-asin">{t('productFormPage.amazonAsin')}</label>
                      <div className="relative">
                        <ShoppingCart size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" />
                        <input id="pf-asin" type="text" name="amazonAsin" value={formData.amazonAsin} onChange={handleChange} placeholder={t('productFormPage.amazonAsinPlaceholder')} className={`${inputCls(!asinValid)} pl-9 font-mono uppercase`} disabled={loading} required />
                      </div>
                      {!asinValid && <p className="mt-1 text-xs text-rose-500">{t('productFormPage.asinInvalid')}</p>}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="pf-ebay">{t('productFormPage.ebayProductId')}</label>
                      <div className="relative">
                        <Store size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                        <input id="pf-ebay" type="text" inputMode="numeric" name="ebayItemId" value={formData.ebayItemId} onChange={handleChange} placeholder={t('productFormPage.ebayIdPlaceholder')} className={`${inputCls(!ebayIdValid)} pl-9 font-mono`} disabled={loading} required />
                      </div>
                      {!ebayIdValid && <p className="mt-1 text-xs text-rose-500">{t('productFormPage.ebayIdInvalid')}</p>}
                    </div>
                  </div>

                  {/* Variation product + SKU — eBay has no single top-level price/quantity to
                      revise on a multi-variation listing, only per-variation ones, each keyed
                      by its own SKU (see ebayService.js's reviseInventoryStatusTrading). Left
                      unchecked (the default), price/stock sync behaves exactly as it always
                      has — no SKU is ever required or used. */}
                  <Toggle name="isVariationProduct" checked={formData.isVariationProduct} label={t('productFormPage.isVariationProduct')} hint={t('productFormPage.isVariationProductHint')} />
                  {formData.isVariationProduct ? (
                    <input type="text" name="variationSku" value={formData.variationSku} onChange={handleChange} placeholder={t('productFormPage.variationSkuPlaceholder')} className={`${inputCls()} font-mono`} disabled={loading} required />
                  ) : null}

                  {ebayAccounts.length > 0 && (
                    <div>
                      <label className={labelCls} htmlFor="pf-account">{t('productFormPage.ebayAccountForProduct')}</label>
                      <select id="pf-account" value={selectedEbayAccountId} onChange={(e) => setSelectedEbayAccountId(e.target.value)} className={inputCls()} disabled={loading} required>
                        {ebayAccounts.map((acc) => {
                          const optionValue = getPreferredAccountValue(acc);
                          const isActiveAccount = getAccountKeys(acc).includes(trimAccountValue(activeEbayAccountId));
                          return (
                            <option key={optionValue} value={optionValue}>
                              {acc.connectionName || acc.username || acc.profileUserId || t('productFormPage.unknownAccount')}
                              {isActiveAccount ? ` ${t('productFormPage.activeAccountSuffix')}` : ''}
                            </option>
                          );
                        })}
                      </select>
                      <p className={`mt-1 text-xs ${muted}`}>{t('productFormPage.usedForSync')}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Pricing */}
              <section className={section}>
                <SectionTitle icon={CircleDollarSign} accent="text-emerald-500" title={t('productFormPage.ui.pricingTitle')} hint={t('productFormPage.ui.pricingHint')} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    ['currentAmazonPrice', t('productFormPage.amazonPrice'), '$', true],
                    ['currentEbayPrice', t('productFormPage.ebayPrice'), '$', true],
                    ['adRate', t('productFormPage.adRate'), '%', false],
                  ].map(([name, label, unit, required]) => (
                    <div key={name}>
                      <label className={labelCls} htmlFor={`pf-${name}`}>{label}</label>
                      <div className="relative">
                        {unit === '$' && <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>$</span>}
                        <input
                          id={`pf-${name}`}
                          type="number"
                          name={name}
                          value={formData[name]}
                          onChange={handleChange}
                          placeholder={name === 'adRate' ? t('productFormPage.adRatePlaceholder') : t('productFormPage.pricePlaceholder')}
                          step="0.01"
                          min="0"
                          className={`${inputCls()} tabular-nums ${unit === '$' ? 'pl-7' : 'pr-8'}`}
                          disabled={loading}
                          required={required}
                        />
                        {unit === '%' && <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>%</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`mt-2 text-xs ${muted}`}>{t('productFormPage.adRateHint')}</p>

                {/* Profit Preview */}
                {(formData.currentAmazonPrice || formData.currentEbayPrice) && (
                  <div className={`mt-4 rounded-xl border p-4 ${
                    calculatedProfit >= 0
                      ? isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/60'
                      : isDark ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-200 bg-rose-50/60'
                  }`}>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{t('productFormPage.estimatedProfit')}</p>
                        <p className={`text-3xl font-extrabold tabular-nums ${calculatedProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {calculatedProfit >= 0 ? '+' : ''}{formatCurrency(calculatedProfit)}
                        </p>
                      </div>
                      {margin !== null && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${calculatedProfit >= 0 ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700'}`}>
                          {t('productFormPage.ui.margin', { margin })}
                        </span>
                      )}
                    </div>
                    {fees !== null && (
                      <>
                        <div className={`mt-3 flex h-2.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                          {[
                            [fees, 'bg-sky-500'],
                            [Number(formData.currentAmazonPrice), 'bg-amber-400'],
                            [Math.max(0, calculatedProfit), 'bg-emerald-500'],
                          ].map(([value, bar]) => (
                            <div key={bar} className={`h-full ${bar}`} style={{ width: `${Math.min(100, (value / Math.max(ebayPriceNum, fees + Number(formData.currentAmazonPrice))) * 100)}%` }} />
                          ))}
                        </div>
                        <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${muted}`}>
                          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />{t('productFormPage.ui.ebayFees')}: <b className={strong}>{formatCurrency(fees)}</b></span>
                          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />{t('productFormPage.ui.amazonCost')}: <b className={strong}>{formatCurrency(formData.currentAmazonPrice)}</b></span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Check settings — which checks the cron job and manual Compare run for
                  this product. Unselected here means disabled (false), not "use default";
                  this only ever matters going forward, since existing products fetched
                  from the API already resolve a legacy NULL to enabled. */}
              <section className={section}>
                <SectionTitle
                  icon={ShieldCheck}
                  accent="text-violet-500"
                  title={t('productChecks.popoverTitle')}
                  hint={t('productFormPage.ui.checksEnabled', { count: enabledChecks })}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: 'checkPriceEnabled', labelKey: 'priceLabel', hintKey: 'priceHint' },
                    { key: 'checkStockEnabled', labelKey: 'stockLabel', hintKey: 'stockHint' },
                    { key: 'checkTitleEnabled', labelKey: 'titleLabel', hintKey: 'titleHint' },
                    { key: 'checkHighPriceEnabled', labelKey: 'highPriceLabel', hintKey: 'highPriceHint' },
                  ].map(({ key, labelKey, hintKey }) => (
                    <Toggle key={key} name={key} checked={formData[key]} label={t(`productChecks.${labelKey}`)} hint={t(`productChecks.${hintKey}`)} />
                  ))}
                </div>
              </section>

              {/* Notifications */}
              <section className={section}>
                <SectionTitle icon={Mail} accent="text-sky-500" title={t('productFormPage.ui.notifyTitle')} hint={t('productFormPage.emailHint')} />
                <label className={labelCls} htmlFor="pf-email">{t('productFormPage.emailForNotifications')}</label>
                <input id="pf-email" type="email" name="userEmail" value={formData.userEmail} onChange={handleChange} placeholder={t('productFormPage.emailPlaceholder')} className={inputCls()} disabled={loading} required />
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-white'}`}>
          <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5" disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading || initialLoading} className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-2.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {loading
              ? isEditMode
                ? t('productFormPage.updating')
                : t('productFormPage.adding')
              : isEditMode
                ? t('productFormPage.updateButton')
                : t('productFormPage.addButton')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  return (
    <ProductFormModal
      productId={productId || null}
      onClose={() => navigate('/dashboard')}
      onSuccess={() => navigate('/dashboard')}
    />
  );
}
