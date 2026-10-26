import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../AuthContext.jsx';
import { Spinner, ErrorBox, Empty, formatWhen, SpotsBadge, coverVars, CalendarIcon, PinIcon, UsersIcon, ClockIcon } from '../components/common.jsx';

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

  const started = new Date(event.starts_at).getTime() < Date.now();

  return (
    <>
      <div className="ev-hero cover" style={coverVars(event.id)} />

      <div className="detail-head">
        <h1>{event.title}</h1>
        <SpotsBadge event={event} />
      </div>

      <div className="info-list">
        <div className="info-row">
          <div className="icon-chip"><CalendarIcon size={17} /></div>
          <div>
            <div className="k">{formatWhen(event.starts_at)}</div>
            <div className="v">until {formatWhen(event.ends_at)}</div>
          </div>
        </div>
        <div className="info-row">
          <div className="icon-chip"><PinIcon size={17} /></div>
          <div>
            <div className="k">{event.location || 'Location TBA'}</div>
            <div className="v">Reinforce, Scaler School of Technology</div>
          </div>
        </div>
        <div className="info-row host-row">
          <div className="avatar">{(event.organizer?.display_name || 'R')[0].toUpperCase()}</div>
          <div>
            <div className="k">Hosted by {event.organizer?.display_name}</div>
            <div className="v">{event.going} going{event.waitlisted > 0 ? ` · ${event.waitlisted} on the waitlist` : ''}</div>
          </div>
        </div>
      </div>

      <ErrorBox error={error} />
      {notice && <div className="alert success">{notice}</div>}

      <div className="detail-grid">
        <div>
          <div className="card">
            <h2>About</h2>
            {event.description
              ? <p className="about-body">{event.description}</p>
              : <p className="sub">No description yet.</p>}
          </div>
          <div className="stat-row">
            <div className="stat"><div className="num">{event.going}</div><div className="lbl">going</div></div>
            <div className="stat"><div className="num">{event.capacity === null ? '∞' : event.capacity}</div><div className="lbl">capacity</div></div>
            <div className="stat"><div className="num">{event.waitlisted}</div><div className="lbl">waitlisted</div></div>
          </div>
        </div>

        <div>
          <div className="card reg-card">
            <h3>Registration</h3>
            {!user ? (
              <>
                <p className="sub">Sign in with your SST Google account to RSVP.</p>
                <Link className="btn primary block" to="/login">Log in to RSVP</Link>
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
                <button className="btn danger block" onClick={cancelRsvp} disabled={busy}>Cancel my RSVP</button>
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
                <button className="btn primary block" onClick={rsvp} disabled={busy}>
                  {event.capacity !== null && event.spotsLeft === 0 ? 'Join waitlist' : 'RSVP'}
                </button>
              </>
            )}
          </div>

          {isOrganizer && (
            <div className="card">
              <h3>Organizer</h3>
              <div className="field">
                <label htmlFor="cap">Capacity (empty = unlimited)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="cap" type="number" min="1" step="1" value={capEdit} onChange={(e) => setCapEdit(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn" onClick={saveCapacity} disabled={busy}>Save</button>
                </div>
                <div className="hint">Raising capacity promotes the waitlist automatically. You cannot go below {event.going} (current going count).</div>
              </div>
              <button className="btn danger" onClick={cancelEvent} disabled={busy || event.status === 'cancelled'}>Cancel event</button>

              <h3 style={{ marginTop: 20 }}>Attendees</h3>
              {!attendees ? <p className="sub">Loading...</p> : attendees.length === 0 ? (
                <Empty title="No RSVPs yet">Share the link with the club.</Empty>
              ) : (
                <div>
                  {attendees.map((a) => (
                    <div key={a.id} className="attendee-row">
                      <span>{a.display_name} <span className="email">({a.email})</span></span>
                      <span className={`badge ${a.status === 'going' ? 'closed' : 'draft'}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
