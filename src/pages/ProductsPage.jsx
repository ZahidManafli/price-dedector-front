import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ebayAPI, productAPI, settingsAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { ProductFormModal } from './ProductFormPage';
import { useTranslation } from 'react-i18next';

export default function ProductsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [limits, setLimits] = useState(null);
  const [ebayFilter, setEbayFilter] = useState('ALL');

  useEffect(() => {
    fetchProducts();
    fetchLimits();
    fetchEbayAccounts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll();
      setProducts(response.data || []);
    } catch (error) {
      setAlert({ type: 'error', message: t('productsPage.failedLoad') });
    } finally {
      setLoading(false);
    }
  };

  const fetchLimits = async () => {
    try {
      const response = await settingsAPI.getLimits();
      setLimits(response.data || null);
    } catch {
      setLimits(null);
    }
  };

  const fetchEbayAccounts = async () => {
    try {
      const response = await ebayAPI.getStatus();
      const accounts = Array.isArray(response?.data?.ebayAccounts) ? response.data.ebayAccounts : [];
      setEbayAccounts(accounts);
    } catch {
      setEbayAccounts([]);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm(t('productsPage.deleteConfirm'))) return;
    try {
      await productAPI.delete(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setAlert({ type: 'success', message: t('productsPage.deleted') });
      fetchLimits();
    } catch {
      setAlert({ type: 'error', message: t('productsPage.failedDelete') });
    }
  };

  const productsRemaining = limits?.products?.remaining;
  const isProductQuotaReached =
    productsRemaining !== null &&
    productsRemaining !== undefined &&
    productsRemaining <= 0;

  const filteredProducts = useMemo(() => {
    const matchesAccount = (product, account) => {
      const productAccountIds = [
        product?.ebayAccountId,
        product?.ebayAccountInternalId,
        product?.ebayTradingAccountId,
        product?.ebayProfileUserId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim());

      const accountIds = [
        account?.id,
        account?.accountId,
        account?.tradingAccountId,
        account?.profileUserId,
        account?.username,
        account?.connectionName,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim());

      return accountIds.some((accountId) => productAccountIds.includes(accountId));
    };

    return products.filter((product) => {
      if (ebayFilter === 'ALL') return true;

      const selectedAccount = ebayAccounts.find((account) => {
        const accountKeys = [account?.id, account?.accountId, account?.tradingAccountId, account?.profileUserId, account?.username]
          .filter(Boolean)
          .map((value) => String(value).trim());

        return accountKeys.includes(ebayFilter);
      });
      if (!selectedAccount) return true;

      return matchesAccount(product, selectedAccount);
    });
  }, [products, ebayAccounts, ebayFilter]);

  const accountFilterOptions = useMemo(
    () =>
      ebayAccounts
        .map((account) => ({
          id: String(account.id || account.accountId || account.tradingAccountId || account.profileUserId || account.username || '').trim(),
          label: account.connectionName || account.username || account.profileUserId || t('productsPage.unknownAccount'),
        }))
        .filter((option) => option.id),
    [ebayAccounts, t]
  );

  return (
    <div className="page-shell">
      {isFormOpen && (
        <ProductFormModal
          productId={editingProductId}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProductId(null);
          }}
          onSuccess={() => {
            fetchProducts();
            fetchLimits();
          }}
        />
      )}

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h1 className="page-title">{t('productsPage.title')}</h1>
          <p className="page-subtitle">{t('productsPage.subtitle')}</p>
        </div>
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
          <button
            onClick={() => navigate('/market-analysis')}
            className="w-full md:w-auto btn-secondary"
          >
            {t('productsPage.openAnalysis')}
          </button>
          <button
            data-tour="products-add-button"
            onClick={() => {
              if (isProductQuotaReached) {
                setAlert({
                  type: 'warning',
                  message: t('productsPage.quotaReached'),
                });
                return;
              }
              setEditingProductId(null);
              setIsFormOpen(true);
            }}
            disabled={isProductQuotaReached}
            className="w-full md:w-auto btn-primary flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {t('productsPage.addProduct')}
            {productsRemaining === null || productsRemaining === undefined ? (
              <span className="ml-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{t('productsPage.unlimited')}</span>
            ) : (
              <span
                className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                  isProductQuotaReached ? 'bg-red-500/80' : 'bg-white/20'
                }`}
              >
                {productsRemaining} {t('productsPage.left')}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="glass-card mb-5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('productsPage.filterByEbayAccount')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('productsPage.filterByEbayAccountDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEbayFilter('ALL')}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              ebayFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white/70 text-slate-700 border-slate-300 hover:bg-white dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {t('productsPage.allConnectedAccounts')}
          </button>
          {accountFilterOptions.map((option) => {
            const active = ebayFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setEbayFilter(option.id)}
                className={`rounded-full px-3 py-1.5 text-sm border transition ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white/70 text-slate-700 border-slate-300 hover:bg-white dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="glass-card text-center py-10">
          <p className="text-xl text-slate-500 dark:text-slate-300 mb-3">{t('productsPage.noProductsYet')}</p>
          <button
            onClick={() => {
              if (isProductQuotaReached) {
                setAlert({
                  type: 'warning',
                  message: t('productsPage.quotaReached'),
                });
                return;
              }
              setEditingProductId(null);
              setIsFormOpen(true);
            }}
            disabled={isProductQuotaReached}
            className="btn-primary disabled:cursor-not-allowed"
          >
            {isProductQuotaReached ? t('productsPage.quotaReachedLabel') : t('productsPage.addFirstProduct')}
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card text-center py-10">
          <p className="text-xl text-slate-500 dark:text-slate-300 mb-3">{t('productsPage.noProductsMatchFilter')}</p>
          <button type="button" onClick={() => setEbayFilter('ALL')} className="btn-secondary">
            {t('productsPage.showAllProducts')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={(id) => {
                setEditingProductId(id);
                setIsFormOpen(true);
              }}
              onDelete={handleDelete}
              onCompare={(id) => navigate(`/product/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

