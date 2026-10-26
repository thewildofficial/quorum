export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      {error}
      {onRetry && <button className="btn small" style={{ marginLeft: 10 }} onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

/* ---------- dates ---------- */
function asDate(iso) {
  return new Date(typeof iso === 'string' && !iso.includes('T') ? iso.replace(' ', 'T') + 'Z' : iso);
}
export function formatWhen(iso) {
  return asDate(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function formatTime(iso) {
  return asDate(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function dayParts(iso) {
  const d = asDate(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(now)) / 86400000);
  const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : null;
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    rel,
    key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
  };
}

/* ---------- generative cover art (deterministic per event) ---------- */
const PALETTES = [
  ['rgba(245, 203, 74, 0.85)', 'rgba(120, 74, 16, 0.55)'],
  ['rgba(229, 183, 49, 0.75)', 'rgba(92, 60, 14, 0.60)'],
  ['rgba(255, 216, 112, 0.80)', 'rgba(70, 44, 10, 0.65)'],
  ['rgba(204, 154, 42, 0.70)', 'rgba(110, 70, 20, 0.50)'],
];
export function coverVars(seed) {
  const s = String(seed ?? 'quorum');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [c1, c2] = PALETTES[h % PALETTES.length];
  return {
    '--c1': c1, '--c2': c2,
    '--gx': `${15 + (h % 60)}%`, '--gy': `${10 + ((h >> 4) % 55)}%`,
    '--gx2': `${35 + ((h >> 8) % 55)}%`, '--gy2': `${45 + ((h >> 12) % 50)}%`,
  };
}

/* ---------- inline icons ---------- */
function I({ children, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}
export const CalendarIcon = (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></I>;
export const PinIcon = (p) => <I {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z" /><circle cx="12" cy="10" r="3" /></I>;
export const UsersIcon = (p) => <I {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></I>;
export const SearchIcon = (p) => <I {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></I>;
export const ArrowIcon = (p) => <I {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></I>;
export const ClockIcon = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></I>;

export function SpotsBadge({ event }) {
  if (event.status === 'cancelled') return <span className="badge closed">cancelled</span>;
  if (event.capacity === null) return <span className="badge decided">open capacity</span>;
  if (event.spotsLeft > 0) return <span className="badge closed">{event.spotsLeft} spot{event.spotsLeft > 1 ? 's' : ''} left</span>;
  return <span className="badge draft">waitlist open</span>;
}
