export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fmt = {
  int: (v: number) => Math.round(v).toLocaleString('en-US'),
  pct: (v: number, d = 1) => (v * 100).toFixed(d) + '%',
  usd: (v: number) => '$' + Math.round(v).toLocaleString('en-US'),
  usd2: (v: number) => '$' + v.toFixed(2),
  nps: (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1),
};

export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** "2026-09-14" -> "Sep 14" */
export const dayLabel = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return MONTHS[m - 1] + ' ' + d; };
export const monthShort = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
export const monthName = (iso: string) => FULL_MONTHS[Number(iso.slice(5, 7)) - 1];
export const monthLabel = (iso: string) => monthName(iso) + ' ' + iso.slice(0, 4);
