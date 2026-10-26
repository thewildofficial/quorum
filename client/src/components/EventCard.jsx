import { Link } from 'react-router-dom';
import { formatWhen, SpotsBadge } from './common.jsx';

export default function EventCard({ event, badge }) {
  return (
    <Link to={`/events/${event.id}`} style={{ color: 'inherit' }}>
      <div className="decision-row">
        <div>
          <div className="title">{event.title}</div>
          <div className="meta">
            {formatWhen(event.starts_at)} · {event.location || 'Location TBA'} · {event.going} going
            {event.waitlisted > 0 && ` · ${event.waitlisted} waitlisted`}
          </div>
        </div>
        {badge || <SpotsBadge event={event} />}
      </div>
    </Link>
  );
}
