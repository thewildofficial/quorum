import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Spinner, ErrorBox, Empty } from '../components/common.jsx';
import EventCard from '../components/EventCard.jsx';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
];

export default function EventsPage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [when, setWhen] = useState('upcoming');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ when });
      if (q.trim()) params.set('q', q.trim());
      const d = await api.get(`/api/events?${params}`);
      setEvents(d.events);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [when, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Search events..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        {TABS.map((t) => (
          <button key={t.key} className={`btn small ${when === t.key ? 'primary' : ''}`} onClick={() => setWhen(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={load} />
      {loading && !events ? <Spinner /> : !events?.length ? (
        <Empty title="No events found">
          {q ? 'Try a different search.' : when === 'past' ? 'No past events yet.' : 'Nothing scheduled right now - check back soon.'}
        </Empty>
      ) : (
        events.map((e) => <EventCard key={e.id} event={e} />)
      )}
    </>
  );
}
