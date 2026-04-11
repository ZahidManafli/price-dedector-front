import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { buildAmazonProductUrl, extractAmazonAsin, formatCurrency, formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';
import { Loader2 } from 'lucide-react';

export default function ProductDetailPage() {
  const { isDark } = useTheme();
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(false);
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
    if (compareLoading) return;
    try {
      setCompareLoading(true);
      await productAPI.comparePrice(productId);
      setAlert({
        type: 'success',
        message: 'Price comparison triggered. Check your email for updates!',
      });
      // Refresh product data
      await fetchProductDetails();
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to compare prices' });
    } finally {
      setCompareLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!product) {
    return (
      <div className="page-shell text-center">
        <p className="text-xl text-slate-600">Product not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
  const amazonAsin = product.amazonAsin || extractAmazonAsin(product.amazonLink || '');
  const amazonUrl = buildAmazonProductUrl(amazonAsin) || product.amazonLink;
  const ebayItemId = String(product.ebayItemId || '').trim();
  const ebayUrl = ebayItemId ? `https://www.ebay.com/itm/${ebayItemId}` : product.ebayLink;

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:underline mb-6 text-sm"
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

        <div className={`glass-card overflow-hidden ${isDark ? 'bg-slate-950 border-slate-800' : ''}`}>
          {/* Header */}
          <div className={`p-4 md:p-5 bg-gradient-to-r ${isDark ? 'from-slate-800 to-blue-900' : 'from-slate-900 to-blue-900'} text-white`}>
            <h1 className="text-2xl font-semibold mb-3 tracking-tight">{product.productName}</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-blue-100 text-sm">Amazon Price</p>
                <p className="text-xl font-bold">{formatCurrency(product.currentAmazonPrice)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">eBay Price</p>
                <p className="text-xl font-bold">{formatCurrency(product.currentEbayPrice)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Profit</p>
                <p className="text-xl font-bold">{formatCurrency(product.profit)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Last Updated</p>
                <p className="text-xs mt-2">{formatDate(product.lastUpdated)}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-5 space-y-5">
            {/* Links */}
            <div>
              <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Product Links</h2>
              <div className="space-y-2">
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  🔗 Amazon {amazonAsin ? `(${amazonAsin})` : 'Link'}
                </a>
                <a
                  href={ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  🔗 eBay {ebayItemId ? `(${ebayItemId})` : 'Link'}
                </a>
              </div>
            </div>

            {/* Price History */}
            {history.length > 0 && (
              <div>
                <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Price History</h2>
                <div className={`overflow-x-auto border rounded-lg ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <table className="w-full text-sm">
                    <thead className={isDark ? 'bg-slate-800/90' : 'bg-slate-100'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Date</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Amazon</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>eBay</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Profit</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record, idx) => (
                        <tr
                          key={idx}
                          className={`border-t ${
                            isDark
                              ? 'border-slate-700 hover:bg-slate-900/60 text-slate-100'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-900'
                          }`}
                        >
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
            <div className={`pt-4 border-t flex flex-wrap gap-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                onClick={handleCompare}
                disabled={compareLoading}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {compareLoading && <Loader2 size={16} className="animate-spin" />}
                {compareLoading ? 'Comparing...' : 'Compare Prices Now'}
              </button>
              <button
                onClick={() => navigate(`/edit-product/${productId}`)}
                className="btn-primary"
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
