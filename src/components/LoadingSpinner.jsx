import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LoadingSpinner({ message }) {
  const { t } = useTranslation();
  const displayMessage = message || t('loading.data');

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center p-10 gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <p className="text-sm text-slate-500 dark:text-slate-300">{displayMessage}</p>
    </div>
  );
}
