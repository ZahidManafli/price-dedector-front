import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { productAPI } from '../services/api';
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

  useEffect(() => {
    fetchProducts();
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

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await productAPI.delete(productId);
      setProducts(products.filter((p) => p.id !== productId));
      setAlert({ type: 'success', message: 'Product deleted successfully' });
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

  return (
    <div className="page-shell">
      {isFormOpen && (
        <ProductFormModal
          productId={editingProductId}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProductId(null);
          }}
          onSuccess={fetchProducts}
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
            setEditingProductId(null);
            setIsFormOpen(true);
          }}
          className="w-full md:w-auto btn-primary flex items-center justify-center gap-1.5"
        >
          <Plus size={14} />
          Add Product
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="glass-card text-center py-10">
          <p className="text-xl text-slate-500 mb-3">No products yet</p>
          <button
            onClick={() => {
              setEditingProductId(null);
              setIsFormOpen(true);
            }}
            className="btn-primary"
          >
            Add your first product
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
