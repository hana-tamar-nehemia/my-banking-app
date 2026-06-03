import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import BankLogo, { BankWatermark } from '../components/BankLogo';

const API_URL = 'https://bank-backend-frws.onrender.com/api/auth/verify';
const RESEND_URL = 'https://bank-backend-frws.onrender.com/api/auth/resend-verification';

const STATUS = {
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  ERROR: 'error',
  MISSING: 'missing',
};

export default function Verify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState(token ? STATUS.VERIFYING : STATUS.MISSING);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const hasRun = useRef(false);

  const email = localStorage.getItem('email');

  const handleResend = async () => {
    setResendMessage('');
    setError('');

    if (!email) {
      setError('We could not find your email. Please sign up again.');
      return;
    }

    setResending(true);
    try {
      const response = await axios.post(RESEND_URL, { email });
      setResendMessage(
        response.data?.message || 'A new verification link has been sent.'
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Could not resend the link. Please try again later.'
      );
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;

    const verifyToken = async () => {
      try {
        const response = await axios.post(API_URL, { token });

        if (response.status === 200 && response.data.user) {
          const { user, token: authToken } = response.data;

          if (authToken) {
            localStorage.setItem('token', authToken);
          }

          localStorage.removeItem('email');
          localStorage.setItem(
            'user',
            JSON.stringify({
              _id: String(user._id),
              username: user.username,
              email: user.email,
              balance: user.balance,
            })
          );

          setStatus(STATUS.SUCCESS);
          setTimeout(() => navigate('/dashboard'), 1500);
        }
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            'Verification failed. The link may be invalid or expired.'
        );
        setStatus(STATUS.ERROR);
      }
    };

    verifyToken();
  }, [token, navigate]);

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
          <Link to="/login" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Login
          </Link>
        </header>

        <div className="glass-card glass-card--compact" style={{ textAlign: 'center' }}>
          {status === STATUS.MISSING && (
            <>
              <h1 className="auth-form__title">Invalid link</h1>
              <p className="auth-form__subtitle">
                This verification link is missing its token. Use the link from your
                email, request a new one below, or create a new account.
              </p>
              {resendMessage && (
                <div className="alert-success" role="status">
                  {resendMessage}
                </div>
              )}
              {error && (
                <div className="alert-error" role="alert">
                  {error}
                </div>
              )}
              {email && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Didn&apos;t get an email for <strong>{email}</strong>?
                  <br />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '0.75rem', width: 'auto', padding: '0.65rem 1.25rem' }}
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? 'Sending…' : 'Resend verification link'}
                  </button>
                </p>
              )}
              <p className="auth-form__footer">
                <Link to="/signup" className="btn-text" style={{ textDecoration: 'none' }}>
                  Create New Account
                </Link>
              </p>
            </>
          )}

          {status === STATUS.VERIFYING && (
            <>
              <h1 className="auth-form__title">Verifying your account</h1>
              <div className="spinner" aria-hidden="true" />
              <p className="auth-form__subtitle">
                Hang tight while we confirm your magic link…
              </p>
            </>
          )}

          {status === STATUS.SUCCESS && (
            <>
              <p style={{ fontSize: '2.5rem', margin: '0.5rem 0' }} aria-hidden="true">
                ✓
              </p>
              <h1 className="auth-form__title">Account verified!</h1>
              <p className="auth-form__subtitle">
                You&apos;re all set. Redirecting you to your dashboard…
              </p>
            </>
          )}

          {status === STATUS.ERROR && (
            <>
              <h1 className="auth-form__title">Verification failed</h1>
              {resendMessage ? (
                <div className="alert-success" role="status">
                  {resendMessage}
                </div>
              ) : (
                <div className="alert-error" role="alert">
                  {error}
                </div>
              )}
              <p className="auth-form__subtitle">
                Your link may have expired. Links are valid for 15 minutes.
              </p>
              {email && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? 'Sending…' : 'Resend verification link'}
                </button>
              )}
              <p className="auth-form__footer">
                <Link to="/signup" className="btn-text" style={{ textDecoration: 'none' }}>
                  Create New Account
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
