import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { calculateProfit, formatCurrency } from '../utils/helpers';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProductFormPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    productName: '',
    amazonLink: '',
    ebayLink: '',
    currentAmazonPrice: '',
    currentEbayPrice: '',
    userEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [calculatedProfit, setCalculatedProfit] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Recalculate profit
    if (name === 'currentAmazonPrice' || name === 'currentEbayPrice') {
      const ebayPrice = name === 'currentEbayPrice' ? value : formData.currentEbayPrice;
      const amazonPrice = name === 'currentAmazonPrice' ? value : formData.currentAmazonPrice;
      setCalculatedProfit(calculateProfit(ebayPrice, amazonPrice));
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

      await productAPI.create(formDataObj);
      setAlert({ type: 'success', message: 'Product added successfully!' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.message || 'Failed to add product' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Add New Product</h1>

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

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder="e.g., iPhone 15 Pro"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={loading}
              required
            />
          </div>

          {/* Amazon Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Amazon Product Link *
            </label>
            <input
              type="url"
              name="amazonLink"
              value={formData.amazonLink}
              onChange={handleChange}
              placeholder="https://amazon.com/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={loading}
              required
            />
          </div>

          {/* eBay Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              eBay Product Link *
            </label>
            <input
              type="url"
              name="ebayLink"
              value={formData.ebayLink}
              onChange={handleChange}
              placeholder="https://ebay.com/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={loading}
              required
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amazon Price *
              </label>
              <input
                type="number"
                name="currentAmazonPrice"
                value={formData.currentAmazonPrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                eBay Price *
              </label>
              <input
                type="number"
                name="currentEbayPrice"
                value={formData.currentEbayPrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Profit Preview */}
          {(formData.currentAmazonPrice || formData.currentEbayPrice) && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Estimated Profit</p>
              <p className={`text-3xl font-bold ${ calculatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculatedProfit)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Formula: SP - (PC + (SP×0.129) + (SP×0.029+0.30)) + 1.45
              </p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email for Notifications *
            </label>
            <input
              type="email"
              name="userEmail"
              value={formData.userEmail}
              onChange={handleChange}
              placeholder="your.email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              You'll receive alerts when prices change
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Adding Product...' : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
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
