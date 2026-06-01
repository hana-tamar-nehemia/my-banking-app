import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'https://bank-backend-frws.onrender.com/api/auth/verify';
const RESEND_URL = 'https://bank-backend-frws.onrender.com/api/auth/resend-verification';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'linear-gradient(160deg, #f0f4f8 0%, #e8eef5 100%)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '2rem',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 0.5rem',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    fontSize: '0.95rem',
    color: '#64748b',
    lineHeight: 1.5,
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '1rem auto',
    border: '4px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'verify-spin 0.8s linear infinite',
  },
  success: {
    fontSize: '2.5rem',
    lineHeight: 1,
    margin: '0.5rem 0 1rem',
  },
  error: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  button: {
    display: 'inline-block',
    marginTop: '0.5rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  link: {
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none',
  },
  resendRow: {
    marginTop: '1rem',
    fontSize: '0.875rem',
    color: '#64748b',
  },
  resendButton: {
    marginTop: '0.75rem',
    padding: '0.6rem 1.25rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#2563eb',
    background: '#fff',
    border: '1px solid #2563eb',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  notice: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#166534',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
};

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
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Could not resend the link. Please try again later.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!token || hasRun.current) {
      return;
    }
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
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Verification failed. The link may be invalid or expired.';
        setError(message);
        setStatus(STATUS.ERROR);
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div style={styles.page}>
      <style>{'@keyframes verify-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={styles.card}>
        {status === STATUS.MISSING && (
          <>
            <h1 style={styles.title}>Invalid link</h1>
            <p style={styles.subtitle}>
              This verification link is missing its token. Use the link from
              your email, request a new one below, or sign up again.
            </p>
            {resendMessage && (
              <div style={styles.notice} role="status">
                {resendMessage}
              </div>
            )}
            {error && (
              <div style={styles.error} role="alert">
                {error}
              </div>
            )}
            {email && (
              <div style={styles.resendRow}>
                Didn&apos;t get an email for <strong>{email}</strong>?
                <br />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    ...styles.resendButton,
                    ...(resending ? styles.buttonDisabled : {}),
                  }}
                >
                  {resending ? 'Sending…' : 'Resend verification link'}
                </button>
              </div>
            )}
            <p style={styles.resendRow}>
              <Link to="/signup" style={styles.link}>
                Go to Sign up
              </Link>
            </p>
          </>
        )}

        {status === STATUS.VERIFYING && (
          <>
            <h1 style={styles.title}>Verifying your account</h1>
            <div style={styles.spinner} aria-hidden="true" />
            <p style={styles.subtitle}>
              Hang tight while we confirm your magic link…
            </p>
          </>
        )}

        {status === STATUS.SUCCESS && (
          <>
            <div style={styles.success} aria-hidden="true">
              ✓
            </div>
            <h1 style={styles.title}>Account verified!</h1>
            <p style={styles.subtitle}>
              You&apos;re all set. Redirecting you to your dashboard…
            </p>
          </>
        )}

        {status === STATUS.ERROR && (
          <>
            <h1 style={styles.title}>Verification failed</h1>
            {resendMessage ? (
              <div style={styles.notice} role="status">
                {resendMessage}
              </div>
            ) : (
              <div style={styles.error} role="alert">
                {error}
              </div>
            )}
            <p style={styles.subtitle}>
              Your link may have expired. Links are valid for 15 minutes.
            </p>
            {email && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                style={{
                  ...styles.button,
                  ...(resending ? styles.buttonDisabled : {}),
                }}
              >
                {resending ? 'Sending…' : 'Resend verification link'}
              </button>
            )}
            <p style={styles.resendRow}>
              <Link to="/signup" style={styles.link}>
                Or sign up again
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
