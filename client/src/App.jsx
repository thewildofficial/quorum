import { Routes, Route, Navigate, Link, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import NewDecisionPage from './pages/NewDecisionPage.jsx';
import DecisionDetailPage from './pages/DecisionDetailPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Delib<span>erate</span></Link>
        <nav>
          <NavLink to="/" end>Decisions</NavLink>
          <NavLink to="/analytics">Calibration</NavLink>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>{user?.displayName}</span>
          <button className="btn small" onClick={async () => { await logout(); navigate('/login'); }}>
            Log out
          </button>
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/decisions/new" element={<Protected><NewDecisionPage /></Protected>} />
        <Route path="/decisions/:id" element={<Protected><DecisionDetailPage /></Protected>} />
        <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
