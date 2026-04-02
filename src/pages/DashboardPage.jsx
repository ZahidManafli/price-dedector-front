import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { productAPI, settingsAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { ProductFormModal } from './ProductFormPage';

export default function DashboardPage() {
  const navigate = useNavigate();
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
      setAlert({ type: 'error', message: 'Failed to load products' });
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLimits = async () => {
    try {
      const response = await settingsAPI.getLimits();
      setLimits(response.data || null);
    } catch (error) {
      console.warn('Failed to fetch user limits:', error);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await productAPI.delete(productId);
      setProducts(products.filter((p) => p.id !== productId));
      setAlert({ type: 'success', message: 'Product deleted successfully' });
      fetchLimits();
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to delete product' });
    }
  };

  const handleEdit = (productId) => {
    setEditingProductId(productId);
    setIsFormOpen(true);
  };

  const handleCompare = (productId) => {
    navigate(`/product/${productId}`);
  };

  const productsRemaining = limits?.products?.remaining;
  const isProductQuotaReached = productsRemaining !== null && productsRemaining !== undefined && productsRemaining <= 0;

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
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Track products, monitor margin, and react faster.</p>
        </div>
        <button
          onClick={() => {
            if (isProductQuotaReached) {
              setAlert({
                type: 'warning',
                message: 'Product quota reached. Delete one product or ask admin to increase your limit.',
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
          Add Product
          {productsRemaining === null || productsRemaining === undefined ? (
            <span className="ml-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full">Unlimited</span>
          ) : (
            <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
              isProductQuotaReached ? 'bg-red-500/80' : 'bg-white/20'
            }`}>
              {productsRemaining} left
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="glass-card text-center py-10">
          <p className="text-xl text-slate-500 mb-3">No products yet</p>
          <button
            onClick={() => {
              if (isProductQuotaReached) {
                setAlert({
                  type: 'warning',
                  message: 'Product quota reached. Delete one product or ask admin to increase your limit.',
                });
                return;
              }
              setEditingProductId(null);
              setIsFormOpen(true);
            }}
            disabled={isProductQuotaReached}
            className="btn-primary disabled:cursor-not-allowed"
          >
            {isProductQuotaReached ? 'Product quota reached' : 'Add your first product'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCompare={handleCompare}
            />
          ))}
        </div>
      )}
    </div>
  );
}
