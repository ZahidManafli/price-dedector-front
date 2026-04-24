import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityLogger } from '../hooks/useActivityLogger';

export default function ActivityTracker() {
  const location = useLocation();
  const { log } = useActivityLogger();

  // ✅ Don't track unauthenticated users at all
  const isAuthenticated = () => !!localStorage.getItem('authToken');

  useEffect(() => {
    if (!isAuthenticated()) return;  // ✅ skip
    log('navigation.pageView', {
      category: 'navigation',
      payload: { path: location.pathname },
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e) => {
      if (!isAuthenticated()) return;  // ✅ skip
      const target = e.target.closest('button, a, [data-track]');
      if (!target) return;

      const label =
        target.dataset.track ||
        target.getAttribute('aria-label') ||
        target.innerText?.trim()?.slice(0, 80) ||
        target.tagName;

      log('ui.click', {
        category: 'ui',
        payload: {
          label,
          tag: target.tagName,
          path: window.location.pathname,
        },
      });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}