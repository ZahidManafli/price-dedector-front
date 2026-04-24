import { useCallback, useRef } from 'react';
import api from '../services/api';

export function useActivityLogger() {
  const queue = useRef([]);
  const timer = useRef(null);

  const flush = useCallback(async () => {
    if (!queue.current.length) return;
    const batch = [...queue.current];
    queue.current = [];

    // Send each log (or batch if you add a batch endpoint)
    for (const log of batch) {
      try {
        await api.post('/activity/log', log);
      } catch {
        // silent fail — never block UI
      }
    }
  }, []);

  const log = useCallback((action, options = {}) => {
    queue.current.push({
      action,
      actionCategory: options.category || 'ui',
      payload: options.payload || null,
      success: options.success !== false,
      errorMessage: options.error || null,
    });

    // Debounce flush — send after 2s of inactivity
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 2000);
  }, [flush]);

  return { log };
}