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
export function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function SpotsBadge({ event }) {
  if (event.status === 'cancelled') return <span className="badge closed">cancelled</span>;
  if (event.capacity === null) return <span className="badge decided">open capacity</span>;
  if (event.spotsLeft > 0) return <span className="badge closed">{event.spotsLeft} spot{event.spotsLeft > 1 ? 's' : ''} left</span>;
  return <span className="badge draft">waitlist open</span>;
}
