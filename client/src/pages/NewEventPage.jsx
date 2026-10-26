import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../AuthContext.jsx';
import { ErrorBox, Spinner } from '../components/common.jsx';

export default function NewEventPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', location: '', startsAt: '', endsAt: '', capacity: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'organizer') {
    return <div className="alert error">Only organizers can create events. Ask a club organizer to publish it for you.</div>;
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const d = await api.post('/api/events', {
        title: form.title,
        description: form.description,
        location: form.location,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
        capacity: form.capacity === '' ? null : Number(form.capacity),
      });
      navigate(`/events/${d.event.id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2>Create event</h2>
      <p className="sub">Published events are visible to anyone with the link; RSVPs need an SST account.</p>
      <ErrorBox error={error} />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="t">Title</label>
          <input id="t" value={form.title} onChange={set('title')} maxLength={140} required placeholder='e.g. "Build Night: Evals Hackathon"' />
        </div>
        <div className="field">
          <label htmlFor="d">Description</label>
          <textarea id="d" rows={4} value={form.description} onChange={set('description')} placeholder="What happens, who it's for, what to bring." />
        </div>
        <div className="field">
          <label htmlFor="l">Location</label>
          <input id="l" value={form.location} onChange={set('location')} maxLength={300} placeholder="Seminar Hall 2, or a Discord stage link" />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="s">Starts</label>
            <input id="s" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required />
          </div>
          <div className="field">
            <label htmlFor="e">Ends</label>
            <input id="e" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="c">Capacity</label>
          <input id="c" type="number" min="1" step="1" value={form.capacity} onChange={set('capacity')} placeholder="Leave empty for unlimited" />
          <div className="hint">When full, new RSVPs join a waitlist and get promoted automatically as seats open.</div>
        </div>
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Publishing...' : 'Publish event'}</button>
      </form>
    </div>
  );
}
