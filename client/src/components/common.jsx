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

const STATUS_LABELS = { draft: 'draft', decided: 'decided', closed: 'reviewed' };
export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>;
}
