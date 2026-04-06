import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  EllipsisVertical,
  Pencil,
  RefreshCw,
  Trash2,
  Store,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { formatCurrency, calculateProfit, getProfitColor } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

export default function ProductCard({ product, onEdit, onDelete, onCompare }) {
  const { isDark } = useTheme();
  const profit = calculateProfit(product.currentEbayPrice, product.currentAmazonPrice);
  const profitColor = getProfitColor(profit);
  const images = (product.productImages && product.productImages.length > 0)
    ? product.productImages
    : product.productImage
      ? [product.productImage]
      : [];
  const [imageIndex, setImageIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setImageIndex(0);
  }, [product.id]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="glass-card overflow-hidden transition hover:shadow-md relative">
      <div className="absolute right-3 top-3 z-10" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className={`h-8 w-8 rounded-lg border flex items-center justify-center ${
            isDark
              ? 'border-slate-700 bg-slate-900/95 text-slate-200 hover:bg-slate-800'
              : 'border-slate-300 bg-white/95 hover:bg-white'
          }`}
        >
          <EllipsisVertical size={16} />
        </button>
        {menuOpen && (
          <div
            className={`absolute right-0 mt-2 w-40 rounded-lg border shadow-lg z-10 py-1 ${
              isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                onCompare(product.id);
                setMenuOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
              }`}
            >
              <RefreshCw size={14} />
              Compare
            </button>
            <button
              type="button"
              onClick={() => {
                onEdit(product.id);
                setMenuOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
              }`}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(product.id);
                setMenuOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left text-red-600 flex items-center gap-2 ${
                isDark ? 'hover:bg-red-950/40' : 'hover:bg-red-50'
              }`}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className={`h-28 relative select-none ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <img
            src={images[imageIndex]}
            alt={product.productName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                }
                className={`absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border flex items-center justify-center ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'bg-white/90 border-slate-200 hover:bg-white'
                }`}
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                }
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border flex items-center justify-center ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'bg-white/90 border-slate-200 hover:bg-white'
                }`}
              >
                <ArrowRight size={14} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                {images.slice(0, 6).map((_, idx) => (
                  <button
                    key={`${product.id}-dot-${idx}`}
                    type="button"
                    onClick={() => setImageIndex(idx)}
                    className={`h-1.5 rounded-full transition ${
                      idx === imageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className={`font-medium mb-2 line-clamp-2 min-h-[40px] text-[15px] ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          {product.productName}
        </h3>

        {/* Price summary row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <Store size={12} />
                Amazon
              </span>
              <DollarSign size={12} className="text-slate-400" />
            </div>
            <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {formatCurrency(product.currentAmazonPrice)}
            </p>
          </div>
          <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <ShoppingCart size={12} />
                eBay
              </span>
              <DollarSign size={12} className="text-slate-400" />
            </div>
            <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {formatCurrency(product.currentEbayPrice)}
            </p>
          </div>
        </div>

        {/* Profit pill */}
        <div
          className={`mb-3 rounded-lg border ${
            profit >= 0
              ? isDark
                ? 'border-emerald-900/50 bg-emerald-950/40'
                : 'border-emerald-200 bg-emerald-50'
              : isDark
              ? 'border-rose-900/50 bg-rose-950/40'
              : 'border-rose-200 bg-rose-50'
          } p-2 flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            {profit >= 0 ? (
              <TrendingUp size={16} className="text-emerald-600" />
            ) : (
              <TrendingDown size={16} className="text-rose-600" />
            )}
            <span className={`text-[11px] uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Profit</span>
          </div>
          <span
            className={`text-sm font-bold ${
              profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(profit)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCompare(product.id)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight size={14} />
            Open
          </button>

        </div>
      </div>
    </div>
  );
}
