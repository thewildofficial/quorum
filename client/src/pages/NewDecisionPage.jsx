import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorBox } from '../components/common.jsx';

const STEPS = ['The decision', 'Options', 'Criteria & weights'];

export default function NewDecisionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState([{ name: '', description: '' }, { name: '', description: '' }]);
  const [criteria, setCriteria] = useState([
    { name: '', weight: 3 },
    { name: '', weight: 3 },
  ]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const stepValid = [
    title.trim().length > 0,
    options.filter((o) => o.name.trim()).length >= 2,
    criteria.filter((c) => c.name.trim() && Number(c.weight) > 0).length >= 2,
  ];

  async function finish() {
    setError(null);
    setBusy(true);
    try {
      const created = await api.post('/api/decisions', { title: title.trim(), context: context.trim() });
      const id = created.decision.id;
      await api.put(`/api/decisions/${id}/options`, {
        options: options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), description: o.description.trim() })),
      });
      await api.put(`/api/decisions/${id}/criteria`, {
        criteria: criteria.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), weight: Number(c.weight) })),
      });
      navigate(`/decisions/${id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const update = (list, setList, i, patch) => setList(list.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  return (
    <>
      <h1 style={{ fontSize: 22, margin: '0 0 16px' }}>New decision</h1>
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>{i + 1}. {s}</div>
        ))}
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <ErrorBox error={error} />
        {step === 0 && (
          <>
            <div className="field">
              <label htmlFor="t">What are you deciding?</label>
              <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder='e.g. "Which research project should I prioritise?"' />
            </div>
            <div className="field">
              <label htmlFor="c">Context (optional)</label>
              <textarea id="c" rows={4} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Constraints, deadlines, stakes - anything future-you should remember." />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="sub" style={{ marginTop: 0 }}>The realistic alternatives on the table. Two to ten.</p>
            {options.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input style={{ flex: 2 }} placeholder={`Option ${i + 1}`} value={o.name} maxLength={120}
                  onChange={(e) => update(options, setOptions, i, { name: e.target.value })} />
                <input style={{ flex: 3 }} placeholder="One-line description (optional)" value={o.description} maxLength={300}
                  onChange={(e) => update(options, setOptions, i, { description: e.target.value })} />
                {options.length > 2 && (
                  <button className="btn small danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>x</button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button className="btn small" onClick={() => setOptions([...options, { name: '', description: '' }])}>+ Add option</button>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <p className="sub" style={{ marginTop: 0 }}>What matters, and how much? Weights are relative - only their ratios count.</p>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input style={{ flex: 3 }} placeholder={`Criterion ${i + 1} (e.g. "Learning value")`} value={c.name} maxLength={120}
                  onChange={(e) => update(criteria, setCriteria, i, { name: e.target.value })} />
                <input style={{ flex: 1 }} type="number" min="0.01" step="any" value={c.weight} aria-label="weight"
                  onChange={(e) => update(criteria, setCriteria, i, { weight: e.target.value })} />
                {criteria.length > 2 && (
                  <button className="btn small danger" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>x</button>
                )}
              </div>
            ))}
            {criteria.length < 10 && (
              <button className="btn small" onClick={() => setCriteria([...criteria, { name: '', weight: 3 }])}>+ Add criterion</button>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
          <div className="spacer" />
          {step < STEPS.length - 1 ? (
            <button className="btn primary" disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="btn primary" disabled={!stepValid[step] || busy} onClick={finish}>
              {busy ? 'Creating...' : 'Create decision'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
