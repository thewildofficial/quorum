import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Spinner, ErrorBox, Empty, dayParts, SearchIcon } from '../components/common.jsx';
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

  const groups = useMemo(() => {
    const out = [];
    for (const e of events ?? []) {
      const day = dayParts(e.starts_at);
      const last = out[out.length - 1];
      if (last && last.key === day.key) last.events.push(e);
      else out.push({ key: day.key, day, events: [e] });
    }
    return out;
  }, [events]);

  return (
    <>
      <header className="discover-head">
        <h1>Events</h1>
        <p>Reinforce talks, workshops and build nights - open to every member.</p>
      </header>
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Filter events">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={when === t.key}
              className={when === t.key ? 'on' : ''} onClick={() => setWhen(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="search">
          <SearchIcon size={15} />
          <input type="search" placeholder="Search events..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        </div>
      </div>
      <ErrorBox error={error} onRetry={load} />
      {loading && !events ? <Spinner /> : !events?.length ? (
        <Empty title="No events found">
          {q ? 'Try a different search.' : when === 'past' ? 'No past events yet.' : 'Nothing scheduled right now - check back soon.'}
        </Empty>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <div className="tl-day">
              {g.day.rel
                ? <><span className="dow rel">{g.day.rel}</span><span className="date">{g.day.dow}, {g.day.label}</span></>
                : <><span className="dow">{g.day.dow}</span><span className="date">{g.day.label}</span></>}
            </div>
            {g.events.map((e) => <EventCard key={e.id} event={e} />)}
          </section>
        ))
      )}
    </>
  );
}
