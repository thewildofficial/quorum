import { useAuth } from '../AuthContext.jsx';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { user, loading, allowedDomain } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;
  return (
    <div className="auth-wrap">
      <div className="brand-big">Quorum</div>
      <div className="tag">Reinforce events - talks, workshops, build nights.</div>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Member sign-in</h2>
        <p className="sub">
          Quorum is for the Reinforce community at Scaler School of Technology. Sign in with your
          <b> @{allowedDomain}</b> Google account - other Google accounts are turned away by the server.
        </p>
        <a className="btn primary" href="/api/auth/google" style={{ justifyContent: 'center', width: '100%' }}>
          Continue with Google
        </a>
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 14, marginBottom: 0 }}>
          You can browse events without signing in. You need an account to RSVP.
        </p>
      </div>
    </div>
  );
}
