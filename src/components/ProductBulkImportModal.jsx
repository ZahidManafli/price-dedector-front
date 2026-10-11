import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Download, Upload, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { productAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

function trimAccountValue(value) {
  return String(value || '').trim();
}

function getAccountKeys(account = {}) {
  return [account.id, account.accountId, account.tradingAccountId, account.profileUserId, account.username]
    .map(trimAccountValue)
    .filter(Boolean);
}

function getPreferredAccountValue(account = {}) {
  return trimAccountValue(
    account.id || account.accountId || account.tradingAccountId || account.profileUserId || account.username
  );
}

function findMatchingAccount(accounts = [], value) {
  const target = trimAccountValue(value);
  if (!target) return null;
  return accounts.find((account) => getAccountKeys(account).includes(target)) || null;
}

// Bulk-add products from an uploaded .xlsx spreadsheet instead of one at a
// time — see backend-for-server's productController.js (bulkImportProducts /
// downloadBulkImportTemplate) for the exact column-matching rules. Mirrors
// ProductFormPage.jsx's eBay-account-selection pattern so a multi-account
// user picks the same way here as when adding a single product.
//
// This modal only STARTS the job (POST /bulk-import -> jobId) and hands it to
// the parent via onJobStarted — it does NOT poll for the result itself. The
// import can take a while (each row's Amazon photo lookup), and closing this
// modal must never stop the product list from eventually refreshing — so the
// actual polling lives in ProductsPage.jsx, which stays mounted regardless of
// whether this modal is open or closed. `job` (the parent's current
// {jobId, status, result, error} for this upload, or null) is what drives the
// progress/result UI below.
export default function ProductBulkImportModal({ onClose, onJobStarted, job, ebayAccounts = [], activeEbayAccountId, isDark }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [selectedEbayAccountId, setSelectedEbayAccountId] = useState(() => {
    const activeAcc = findMatchingAccount(ebayAccounts, activeEbayAccountId);
    return getPreferredAccountValue(activeAcc || ebayAccounts[0] || {});
  });
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const isProcessing = job?.status === 'processing';

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setStartError('');
    try {
      const res = await productAPI.downloadBulkImportTemplate();
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'checkila-mehsul-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setStartError(t('productBulkImport.templateDownloadFailed'));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setStartError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setStarting(true);
    setStartError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedEbayAccountId) {
        const selectedAcc = findMatchingAccount(ebayAccounts, selectedEbayAccountId);
        formData.append('ebayAccountId', getPreferredAccountValue(selectedAcc || {}));
        if (selectedAcc?.tradingAccountId) {
          formData.append('tradingAccountId', selectedAcc.tradingAccountId);
        }
      }
      const startRes = await productAPI.bulkImport(formData);
      const jobId = startRes?.data?.jobId;
      if (!jobId) {
        throw new Error(t('productBulkImport.uploadFailed'));
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onJobStarted?.(jobId);
    } catch (uploadError) {
      setStartError(uploadError?.response?.data?.error || uploadError.message || t('productBulkImport.uploadFailed'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div
        className={`w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border shadow-2xl ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <h2 className={`text-base font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <FileSpreadsheet size={15} />
            </span>
            {t('productBulkImport.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1.5 transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className={`text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('productBulkImport.description')}
          </p>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition disabled:opacity-60"
          >
            {downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {t('productBulkImport.downloadTemplate')}
          </button>

          {ebayAccounts.length > 0 && (
            <div>
              <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {t('productBulkImport.ebayAccountLabel')}
              </label>
              <select
                value={selectedEbayAccountId}
                onChange={(e) => setSelectedEbayAccountId(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
                disabled={starting || isProcessing}
              >
                {ebayAccounts.map((acc) => {
                  const optionValue = getPreferredAccountValue(acc);
                  const isActiveAccount = getAccountKeys(acc).includes(trimAccountValue(activeEbayAccountId));
                  return (
                    <option key={optionValue} value={optionValue}>
                      {acc.connectionName || acc.username || acc.profileUserId || t('productBulkImport.unknownAccount')}
                      {isActiveAccount ? ` ${t('productBulkImport.activeAccountSuffix')}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {t('productBulkImport.fileLabel')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={starting || isProcessing}
              className={`w-full text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
            />
            {file && (
              <p className={`mt-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{file.name}</p>
            )}
          </div>

          {isProcessing && (
            <div className={`rounded-xl border p-3 flex items-start gap-2 ${isDark ? 'border-blue-900 bg-blue-950/30' : 'border-blue-200 bg-blue-50'}`}>
              <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin text-blue-500" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('productBulkImport.processingHint')}
              </p>
            </div>
          )}

          {startError && (
            <div className={`rounded-xl border p-3 flex items-start gap-2 ${isDark ? 'border-red-900 bg-red-950/30' : 'border-red-200 bg-red-50'}`}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-300">{startError}</p>
            </div>
          )}

          {job?.status === 'error' && (
            <div className={`rounded-xl border p-3 flex items-start gap-2 ${isDark ? 'border-red-900 bg-red-950/30' : 'border-red-200 bg-red-50'}`}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-300">{job.error}</p>
            </div>
          )}

          {job?.status === 'done' && job.result && (
            <div className={`rounded-xl border p-3 space-y-1.5 ${isDark ? 'border-emerald-900 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {t('productBulkImport.resultSummary', { created: job.result.created, total: job.result.totalRows })}
                </p>
              </div>
              {job.result.skipped > 0 && (
                <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  {t('productBulkImport.resultSkipped', { skipped: job.result.skipped })}
                </p>
              )}
              {Array.isArray(job.result.errors) && job.result.errors.length > 0 && (
                <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5">
                  {job.result.errors.map((err, idx) => (
                    <li key={`${err.row}-${idx}`} className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('productBulkImport.resultErrorLine', { row: err.row, reason: err.reason })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            {t('productBulkImport.close')}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || starting || isProcessing}
            className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {t('productBulkImport.uploadButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
