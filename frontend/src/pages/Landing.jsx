import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import BankLogo, { BankWatermark } from '../components/BankLogo';

const LOGIN_URL = 'https://bank-backend-frws.onrender.com/api/auth/login';
const SIGNUP_URL = 'https://bank-backend-frws.onrender.com/api/auth/signup';

const VIEWS = {
  HERO: 'hero',
  LOGIN: 'login',
  REGISTER: 'register',
};

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(VIEWS.HERO);

  useEffect(() => {
    if (searchParams.get('register') === '1') {
      setView(VIEWS.REGISTER);
    } else if (location.pathname === '/login') {
      setView(VIEWS.LOGIN);
    }
  }, [searchParams, location.pathname]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const resetError = () => setError('');

  const handleLogin = async (e) => {
    e.preventDefault();
    resetError();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await axios.post(LOGIN_URL, {
        email: normalizedEmail,
        password,
      });

      if (response.status === 200 && response.data.user) {
        const { user, token } = response.data;
        if (token) localStorage.setItem('token', token);
        localStorage.setItem(
          'user',
          JSON.stringify({
            _id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
          })
        );
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.response?.status === 403) {
        localStorage.setItem('email', normalizedEmail);
        navigate('/verify');
        return;
      }
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    resetError();
    setLoading(true);

    try {
      const response = await axios.post(
        SIGNUP_URL,
        { username, email, password },
        { timeout: 25000 }
      );

      if (response.status === 201) {
        localStorage.setItem('email', email.trim().toLowerCase());
        navigate('/verify');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__blobs" aria-hidden="true">
        <div className="auth-page__blob auth-page__blob--1" />
        <div className="auth-page__blob auth-page__blob--2" />
        <div className="auth-page__blob auth-page__blob--3" />
      </div>
      <BankWatermark />

      <div className="auth-page__inner">
        <header className="auth-topbar">
          <BankLogo />
          {view === VIEWS.HERO ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                resetError();
                setView(VIEWS.LOGIN);
              }}
            >
              Login
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                resetError();
                setView(VIEWS.HERO);
              }}
            >
              Back
            </button>
          )}
        </header>

        <div className="glass-card">
          {view === VIEWS.HERO && (
            <>
              <h1 className="auth-hero__title">
                Get a card you can control with transparency
              </h1>
              <p className="auth-hero__subtitle">
                Open an account in a few clicks. No need to deposit any money now.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  resetError();
                  setView(VIEWS.REGISTER);
                }}
              >
                Open account with us
              </button>
              <p className="auth-form__footer" style={{ marginTop: '1.25rem' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    resetError();
                    setView(VIEWS.LOGIN);
                  }}
                >
                  Login
                </button>
              </p>
            </>
          )}

          {view === VIEWS.LOGIN && (
            <>
              <h2 className="auth-form__title">Welcome back</h2>
              <p className="auth-form__subtitle">Sign in to your account</p>
              {error && (
                <div className="alert-error" role="alert">
                  {error}
                </div>
              )}
              <form className="form-stack" onSubmit={handleLogin} noValidate>
                <div className="form-field">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Signing in…' : 'Log in'}
                </button>
              </form>
              <p className="auth-form__footer">
                New here?{' '}
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    resetError();
                    setView(VIEWS.REGISTER);
                  }}
                >
                  Create New Account
                </button>
              </p>
            </>
          )}

          {view === VIEWS.REGISTER && (
            <>
              <h2 className="auth-form__title">Create New Account</h2>
              <p className="auth-form__subtitle">
                Sign up to start banking with vibe.bank//
              </p>
              {error && (
                <div className="alert-error" role="alert">
                  {error}
                </div>
              )}
              <form className="form-stack" onSubmit={handleSignup} noValidate>
                <div className="form-field">
                  <label htmlFor="signup-username">Username</label>
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="jane_doe"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="signup-email">Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="signup-password">Password</label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create New Account'}
                </button>
              </form>
              <p className="auth-form__footer">
                Already registered?{' '}
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    resetError();
                    setView(VIEWS.LOGIN);
                  }}
                >
                  Login
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
