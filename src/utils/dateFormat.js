// Intl's az-AZ month names aren't available in every browser build (some fall
// back to "M11"), so Azerbaijani dates are formatted from our own month list.
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const AZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];

const pad = (n) => String(n).padStart(2, '0');

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const isAz = (lang) => String(lang || '').toLowerCase().startsWith('az');

// "3 noy, 14:05" / "Nov 3, 02:05 PM"
export function formatShortDateTime(value, lang) {
  const date = toDate(value);
  if (!date) return '';
  if (isAz(lang)) return `${date.getDate()} ${AZ_MONTHS_SHORT[date.getMonth()]}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

// "3 noyabr 2026" / "November 3, 2026"
export function formatLongDate(value, lang) {
  const date = toDate(value);
  if (!date) return '';
  if (isAz(lang)) return `${date.getDate()} ${AZ_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

// "3 noyabr 2026, 14:05"
export function formatLongDateTime(value, lang) {
  const date = toDate(value);
  if (!date) return '';
  if (isAz(lang)) return `${formatLongDate(date, lang)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
