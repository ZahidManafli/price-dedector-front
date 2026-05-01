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
import LoadingSpinner from '../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';

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
    currentAmazonPrice: '',
    currentEbayPrice: '',
    adRate: '',
    userEmail: '',
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
          currentAmazonPrice: product.currentAmazonPrice ?? '',
          currentEbayPrice: product.currentEbayPrice ?? '',
          adRate: product.adRate ?? '',
          userEmail: product.userEmail || '',
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
      formDataObj.append('currentAmazonPrice', formData.currentAmazonPrice);
      formDataObj.append('currentEbayPrice', formData.currentEbayPrice);
      formDataObj.append('adRate', formData.adRate || '0');
      formDataObj.append('userEmail', formData.userEmail);
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

      if (isEditMode) {
        await productAPI.update(productId, formDataObj);
      } else {
        await productAPI.create(formDataObj);
      }

      setAlert({
        type: 'success',
        message: isEditMode ? t('productFormPage.updated') : t('productFormPage.added'),
      });
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 600);
    } catch (error) {
      setAlert({
        type: 'error',
        message:
          error.response?.data?.message ||
          (isEditMode ? t('productFormPage.failedUpdate') : t('productFormPage.failedAdd')),
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <LoadingSpinner />;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] p-3 md:p-6 flex items-center justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="w-full max-w-2xl">
        <div className="mb-3">
          <h1 className="page-title">
            {isEditMode ? t('productFormPage.editTitle') : t('productFormPage.addTitle')}
          </h1>
        </div>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
              autoClose={false}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card p-4 md:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('productFormPage.productName')}
            </label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder={t('productFormPage.productNamePlaceholder')}
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* Amazon ASIN */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('productFormPage.amazonAsin')}
            </label>
            <input
              type="text"
              name="amazonAsin"
              value={formData.amazonAsin}
              onChange={handleChange}
              placeholder={t('productFormPage.amazonAsinPlaceholder')}
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* eBay Item ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('productFormPage.ebayProductId')}
            </label>
            <input
              type="text"
              name="ebayItemId"
              value={formData.ebayItemId}
              onChange={handleChange}
              placeholder={t('productFormPage.ebayIdPlaceholder')}
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* eBay Account selection (if multiple accounts) */}
          {ebayAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('productFormPage.ebayAccountForProduct')}
              </label>
              <select
                value={selectedEbayAccountId}
                onChange={(e) => setSelectedEbayAccountId(e.target.value)}
                className="input-base"
                disabled={loading}
                required
              >
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
              <p className="text-xs text-slate-500 mt-1">
                {t('productFormPage.usedForSync')}
              </p>
            </div>
          )}

          {/* Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('productFormPage.amazonPrice')}
              </label>
              <input
                type="number"
                name="currentAmazonPrice"
                value={formData.currentAmazonPrice}
                onChange={handleChange}
                placeholder={t('productFormPage.pricePlaceholder')}
                step="0.01"
                className="input-base"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('productFormPage.ebayPrice')}
              </label>
              <input
                type="number"
                name="currentEbayPrice"
                value={formData.currentEbayPrice}
                onChange={handleChange}
                placeholder={t('productFormPage.pricePlaceholder')}
                step="0.01"
                className="input-base"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('productFormPage.adRate')}
            </label>
            <input
              type="number"
              name="adRate"
              value={formData.adRate}
              onChange={handleChange}
              placeholder={t('productFormPage.adRatePlaceholder')}
              step="0.01"
              min="0"
              className="input-base"
              disabled={loading}
            />
            <p className="text-xs text-slate-500 mt-1">
              {t('productFormPage.adRateHint')}
            </p>
          </div>

          {/* Profit Preview */}
          {(formData.currentAmazonPrice || formData.currentEbayPrice) && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-slate-600">{t('productFormPage.estimatedProfit')}</p>
              <p className={`text-2xl font-bold ${ calculatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculatedProfit)}
              </p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('productFormPage.emailForNotifications')}
            </label>
            <input
              type="email"
              name="userEmail"
              value={formData.userEmail}
              onChange={handleChange}
              placeholder={t('productFormPage.emailPlaceholder')}
              className="input-base"
              disabled={loading}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {t('productFormPage.emailHint')}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary py-3"
            >
              {loading
                ? isEditMode
                  ? t('productFormPage.updating')
                  : t('productFormPage.adding')
                : isEditMode
                  ? t('productFormPage.updateButton')
                  : t('productFormPage.addButton')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-3"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
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
