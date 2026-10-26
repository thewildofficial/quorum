import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Spinner, ErrorBox, Empty } from '../components/common.jsx';
import CalibrationChart from '../components/CalibrationChart.jsx';
import { brierLabel } from '../lib/format.js';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await api.get('/api/analytics/summary')); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !data) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const { byStatus, calibration, recentClosed } = data;
  const coinFlip = 0.25;

  return (
    <>
      <h1 style={{ fontSize: 22, margin: '0 0 16px' }}>Calibration</h1>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="num">{byStatus.draft || 0}</div><div className="lbl">Open drafts</div></div>
        <div className="card stat"><div className="num">{byStatus.decided || 0}</div><div className="lbl">Awaiting outcome</div></div>
        <div className="card stat"><div className="num">{byStatus.closed || 0}</div><div className="lbl">Reviewed</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Do your probabilities mean what they say?</h2>
          <p className="sub">
            Each point is a bucket of past forecasts: mean predicted probability vs how often those calls actually
            worked out. On the dashed diagonal, your 70% calls happen 70% of the time.
          </p>
          {calibration.count === 0 ? (
            <Empty title="No closed decisions yet">
              Record outcomes on decided decisions and this chart comes alive.
            </Empty>
          ) : (
            <CalibrationChart bins={calibration.bins} />
          )}
        </div>
        <div>
          <div className="card stat" style={{ textAlign: 'left' }}>
            <h2 style={{ marginBottom: 4 }}>Mean Brier score</h2>
            {calibration.meanBrier === null ? (
              <p className="sub" style={{ margin: 0 }}>No scored forecasts yet.</p>
            ) : (
              <>
                <div className="num">{calibration.meanBrier.toFixed(4)}</div>
                <div className="lbl">
                  across {calibration.count} reviewed decision{calibration.count > 1 ? 's' : ''} - {brierLabel(calibration.meanBrier)}.
                  Always saying 50% scores {coinFlip}; beating that means your confidence carries information.
                </div>
              </>
            )}
          </div>
          <div className="card">
            <h2>Recent reviews</h2>
            {recentClosed.length === 0 ? (
              <p className="sub" style={{ margin: 0 }}>Nothing reviewed yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {recentClosed.map((r) => (
                  <li key={r.id} style={{ fontSize: 14, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <Link to={`/decisions/${r.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.title}</Link>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                      predicted {Math.round(r.probability * 100)}% - {r.success ? 'worked out' : 'did not work out'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
