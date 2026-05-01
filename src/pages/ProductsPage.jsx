import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { productAPI, settingsAPI } from '../services/api';
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
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [limits, setLimits] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchLimits();
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
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {products.map((product) => (
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

