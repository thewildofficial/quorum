import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Spinner, ErrorBox, StatusBadge } from '../components/common.jsx';
import RankingBars from '../components/RankingBars.jsx';
import TornadoChart from '../components/TornadoChart.jsx';
import { brierLabel } from '../lib/format.js';

export default function DecisionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [scoreDraft, setScoreDraft] = useState({});
  const [decideForm, setDecideForm] = useState({ chosenOptionId: '', probability: 0.7, successCriterion: '', reviewBy: '', note: '' });
  const [outcomeForm, setOutcomeForm] = useState({ success: null, note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get(`/api/decisions/${id}`);
      setDetail(d);
      const draft = {};
      for (const s of d.scores) draft[`${s.option_id}:${s.criterion_id}`] = s.value;
      setScoreDraft(draft);
      const top = d.analysis?.ranking?.[0]?.optionId;
      setDecideForm((f) => ({ ...f, chosenOptionId: f.chosenOptionId || top || d.options[0]?.id || '' }));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const dirtyScores = useMemo(() => {
    if (!detail) return [];
    const out = [];
    for (const o of detail.options) {
      for (const c of detail.criteria) {
        const key = `${o.id}:${c.id}`;
        const existing = detail.scores.find((s) => s.option_id === o.id && s.criterion_id === c.id);
        const val = scoreDraft[key];
        if (val !== undefined && val !== '' && (!existing || existing.value !== Number(val))) {
          out.push({ optionId: o.id, criterionId: c.id, value: Number(val) });
        }
      }
    }
    return out;
  }, [detail, scoreDraft]);

  if (error && !detail) return <ErrorBox error={error} onRetry={load} />;
  if (!detail) return <Spinner />;

  const { decision, options, criteria, prediction, outcome, analysis, matrixComplete } = detail;
  const editable = decision.status === 'draft';
  const filledCount = Object.values(scoreDraft).filter((v) => v !== '' && v !== undefined).length;
  const totalCells = options.length * criteria.length;

  async function run(fn, okMsg) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      if (okMsg) setNotice(okMsg);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const saveScores = () => run(async () => {
    for (const s of dirtyScores) {
      if (!Number.isFinite(s.value) || s.value < 0 || s.value > 10) throw new Error('Scores must be numbers between 0 and 10');
    }
    if (dirtyScores.length) await api.put(`/api/decisions/${id}/scores`, { scores: dirtyScores });
  }, 'Scores saved.');

  const decide = () => run(async () => {
    await api.post(`/api/decisions/${id}/decide`, {
      chosenOptionId: decideForm.chosenOptionId,
      probability: Number(decideForm.probability),
      successCriterion: decideForm.successCriterion,
      reviewBy: decideForm.reviewBy,
      note: decideForm.note,
    });
  }, 'Decision locked in. Come back on the review date to record what happened.');

  const recordOutcome = () => run(async () => {
    if (outcomeForm.success === null) throw new Error('Say whether the success criterion was met: yes or no.');
    await api.post(`/api/decisions/${id}/outcome`, { success: outcomeForm.success, note: outcomeForm.note });
  }, 'Outcome recorded. This decision now counts toward your calibration.');

  const remove = () => run(async () => {
    if (!window.confirm('Delete this decision and all its data? This cannot be undone.')) return;
    await api.del(`/api/decisions/${id}`);
    navigate('/');
  });

  const brier = prediction && outcome ? (prediction.probability - outcome.success) ** 2 : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{decision.title}</h1>
        <StatusBadge status={decision.status} />
        <div className="spacer" />
        <button className="btn small danger" onClick={remove} disabled={busy}>Delete</button>
      </div>
      {decision.context && <p style={{ color: 'var(--muted)', marginTop: 0, maxWidth: 720 }}>{decision.context}</p>}
      <ErrorBox error={error} />
      {notice && <div className="alert success">{notice}</div>}

      <div className="grid cols-2">
        <div>
          <div className="card">
            <h2>Scoring matrix</h2>
            <p className="sub">
              {editable
                ? `Score each option 0-10 against every criterion. ${filledCount}/${totalCells} filled.`
                : 'Scores were frozen when the decision was made, so the forecast stays honest.'}
            </p>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>Criterion (weight)</th>
                    {options.map((o) => <th key={o.id} title={o.description}>{o.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name} <b>({c.weight})</b></td>
                      {options.map((o) => {
                        const key = `${o.id}:${c.id}`;
                        const val = scoreDraft[key];
                        return (
                          <td key={o.id}>
                            <input
                              type="number" min="0" max="10" step="0.5"
                              className={val !== undefined && val !== '' ? 'filled' : ''}
                              value={val ?? ''}
                              disabled={!editable}
                              aria-label={`${o.name} on ${c.name}`}
                              onChange={(e) => setScoreDraft({ ...scoreDraft, [key]: e.target.value === '' ? '' : Number(e.target.value) })}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={saveScores} disabled={busy || dirtyScores.length === 0}>
                  {dirtyScores.length ? `Save ${dirtyScores.length} change${dirtyScores.length > 1 ? 's' : ''}` : 'Saved'}
                </button>
              </div>
            )}
          </div>

          {editable && (
            <div className="card">
              <h2>Make the call</h2>
              <p className="sub">
                Lock in your choice and a forecast. Before you can score this decision later, define what
                "working out" means - observable, and with a date.
              </p>
              {!matrixComplete && (
                <div className="alert info">Fill in every cell of the scoring matrix first.</div>
              )}
              <div className="field">
                <label htmlFor="chosen">Chosen option</label>
                <select id="chosen" value={decideForm.chosenOptionId} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--line)' }}
                  onChange={(e) => setDecideForm({ ...decideForm, chosenOptionId: e.target.value })}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Probability this works out: <b>{Math.round(decideForm.probability * 100)}%</b></label>
                <div className="slider-row">
                  <input type="range" min="0" max="100" value={Math.round(decideForm.probability * 100)}
                    onChange={(e) => setDecideForm({ ...decideForm, probability: Number(e.target.value) / 100 })} />
                  <span className="pct">{Math.round(decideForm.probability * 100)}%</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="crit">Success criterion</label>
                <textarea id="crit" rows={2} maxLength={500} value={decideForm.successCriterion}
                  placeholder='e.g. "A working replication is running locally and written up by the review date."'
                  onChange={(e) => setDecideForm({ ...decideForm, successCriterion: e.target.value })} />
                <div className="hint">Something you could check yes/no on the review date, without re-arguing it.</div>
              </div>
              <div className="field">
                <label htmlFor="review">Review date</label>
                <input id="review" type="date" value={decideForm.reviewBy}
                  onChange={(e) => setDecideForm({ ...decideForm, reviewBy: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="dnote">Why this choice? (optional)</label>
                <textarea id="dnote" rows={2} maxLength={2000} value={decideForm.note}
                  onChange={(e) => setDecideForm({ ...decideForm, note: e.target.value })} />
              </div>
              <button className="btn primary" onClick={decide}
                disabled={busy || !matrixComplete || decideForm.successCriterion.trim().length < 10 || !decideForm.reviewBy}>
                Decide
              </button>
            </div>
          )}

          {decision.status === 'decided' && prediction && (
            <div className="card">
              <h2>Record the outcome</h2>
              <p className="sub">
                You said there was a <b>{Math.round(prediction.probability * 100)}%</b> chance that
                "{options.find((o) => o.id === decision.chosen_option_id)?.name}" would work out, where success means:
              </p>
              <div className="alert info" style={{ marginBottom: 12 }}>{prediction.success_criterion} (review by {prediction.review_by})</div>
              <div className="field">
                <label>Was the criterion met?</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className={`btn ${outcomeForm.success === true ? 'primary' : ''}`} onClick={() => setOutcomeForm({ ...outcomeForm, success: true })}>Yes, it worked</button>
                  <button className={`btn ${outcomeForm.success === false ? 'primary' : ''}`} onClick={() => setOutcomeForm({ ...outcomeForm, success: false })}>No, it did not</button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="onote">What actually happened? (optional)</label>
                <textarea id="onote" rows={2} maxLength={2000} value={outcomeForm.note}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, note: e.target.value })} />
              </div>
              <button className="btn primary" onClick={recordOutcome} disabled={busy || outcomeForm.success === null}>Record outcome</button>
            </div>
          )}

          {decision.status === 'closed' && prediction && outcome && (
            <div className="card">
              <h2>Outcome</h2>
              <p className="sub">Criterion: {prediction.success_criterion}</p>
              <div className={`alert ${outcome.success ? 'success' : 'error'}`} style={{ marginBottom: 10 }}>
                {outcome.success ? 'Criterion met.' : 'Criterion not met.'}
                {outcome.note && <> {outcome.note}</>}
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>
                You gave this <b>{Math.round(prediction.probability * 100)}%</b>. Brier score for this decision:{' '}
                <b>{brier.toFixed(4)}</b> ({brierLabel(brier)}). Lower is better; 0 is a perfect forecast.
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h2>Ranking</h2>
            {analysis ? (
              <RankingBars ranking={analysis.ranking} chosenOptionId={decision.chosen_option_id} />
            ) : (
              <p className="sub" style={{ marginBottom: 0 }}>Complete the scoring matrix to see the weighted ranking.</p>
            )}
          </div>
          {analysis && (
            <div className="card">
              <h2>How fragile is this ranking?{' '}
                <span className={`badge ${analysis.sensitivity.verdict}`}>
                  {analysis.sensitivity.verdict === 'robust' ? 'robust in tested range' : 'sensitive'}
                </span>
              </h2>
              <p className="sub">
                Local check only: each weight is varied one at a time between half and double its current value.
                It says nothing about changing several weights at once or weights outside that range.
              </p>
              <TornadoChart sensitivity={analysis.sensitivity} baseMargin={analysis.sensitivity.baseMargin} ranking={analysis.ranking} />
              {analysis.sensitivity.verdict === 'robust' && (
                <div className="alert success" style={{ marginTop: 12, marginBottom: 0 }}>
                  Within the tested range (0.5x-2x, one weight at a time), the winner never changes.
                </div>
              )}
              {analysis.sensitivity.verdict === 'sensitive' && (
                <div className="alert error" style={{ marginTop: 12, marginBottom: 0 }}>
                  The winner changes inside the tested range. The flagged weights are where your answer really lives -
                  argue about those, not the rest.
                </div>
              )}
            </div>
          )}
          <div className="card">
            <h2>Options & criteria</h2>
            <h3 style={{ marginTop: 0 }}>Options</h3>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
              {options.map((o) => (
                <li key={o.id} style={{ fontSize: 14, marginBottom: 4 }}>
                  <b>{o.name}</b>{o.description && <span style={{ color: 'var(--muted)' }}> - {o.description}</span>}
                </li>
              ))}
            </ul>
            <h3>Criteria</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {criteria.map((c) => <li key={c.id} style={{ fontSize: 14 }}>{c.name} (weight {c.weight})</li>)}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
