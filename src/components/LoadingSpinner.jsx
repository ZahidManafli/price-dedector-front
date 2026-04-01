import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-10">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    </div>
  );
}
