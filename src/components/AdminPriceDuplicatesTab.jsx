/**
 * components/AdminPriceDuplicatesTab.jsx
 *
 * Drop this into your AdminPanelPage as:
 *   {!loading && activeTab === 'price-duplicates' && <AdminPriceDuplicatesTab />}
 *
 * Diagnostics: lists users whose products share an identical current_ebay_price
 * across multiple listings (different ASIN/cost collapsing onto one price is the
 * signature of the margin/sync data-corruption bug). This is a triage list, not a
 * hard verdict — some users legitimately price several products the same.
 * Clicking a user opens all of their products so the admin can inspect the
 * affected ones directly.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, Loader2, Mail, Phone, RefreshCw, Wrench, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { adminAPI } from '../services/api';

function formatPrice(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `$${Number(v).toFixed(2)}`;
}

function formatDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('az-AZ');
  } catch {
    return v;
  }
}

function ebayListingUrl(product) {
  if (product.ebayLink) return product.ebayLink;
  if (product.ebayItemId) return `https://www.ebay.com/itm/${product.ebayItemId}`;
  return null;
}

const PLATFORM_LABELS = {
  init: 'Yaradılma',
  manual_update: 'Əl ilə dəyişdirilib',
  compare: 'Müqayisə / Cron',
  cron: 'Cron',
  ebay_listing_edit: 'eBay elanından',
  data_repair: 'Data bərpası',
};

function formatPlatform(platform) {
  return PLATFORM_LABELS[platform] || platform || '—';
}

export default function AdminPriceDuplicatesTab() {
  const { isDark } = useTheme();

  const [minCount, setMinCount] = useState(3);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [healing, setHealing] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null); // { userId, name, ... } | null
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const [historyProduct, setHistoryProduct] = useState(null); // product row | null
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const card = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';

  const loadUsers = useCallback(async (count) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.listPriceDuplicateUsers(count);
      setUsers(res?.data?.users || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(minCount); }, [loadUsers, minCount]);

  const handleHealAll = async () => {
    const confirmResult = await Swal.fire({
      title: 'Bütün uyğunsuzluqlar düzəldilsin?',
      html: 'Bu, current eBay qiyməti öz son <b>price_history</b> dəyərindən fərqlənən BÜTÜN istifadəçilərin məhsullarını tapıb, öz son history dəyərinə qaytaracaq (yalnız son 3 dəqiqə ərzində dəyişməyənlər toxunulacaq).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Bəli, düzəlt',
      cancelButtonText: 'Ləğv et',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmResult.isConfirmed) return;

    setHealing(true);
    try {
      const res = await adminAPI.healPriceDuplicates();
      const { checked = 0, healed = 0, errors = [] } = res?.data || {};
      await Swal.fire({
        title: 'Tamamlandı',
        html: `${checked} məhsul yoxlanıldı, <b>${healed}</b> məhsulun qiyməti son history dəyərinə bərpa olundu.${errors.length ? `<br/><span style="color:#dc2626">${errors.length} xəta baş verdi.</span>` : ''}`,
        icon: healed > 0 ? 'success' : 'info',
      });
      await loadUsers(minCount);
    } catch (e) {
      Swal.fire('Xəta', e?.response?.data?.error || e.message, 'error');
    } finally {
      setHealing(false);
    }
  };

  const openUser = async (user) => {
    setSelectedUser(user);
    setProducts([]);
    setProductsError(null);
    setProductsLoading(true);
    try {
      const res = await adminAPI.getUserPriceDuplicateProducts(user.userId);
      setProducts(res?.data?.products || []);
    } catch (e) {
      setProductsError(e?.response?.data?.error || e.message);
    } finally {
      setProductsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setProducts([]);
    setProductsError(null);
  };

  const openHistory = async (product) => {
    setHistoryProduct(product);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await adminAPI.getProductPriceHistory(product.id);
      setHistoryRows(res?.data?.history || []);
    } catch (e) {
      setHistoryError(e?.response?.data?.error || e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryProduct(null);
    setHistoryRows([]);
    setHistoryError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <AlertTriangle size={18} className="text-amber-500" />
            Eyni eBay qiyməti diaqnostikası
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Hansı istifadəçilərin productlarında eyni current eBay qiyməti təkrarlanır — bu, qiymət korrupsiyası bugunun əlamətidir, amma legitim üst-üstə düşmə də ola bilər.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Minimum təkrar sayı
          </label>
          <select
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
            className={`rounded-lg border px-2 py-1.5 text-sm ${
              isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {[2, 3, 4, 5, 10].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
          <button
            onClick={() => loadUsers(minCount)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <RefreshCw size={14} /> Yenilə
          </button>
          <button
            onClick={handleHealAll}
            disabled={healing}
            title="current_ebay_price öz son price_history dəyərindən fərqlənən bütün məhsulları bərpa et"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {healing ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {healing ? 'Düzəldilir…' : 'Uyğunsuzluqları düzəlt'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : users.length === 0 ? (
        <div className={`rounded-xl border p-8 text-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Seçilmiş həddə uyğun heç bir təkrarlanan qiymət tapılmadı.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const maxGroup = user.groups.reduce((max, g) => (g.count > max.count ? g : max), user.groups[0]);
            return (
              <button
                key={user.userId}
                onClick={() => openUser(user)}
                className={`w-full text-left rounded-xl border p-4 transition hover:shadow-md ${
                  isDark ? 'bg-slate-900 border-slate-700 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {user.name || 'Adsız istifadəçi'}
                    </div>
                    <div className={`flex items-center gap-3 mt-1 text-xs flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className="inline-flex items-center gap-1"><Mail size={12} /> {user.email || '—'}</span>
                      {user.phoneNumber && (
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {user.phoneNumber}</span>
                      )}
                      <span>{user.totalProducts} məhsul</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {user.groups.map((g) => (
                      <span
                        key={g.price}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          g.price === maxGroup.price
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {formatPrice(g.price)} × {g.count}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh] ${card}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">{selectedUser.name || 'Adsız istifadəçi'}</h3>
                <div className={`flex items-center gap-3 mt-1 text-xs flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>{selectedUser.email || '—'}</span>
                  {selectedUser.phoneNumber && <span>{selectedUser.phoneNumber}</span>}
                </div>
              </div>
              <button onClick={closeModal} className="p-1 rounded hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            {productsError && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {productsError}
              </div>
            )}

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <th className="py-2 pr-3">Məhsul</th>
                      <th className="py-2 pr-3">ASIN</th>
                      <th className="py-2 pr-3">eBay Item ID</th>
                      <th className="py-2 pr-3">Amazon</th>
                      <th className="py-2 pr-3">eBay</th>
                      <th className="py-2 pr-3">Profit</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Son sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const listingUrl = ebayListingUrl(p);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => openHistory(p)}
                          title="Qiymət tarixçəsinə bax"
                          className={`border-t cursor-pointer transition ${isDark ? 'border-slate-800 hover:bg-slate-800/60' : 'border-slate-100 hover:bg-slate-50'} ${
                            p.isDuplicatePrice ? (isDark ? 'bg-red-950/20' : 'bg-red-50') : ''
                          }`}
                        >
                          <td className="py-2 pr-3 max-w-[220px] truncate" title={p.productName}>{p.productName}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{p.amazonAsin || '—'}</td>
                          <td className="py-2 pr-3 font-mono text-xs">
                            {p.ebayItemId ? (
                              listingUrl ? (
                                <a
                                  href={listingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  title="eBay elanını aç"
                                >
                                  {p.ebayItemId}
                                </a>
                              ) : (
                                p.ebayItemId
                              )
                            ) : '—'}
                          </td>
                          <td className="py-2 pr-3">{formatPrice(p.currentAmazonPrice)}</td>
                          <td className="py-2 pr-3 font-semibold">
                            {formatPrice(p.currentEbayPrice)}
                            {p.isDuplicatePrice && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                ×{p.duplicateGroupSize}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{formatPrice(p.profit)}</td>
                          <td className="py-2 pr-3 text-xs">
                            {p.pricingMode === 'margin' ? `Marja ${p.targetMarginPercent ?? ''}%` : 'Fixed'}
                          </td>
                          <td className="py-2 pr-3 text-xs">{formatDate(p.ebayLastSyncAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {historyProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh] ${card}`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate" title={historyProduct.productName}>
                  {historyProduct.productName}
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Qiymət tarixçəsi</p>
              </div>
              <button onClick={closeHistory} className="p-1 rounded hover:opacity-70 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            {historyError && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {historyError}
              </div>
            )}

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : historyRows.length === 0 ? (
              <div className={`rounded-xl border p-8 text-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bu məhsul üçün tarixçə tapılmadı.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <th className="py-2 pr-3">Tarix</th>
                      <th className="py-2 pr-3">Mənbə</th>
                      <th className="py-2 pr-3">Əvvəlki → Yeni</th>
                      <th className="py-2 pr-3">Amazon</th>
                      <th className="py-2 pr-3">eBay</th>
                      <th className="py-2 pr-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h) => (
                      <tr key={h.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className="py-2 pr-3 text-xs whitespace-nowrap">{formatDate(h.createdAt)}</td>
                        <td className="py-2 pr-3 text-xs whitespace-nowrap">{formatPlatform(h.platform)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatPrice(h.previousPrice)} → <span className="font-semibold">{formatPrice(h.newPrice)}</span>
                        </td>
                        <td className="py-2 pr-3">{formatPrice(h.amazonPrice)}</td>
                        <td className="py-2 pr-3">{formatPrice(h.ebayPrice)}</td>
                        <td className="py-2 pr-3">{formatPrice(h.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
