import React from 'react';

export default function Alert({ type = 'info', message, onClose, autoClose = true }) {
  React.useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  const bgColor = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }[type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[type];

  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${bgColor}`}>
      <span className="text-xl font-bold">{icon}</span>
      <div className="flex-1">
        <p>{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-xl font-bold hover:opacity-70"
      >
        ✕
      </button>
    </div>
  );
}
