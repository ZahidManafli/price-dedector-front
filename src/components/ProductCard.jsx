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

export default function ProductCard({ product, onEdit, onDelete, onCompare }) {
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
          className="h-8 w-8 rounded-lg border border-slate-300 bg-white/95 hover:bg-white flex items-center justify-center"
        >
          <EllipsisVertical size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-10 py-1">
            <button
              type="button"
              onClick={() => {
                onCompare(product.id);
                setMenuOpen(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
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
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
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
              className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="h-28 bg-slate-100 relative select-none">
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
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center hover:bg-white"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center hover:bg-white"
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
        <h3 className="font-medium text-slate-900 mb-2 line-clamp-2 min-h-[40px] text-[15px]">
          {product.productName}
        </h3>

        {/* Price summary row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <Store size={12} />
                Amazon
              </span>
              <DollarSign size={12} className="text-slate-400" />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(product.currentAmazonPrice)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <ShoppingCart size={12} />
                eBay
              </span>
              <DollarSign size={12} className="text-slate-400" />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(product.currentEbayPrice)}
            </p>
          </div>
        </div>

        {/* Profit pill */}
        <div
          className={`mb-3 rounded-lg border ${
            profit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
          } p-2 flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            {profit >= 0 ? (
              <TrendingUp size={16} className="text-emerald-600" />
            ) : (
              <TrendingDown size={16} className="text-rose-600" />
            )}
            <span className="text-[11px] uppercase tracking-wider text-slate-600">Profit</span>
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
