import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../AuthContext.jsx';
import { Spinner, ErrorBox, Empty, formatWhen, SpotsBadge } from '../components/common.jsx';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [capEdit, setCapEdit] = useState('');

  const isOrganizer = user && event && event.organizer?.id === user.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get(`/api/events/${id}`);
      setEvent(d.event);
      setCapEdit(d.event.capacity ?? '');
    } catch (e) { setError(e.message); }
  }, [id]);

  const loadAttendees = useCallback(async () => {
    try { setAttendees((await api.get(`/api/events/${id}/attendees`)).attendees); }
    catch { setAttendees(null); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isOrganizer) loadAttendees(); }, [isOrganizer, loadAttendees, event?.going, event?.waitlisted]);

  if (error && !event) return <ErrorBox error={error} onRetry={load} />;
  if (!event) return <Spinner />;

  async function run(fn, ok) {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); await load(); if (ok) setNotice(ok); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const rsvp = () => run(async () => {
    const d = await api.post(`/api/events/${id}/rsvp`);
    setNotice(d.rsvp.status === 'going'
      ? 'You are in! See you there.'
      : `This event is full - you are #${d.event.waitlistPosition} on the waitlist. You move up automatically as seats open.`);
  });

  const cancelRsvp = () => run(async () => {
    const d = await api.post(`/api/events/${id}/rsvp/cancel`);
    setNotice(d.promotedCount > 0
      ? `RSVP cancelled. Your seat went to the next person on the waitlist.`
      : 'RSVP cancelled.');
  });

  const saveCapacity = () => run(async () => {
    const d = await api.patch(`/api/events/${id}`, { capacity: capEdit === '' ? null : Number(capEdit) });
    setNotice(d.promotedCount > 0 ? `Capacity saved. ${d.promotedCount} waitlisted member(s) promoted.` : 'Capacity saved.');
  });

  const cancelEvent = () => run(async () => {
    if (!window.confirm('Cancel this event? All RSVPs and the waitlist are cancelled. This cannot be undone.')) return;
    await api.post(`/api/events/${id}/cancel`);
  });

  const started = Date.parse(event.starts_at.replace(' ', 'T') + 'Z') < Date.now();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{event.title}</h1>
        <SpotsBadge event={event} />
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        {formatWhen(event.starts_at)} - {formatWhen(event.ends_at)} · {event.location || 'Location TBA'} ·
        organized by {event.organizer?.display_name}
      </p>
      <ErrorBox error={error} />
      {notice && <div className="alert success">{notice}</div>}

      <div className="grid cols-2">
        <div className="card">
          <h2>About</h2>
          {event.description
            ? <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{event.description}</p>
            : <p className="sub">No description yet.</p>}
          <div className="grid cols-3" style={{ marginTop: 14 }}>
            <div className="stat"><div className="num">{event.going}</div><div className="lbl">going</div></div>
            <div className="stat"><div className="num">{event.capacity === null ? '∞' : event.capacity}</div><div className="lbl">capacity</div></div>
            <div className="stat"><div className="num">{event.waitlisted}</div><div className="lbl">waitlisted</div></div>
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Your spot</h2>
            {!user ? (
              <>
                <p className="sub">Sign in with your SST Google account to RSVP.</p>
                <Link className="btn primary" to="/login">Log in to RSVP</Link>
              </>
            ) : event.status === 'cancelled' ? (
              <p className="sub">This event was cancelled.</p>
            ) : event.myRsvp ? (
              <>
                {event.myRsvp.status === 'going' ? (
                  <div className="alert success">You are going. See you there!</div>
                ) : (
                  <div className="alert info">
                    You are <b>#{event.waitlistPosition}</b> on the waitlist. Promotion is automatic when a seat opens.
                  </div>
                )}
                <button className="btn danger" onClick={cancelRsvp} disabled={busy}>Cancel my RSVP</button>
              </>
            ) : started ? (
              <p className="sub">This event has already started.</p>
            ) : isOrganizer ? (
              <p className="sub">You organize this event, so you cannot RSVP to it.</p>
            ) : (
              <>
                <p className="sub">
                  {event.capacity === null
                    ? 'Open capacity - every RSVP is confirmed.'
                    : event.spotsLeft > 0
                      ? `${event.spotsLeft} of ${event.capacity} spots left.`
                      : 'Full right now - you would join the waitlist.'}
                </p>
                <button className="btn primary" onClick={rsvp} disabled={busy}>
                  {event.capacity !== null && event.spotsLeft === 0 ? 'Join waitlist' : 'RSVP'}
                </button>
              </>
            )}
          </div>

          {isOrganizer && (
            <div className="card">
              <h2>Organizer</h2>
              <div className="field">
                <label htmlFor="cap">Capacity (empty = unlimited)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="cap" type="number" min="1" step="1" value={capEdit} onChange={(e) => setCapEdit(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8 }} />
                  <button className="btn" onClick={saveCapacity} disabled={busy}>Save</button>
                </div>
                <div className="hint">Raising capacity promotes the waitlist automatically. You cannot go below {event.going} (current going count).</div>
              </div>
              <button className="btn danger" onClick={cancelEvent} disabled={busy || event.status === 'cancelled'}>Cancel event</button>

              <h3 style={{ marginTop: 18 }}>Attendees</h3>
              {!attendees ? <p className="sub">Loading...</p> : attendees.length === 0 ? (
                <Empty title="No RSVPs yet">Share the link with the club.</Empty>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {attendees.map((a) => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
                      <span>{a.display_name} <span style={{ color: 'var(--muted)' }}>({a.email})</span></span>
                      <span className={`badge ${a.status === 'going' ? 'closed' : 'draft'}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
