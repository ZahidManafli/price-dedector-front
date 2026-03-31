import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const [productResponse, historyResponse] = await Promise.all([
        productAPI.getById(productId),
        productAPI.getPriceHistory(productId),
      ]);

      setProduct(productResponse.data);
      setHistory(historyResponse.data || []);
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to load product details' });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    try {
      const response = await productAPI.comparePrice(productId);
      setAlert({
        type: 'success',
        message: 'Price comparison triggered. Check your email for updates!',
      });
      // Refresh product data
      fetchProductDetails();
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to compare prices' });
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-xl text-gray-600">Product not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:underline mb-6"
        >
          ← Back to Dashboard
        </button>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="p-6 md:p-8 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <h1 className="text-3xl font-bold mb-4">{product.productName}</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-blue-200 text-sm">Amazon Price</p>
                <p className="text-2xl font-bold">{formatCurrency(product.currentAmazonPrice)}</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">eBay Price</p>
                <p className="text-2xl font-bold">{formatCurrency(product.currentEbayPrice)}</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Profit</p>
                <p className="text-2xl font-bold">{formatCurrency(product.profit)}</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Last Updated</p>
                <p className="text-sm mt-2">{formatDate(product.lastUpdated)}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Links */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Product Links</h2>
              <div className="space-y-2">
                <a
                  href={product.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  🔗 Amazon Link
                </a>
                <a
                  href={product.ebayLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  🔗 eBay Link
                </a>
              </div>
            </div>

            {/* Price History */}
            {history.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Price History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Amazon</th>
                        <th className="px-4 py-2 text-left">eBay</th>
                        <th className="px-4 py-2 text-left">Profit</th>
                        <th className="px-4 py-2 text-left">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">{formatDate(record.timestamp)}</td>
                          <td className="px-4 py-3">{formatCurrency(record.amazonPrice)}</td>
                          <td className="px-4 py-3">{formatCurrency(record.ebayPrice)}</td>
                          <td className="px-4 py-3 font-semibold">{formatCurrency(record.profit)}</td>
                          <td className={`px-4 py-3 font-semibold ${
                            record.priceDifference > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(record.priceDifference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-6 border-t flex gap-4">
              <button
                onClick={handleCompare}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
              >
                🔄 Compare Prices Now
              </button>
              <button
                onClick={() => navigate(`/edit-product/${productId}`)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Edit Product
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
