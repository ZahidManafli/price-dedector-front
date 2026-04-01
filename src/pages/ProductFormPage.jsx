import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productAPI } from '../services/api';
import { calculateProfit, formatCurrency } from '../utils/helpers';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';

export function ProductFormModal({ productId = null, onClose, onSuccess }) {
  const isEditMode = Boolean(productId);
  const [formData, setFormData] = useState({
    productName: '',
    amazonLink: '',
    ebayLink: '',
    currentAmazonPrice: '',
    currentEbayPrice: '',
    userEmail: '',
    amazonSubscribed: false,
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [alert, setAlert] = useState(null);
  const [calculatedProfit, setCalculatedProfit] = useState(0);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchProduct = async () => {
      try {
        setInitialLoading(true);
        const response = await productAPI.getById(productId);
        const product = response.data;

        const nextData = {
          productName: product.productName || '',
          amazonLink: product.amazonLink || '',
          ebayLink: product.ebayLink || '',
          currentAmazonPrice: product.currentAmazonPrice ?? '',
          currentEbayPrice: product.currentEbayPrice ?? '',
          userEmail: product.userEmail || '',
          amazonSubscribed: product.amazonSubscribed || false,
        };

        setFormData(nextData);
        setCalculatedProfit(
          calculateProfit(nextData.currentEbayPrice, nextData.currentAmazonPrice)
        );
      } catch (error) {
        setAlert({ type: 'error', message: 'Failed to load product for editing' });
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProduct();
  }, [isEditMode, productId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));

    // Recalculate profit
    if (name === 'currentAmazonPrice' || name === 'currentEbayPrice' || name === 'amazonSubscribed') {
      const ebayPrice =
        name === 'currentEbayPrice' ? nextValue : formData.currentEbayPrice;
      const amazonRaw =
        name === 'currentAmazonPrice' ? nextValue : formData.currentAmazonPrice;
      const isSubscribed =
        name === 'amazonSubscribed' ? nextValue : formData.amazonSubscribed;
      const discountRate = 0.05; // keep in sync with backend default
      const effectiveAmazon = isSubscribed
        ? (parseFloat(amazonRaw) || 0) * (1 - discountRate)
        : amazonRaw;
      setCalculatedProfit(calculateProfit(ebayPrice, effectiveAmazon));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    // Validation
    if (!formData.productName || !formData.amazonLink || !formData.ebayLink) {
      setAlert({ type: 'error', message: 'Please fill all required fields' });
      return;
    }

    if (!formData.currentAmazonPrice || !formData.currentEbayPrice) {
      setAlert({ type: 'error', message: 'Please enter both prices' });
      return;
    }

    if (!formData.userEmail) {
      setAlert({ type: 'error', message: 'Please enter your email for notifications' });
      return;
    }

    try {
      setLoading(true);

      const formDataObj = new FormData();
      formDataObj.append('productName', formData.productName);
      formDataObj.append('amazonLink', formData.amazonLink);
      formDataObj.append('ebayLink', formData.ebayLink);
      formDataObj.append('currentAmazonPrice', formData.currentAmazonPrice);
      formDataObj.append('currentEbayPrice', formData.currentEbayPrice);
      formDataObj.append('userEmail', formData.userEmail);
      formDataObj.append('amazonSubscribed', String(formData.amazonSubscribed));

      if (isEditMode) {
        await productAPI.update(productId, formDataObj);
      } else {
        await productAPI.create(formDataObj);
      }

      setAlert({
        type: 'success',
        message: isEditMode ? 'Product updated successfully!' : 'Product added successfully!',
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
          (isEditMode ? 'Failed to update product' : 'Failed to add product'),
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
            {isEditMode ? 'Edit Product' : 'Add New Product'}
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
              Product Name *
            </label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder="e.g., iPhone 15 Pro"
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* Amazon Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amazon Product Link *
            </label>
            <input
              type="url"
              name="amazonLink"
              value={formData.amazonLink}
              onChange={handleChange}
              placeholder="https://amazon.com/..."
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* eBay Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              eBay Product Link *
            </label>
            <input
              type="url"
              name="ebayLink"
              value={formData.ebayLink}
              onChange={handleChange}
              placeholder="https://ebay.com/..."
              className="input-base"
              disabled={loading}
              required
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Amazon Price *
              </label>
              <input
                type="number"
                name="currentAmazonPrice"
                value={formData.currentAmazonPrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="input-base"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                eBay Price *
              </label>
              <input
                type="number"
                name="currentEbayPrice"
                value={formData.currentEbayPrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="input-base"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Amazon Subscribe & Save */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            <input
              type="checkbox"
              id="amazonSubscribed"
              name="amazonSubscribed"
              checked={formData.amazonSubscribed}
              onChange={handleChange}
              disabled={loading}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="amazonSubscribed" className="text-sm text-gray-700">
              I have Amazon Subscribe &amp; Save for this product (use discounted price)
            </label>
          </div>

          {/* Profit Preview */}
          {(formData.currentAmazonPrice || formData.currentEbayPrice) && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-slate-600">Estimated Profit</p>
              <p className={`text-2xl font-bold ${ calculatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculatedProfit)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Formula: SP - (PC + (SP×0.129) + (SP×0.029+0.30)) + 1.45
              </p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email for Notifications *
            </label>
            <input
              type="email"
              name="userEmail"
              value={formData.userEmail}
              onChange={handleChange}
              placeholder="your.email@example.com"
              className="input-base"
              disabled={loading}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              You'll receive alerts when prices change
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
                  ? 'Updating Product...'
                  : 'Adding Product...'
                : isEditMode
                  ? 'Update Product'
                  : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-3"
              disabled={loading}
            >
              Cancel
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
