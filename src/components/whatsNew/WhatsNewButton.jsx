import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { whatsNewAPI } from '../../services/api';
import WhatsNewPanel from './WhatsNewPanel';

const POLL_MS = 5 * 60 * 1000;

// Sidebar "What's new" button next to the notification bell: a badge with the
// number of announcements published since the panel was last opened.
export default function WhatsNewButton({ isDark }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const res = await whatsNewAPI.unseenCount();
      setUnseen(Number(res?.data?.count || 0));
    } catch {
      // badge is a convenience — keep the last value
    }
  }, []);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, POLL_MS);
    return () => clearInterval(timer);
  }, [loadCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('whatsNew.title')}
        aria-label={unseen > 0 ? t('whatsNew.buttonUnseen', { count: unseen }) : t('whatsNew.title')}
        className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
          isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        } ${unseen > 0 ? (isDark ? 'text-indigo-300' : 'text-indigo-600') : ''}`}
      >
        <Sparkles size={16} />
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>
      <WhatsNewPanel open={open} onClose={() => setOpen(false)} isDark={isDark} onSeen={() => setUnseen(0)} />
    </>
  );
}
