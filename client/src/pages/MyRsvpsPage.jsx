import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../AuthContext.jsx';
import { Spinner, ErrorBox, Empty } from '../components/common.jsx';
import EventCard from '../components/EventCard.jsx';

export default function MyRsvpsPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try { setEvents((await api.get('/api/events/mine/rsvps')).events); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (authLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <h1 style={{ fontSize: 22, margin: '0 0 16px' }}>My RSVPs</h1>
      <ErrorBox error={error} onRetry={load} />
      {!events ? <Spinner /> : events.length === 0 ? (
        <Empty title="Nothing yet">RSVP to an event and it shows up here.</Empty>
      ) : (
        events.map((e) => (
          <EventCard key={e.id} event={e}
            badge={e.rsvpStatus === 'going'
              ? <span className="badge closed">going</span>
              : <span className="badge draft">waitlist #{e.waitlistPosition}</span>} />
        ))
      )}
    </>
  );
}
