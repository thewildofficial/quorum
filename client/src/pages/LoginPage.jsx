import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ErrorBox } from '../components/common.jsx';

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="brand-big">Delib<span style={{ color: 'var(--accent)' }}>erate</span></div>
      <div className="tag">Decide with your eyes open. Review with your feet on the ground.</div>
      <div className="card">
        <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
        <p className="sub">{mode === 'login' ? 'Welcome back.' : 'Your decisions stay private to your account.'}</p>
        <ErrorBox error={error} />
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Display name</label>
              <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            {mode === 'register' && <div className="hint">At least 8 characters.</div>}
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'One moment...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>No account yet? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(null); }}>Register</a></>
          ) : (
            <>Already have one? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null); }}>Log in</a></>
          )}
        </div>
      </div>
    </div>
  );
}
