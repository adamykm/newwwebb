import './AuthPage.css';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />
      <div className="auth-container animate-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">◈</div>
          <h1>NEXUS HUB</h1>
          <p>Futuristic community workspace</p>
        </div>

        <form className="auth-form glass-panel" onSubmit={submit}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          {error && <div className="auth-error">{error}</div>}

          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>

          {mode === 'register' && (
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoComplete="username" />
            </label>
          )}

          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <p className="auth-switch">
            {mode === 'login' ? (
              <>No account? <Link to="/register">Sign up free</Link></>
            ) : (
              <>Already have one? <Link to="/login">Sign in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
