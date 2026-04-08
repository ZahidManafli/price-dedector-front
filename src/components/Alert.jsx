import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Alert({
  type = 'info',
  message,
  onClose,
  autoClose = true,
  actionLabel,
  onAction,
}) {
  const { isDark } = useTheme();

  React.useEffect(() => {
    if (autoClose && typeof onClose === 'function') {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoClose, onClose]);

  const bgColor = isDark
    ? {
        success: 'bg-green-900/30 border-green-800 text-green-200',
        error: 'bg-red-900/30 border-red-800 text-red-200',
        info: 'bg-blue-900/30 border-blue-800 text-blue-200',
        warning: 'bg-yellow-900/30 border-yellow-800 text-yellow-200',
      }[type]
    : {
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
    <div
      role="alert"
      aria-live="polite"
      className={`border rounded-xl p-4 flex items-start gap-3 shadow-sm ${bgColor}`}
    >
      <span className="text-base font-bold mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-sm md:text-base">{message}</p>
        {actionLabel && typeof onAction === 'function' && (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 text-sm underline underline-offset-2 hover:opacity-80"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {typeof onClose === 'function' && (
        <button
          type="button"
          aria-label="Close alert"
          onClick={onClose}
          className="text-lg font-bold hover:opacity-70"
        >
          ✕
        </button>
      )}
    </div>
  );
}
