import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { buildAmazonProductUrl, extractAmazonAsin, formatCurrency, formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function ProductDetailPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
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
      setAlert({ type: 'error', message: t('productDetailPage.failedLoad') });
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
        message: t('productDetailPage.compareTriggered'),
      });
      // Refresh product data
      await fetchProductDetails();
    } catch (error) {
      setAlert({ type: 'error', message: t('productDetailPage.failedCompare') });
    } finally {
      setCompareLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!product) {
    return (
      <div className="page-shell text-center">
        <p className="text-xl text-slate-600">{t('productDetailPage.notFound')}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 btn-primary"
        >
          {t('productDetailPage.backToDashboard')}
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
          ← {t('productDetailPage.backToDashboard')}
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
                <p className="text-blue-100 text-sm">{t('productDetailPage.amazonPrice')}</p>
                <p className="text-xl font-bold">{formatCurrency(product.currentAmazonPrice)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">{t('productDetailPage.ebayPrice')}</p>
                <p className="text-xl font-bold">{formatCurrency(product.currentEbayPrice)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">{t('productDetailPage.profit')}</p>
                <p className="text-xl font-bold">{formatCurrency(product.profit)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">{t('productDetailPage.lastUpdated')}</p>
                <p className="text-xs mt-2">{formatDate(product.lastUpdated)}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-5 space-y-5">
            {/* Links */}
            <div>
              <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('productDetailPage.productLinks')}</h2>
              <div className="space-y-2">
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  🔗 {t('productDetailPage.amazon')} {amazonAsin ? `(${amazonAsin})` : t('productDetailPage.link')}
                </a>
                <a
                  href={ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  🔗 {t('productDetailPage.ebay')} {ebayItemId ? `(${ebayItemId})` : t('productDetailPage.link')}
                </a>
              </div>
            </div>

            {/* Price History Chart */}
            {history.length > 1 && (
              <div>
                <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {t('productDetailPage.priceHistory')}
                </h2>
                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={[...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((r) => ({
                        date: new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        amazon: Number(r.amazonPrice || 0),
                        ebay: Number(r.ebayPrice || 0),
                      }))}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                        axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v}`}
                        width={52}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e293b' : '#fff',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: isDark ? '#f1f5f9' : '#1e293b',
                        }}
                        formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name === 'amazon' ? 'Amazon' : 'eBay']}
                      />
                      <Legend
                        formatter={(v) => v === 'amazon' ? 'Amazon' : 'eBay'}
                        wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="amazon"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f97316' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ebay"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Price History Table */}
            {history.length > 0 && (
              <div>
                <div className={`overflow-x-auto border rounded-lg ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <table className="w-full text-sm">
                    <thead className={isDark ? 'bg-slate-800/90' : 'bg-slate-100'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('productDetailPage.date')}</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('productDetailPage.amazon')}</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('productDetailPage.ebay')}</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('productDetailPage.profit')}</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('productDetailPage.difference')}</th>
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
                {compareLoading ? t('productDetailPage.comparing') : t('productDetailPage.compareNow')}
              </button>
              <button
                onClick={() => navigate(`/edit-product/${productId}`)}
                className="btn-primary"
              >
                {t('productDetailPage.editProduct')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
