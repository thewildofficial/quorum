import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';
import MyRsvpsPage from './pages/MyRsvpsPage.jsx';
import NewEventPage from './pages/NewEventPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Quo<span>rum</span> <em style={{ fontStyle: 'normal', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Reinforce events</em></Link>
        <nav>
          <NavLink to="/" end>Events</NavLink>
          {user && <NavLink to="/mine">My RSVPs</NavLink>}
          {user?.role === 'organizer' && <NavLink to="/new">+ Create event</NavLink>}
          {user ? (
            <>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>{user.displayName}</span>
              <button className="btn small" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/mine" element={<MyRsvpsPage />} />
          <Route path="/new" element={<NewEventPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<EventsPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
