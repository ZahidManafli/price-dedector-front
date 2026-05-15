import { useEffect, useRef, useState } from 'react';
import { calculateLast7DaysSoldCount, fetchPurchaseHistoryRows } from '../utils/purchaseHistory';

export default function useSequentialPurchaseHistory(items, { enabled = true, getKey, getItemId }) {
  const [soldCountByKey, setSoldCountByKey] = useState({});
  const [loadingByKey, setLoadingByKey] = useState({});
  const queueRunningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !Array.isArray(items) || !items.length) return;

    const pending = [];
    for (const item of items) {
      const key = getKey(item);
      if (!key) continue;
      if (Object.prototype.hasOwnProperty.call(soldCountByKey, key)) continue;
      const itemId = getItemId(item);
      if (!itemId) continue;
      pending.push({ key, itemId });
    }

    if (!pending.length || queueRunningRef.current) return;

    let cancelled = false;
    queueRunningRef.current = true;

    setLoadingByKey((prev) => {
      const next = { ...prev };
      for (const entry of pending) {
        next[entry.key] = true;
      }
      return next;
    });

    (async () => {
      for (const task of pending) {
        if (cancelled) break;
        try {
          const rows = await fetchPurchaseHistoryRows(task.itemId);
          const soldCount = calculateLast7DaysSoldCount(rows);
          if (!cancelled) {
            setSoldCountByKey((prev) => ({ ...prev, [task.key]: soldCount }));
          }
        } catch {
          if (!cancelled) {
            setSoldCountByKey((prev) => ({ ...prev, [task.key]: 0 }));
          }
        } finally {
          if (!cancelled) {
            setLoadingByKey((prev) => ({ ...prev, [task.key]: false }));
          }
        }
      }

      queueRunningRef.current = false;
    })().catch(() => {
      queueRunningRef.current = false;
    });

    return () => {
      cancelled = true;
      queueRunningRef.current = false;
    };
  }, [enabled, getItemId, getKey, items, soldCountByKey]);

  return { soldCountByKey, loadingByKey };
}
