// Per-user cache of the Aquiline profile, so it's available instantly on page
// refresh (no flash of "not connected" while the network request is in flight)
// and reusable by other parts of the app without an extra API call. The backend
// GET /aquiline/profile response is always the source of truth — this is a cache,
// refreshed every time that endpoint is called.
const KEY_PREFIX = 'checkila.aquilineProfile.';

function keyFor(userEmail) {
  return `${KEY_PREFIX}${String(userEmail || '').trim().toLowerCase()}`;
}

export function readStoredAquilineProfile(userEmail) {
  if (typeof window === 'undefined' || !userEmail) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userEmail));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredAquilineProfile(userEmail, profile) {
  if (typeof window === 'undefined' || !userEmail) return;
  try {
    if (profile) {
      window.localStorage.setItem(keyFor(userEmail), JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(keyFor(userEmail));
    }
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
}
