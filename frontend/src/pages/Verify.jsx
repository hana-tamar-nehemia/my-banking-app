import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'https://bank-backend-frws.onrender.com/api/auth/verify';

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
  },
  title: {
    margin: '0 0 0.25rem',
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
  emailHint: {
    margin: '0 0 1.25rem',
    fontSize: '0.875rem',
    color: '#475569',
    background: '#f8fafc',
    padding: '0.65rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '0.65rem 0.75rem',
    fontSize: '1.25rem',
    letterSpacing: '0.35em',
    textAlign: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  error: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
  },
  warning: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  link: {
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none',
  },
};

export default function Verify() {
  const navigate = useNavigate();
  const email = localStorage.getItem('email');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasscodeChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPasscode(digitsOnly);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(API_URL, {
        email,
        passcode,
      });

      if (response.status === 200 && response.data.user) {
        const { user } = response.data;

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

        navigate('/dashboard');
      }
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Verification failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Verify your account</h1>
          <p style={styles.warning} role="alert">
            No email found. Please sign up first to receive a verification code.
          </p>
          <Link to="/signup" style={styles.link}>
            Go to Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Verify your account</h1>
        <p style={styles.subtitle}>
          Enter the 6-digit code we sent for your registration.
        </p>

        <p style={styles.emailHint}>
          Verifying: <strong>{email}</strong>
        </p>

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <form style={styles.form} onSubmit={handleSubmit} noValidate>
          <div style={styles.field}>
            <label htmlFor="passcode" style={styles.label}>
              6-digit passcode
            </label>
            <input
              id="passcode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={passcode}
              onChange={handlePasscodeChange}
              style={styles.input}
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading || passcode.length !== 6}
          >
            {loading ? 'Verifying…' : 'Verify Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
