import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Spinner, ErrorBox, Empty, StatusBadge } from '../components/common.jsx';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'decided', label: 'Decided' },
  { key: 'closed', label: 'Reviewed' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      setData(await api.get(`/api/decisions?${params}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Search decisions..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search decisions" />
        {FILTERS.map((f) => (
          <button key={f.key} className={`btn small ${status === f.key ? 'primary' : ''}`} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
        <div className="spacer" />
        <Link to="/decisions/new" className="btn primary">+ New decision</Link>
      </div>
      <ErrorBox error={error} onRetry={load} />
      {loading && !data ? <Spinner /> : !data?.decisions?.length ? (
        <Empty title="No decisions here yet">
          {q || status ? 'Try a different search or filter.' : 'Start your first decision and give it real options, criteria and scores.'}
        </Empty>
      ) : (
        data.decisions.map((d) => (
          <Link to={`/decisions/${d.id}`} key={d.id} style={{ color: 'inherit' }}>
            <div className="decision-row">
              <div>
                <div className="title">{d.title}</div>
                <div className="meta">
                  {d.option_count} options · {d.criterion_count} criteria · created {new Date(d.created_at + 'Z').toLocaleDateString()}
                </div>
              </div>
              <StatusBadge status={d.status} />
            </div>
          </Link>
        ))
      )}
    </>
  );
}
