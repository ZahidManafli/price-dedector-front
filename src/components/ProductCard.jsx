import React, { useState, useEffect } from 'react';
import { formatCurrency, calculateProfit, getProfitColor } from '../utils/helpers';

export default function ProductCard({ product, onEdit, onDelete, onCompare }) {
  const profit = calculateProfit(product.currentEbayPrice, product.currentAmazonPrice);
  const profitColor = getProfitColor(profit);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
          {product.productName}
        </h3>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div>
            <p className="text-gray-500">Amazon</p>
            <p className="font-semibold text-gray-800">
              {formatCurrency(product.currentAmazonPrice)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">eBay</p>
            <p className="font-semibold text-gray-800">
              {formatCurrency(product.currentEbayPrice)}
            </p>
          </div>
        </div>

        {/* Profit */}
        <div className={`text-center mb-4 p-2 bg-gray-50 rounded ${profitColor}`}>
          <p className="text-xs text-gray-500">Profit</p>
          <p className="text-lg font-bold">{formatCurrency(profit)}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onCompare(product.id)}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition text-sm"
          >
            Compare
          </button>
          <button
            onClick={() => onEdit(product.id)}
            className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
