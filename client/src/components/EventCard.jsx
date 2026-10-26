import { Link } from 'react-router-dom';
import { formatTime, coverVars, SpotsBadge, PinIcon, UsersIcon, ArrowIcon } from './common.jsx';

export default function EventCard({ event, badge }) {
  return (
    <Link to={`/events/${event.id}`} className="ev-row">
      <div className="ev-cover cover" style={coverVars(event.id)} />
      <div className="ev-row-main">
        <div className="ev-time">{formatTime(event.starts_at)}</div>
        <div className="ev-title">{event.title}</div>
        <div className="ev-meta">
          <PinIcon size={13} /> {event.location || 'Location TBA'}
          <span className="sep">·</span>
          <UsersIcon size={13} /> {event.going} going
          {event.waitlisted > 0 && <><span className="sep">·</span> {event.waitlisted} waitlisted</>}
        </div>
      </div>
      <div className="ev-row-side">
        {badge || <SpotsBadge event={event} />}
        <span className="arrow"><ArrowIcon size={16} /></span>
      </div>
    </Link>
  );
}
