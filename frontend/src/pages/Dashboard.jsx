import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';

const API_BASE = 'https://bank-backend-frws.onrender.com/api/bank';

const styles = {
  page: {
    minHeight: '100vh',
    padding: '1.5rem',
    background: 'linear-gradient(160deg, #f0f4f8 0%, #e8eef5 100%)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  header: {
    maxWidth: '720px',
    margin: '0 auto 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  signOut: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#334155',
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '1.5rem',
  },
  cardTitle: {
    margin: '0 0 1rem',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  greeting: {
    margin: '0 0 0.25rem',
    fontSize: '0.95rem',
    color: '#64748b',
  },
  balance: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 700,
    color: '#2563eb',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
    fontSize: '1rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none',
  },
  button: {
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
    marginBottom: '1rem',
  },
  success: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#166534',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  transactionList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  transactionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  amountSent: {
    fontWeight: 700,
    color: '#dc2626',
  },
  amountReceived: {
    fontWeight: 700,
    color: '#16a34a',
  },
  transactionMeta: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  empty: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#94a3b8',
  },
  loading: {
    textAlign: 'center',
    color: '#64748b',
    padding: '2rem',
  },
};

function getStoredUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [balance, setBalance] = useState(null);
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  // Reusable fetch so we can refresh on mount and whenever a live notification arrives.
  const refreshDashboard = useCallback(async () => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem('token');
    if (!storedUser?._id || !storedToken) return;

    try {
      const response = await axios.get(
        `${API_BASE}/dashboard/${storedUser._id}`,
        {
          headers: { Authorization: `Bearer ${storedToken}` } // הזרקת ה-JWT החתום
        }
      );
      setUsername(response.data.username);
      setEmail(response.data.email);
      setBalance(response.data.balance);
      setRecentTransactions(response.data.transactions || []);

      localStorage.setItem(
        'user',
        JSON.stringify({
          ...storedUser,
          username: response.data.username,
          email: response.data.email,
          balance: response.data.balance,
        })
      );
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to load dashboard.';
      setError(message);
      if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404) {
        localStorage.clear();
        navigate('/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem('token');

    // אם חסר יוזר או טוקן בזיכרון, זורקים ישירות למסך התחברות
    if (!storedUser?._id || !storedToken) {
      localStorage.clear();
      navigate('/login');
      return;
    }

    setUserId(storedUser._id);
    setToken(storedToken);

    refreshDashboard().finally(() => setLoading(false));
  }, [navigate, refreshDashboard]);

  const handleSignOut = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTransferring(true);

    const numericAmount = Number(amount);
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(
        `${API_BASE}/transaction`,
        {
          receiverEmail: receiverEmail.trim().toLowerCase(),
          amount: numericAmount,
        },
        {
          headers: { Authorization: `Bearer ${token}` } // הזרקת ה-JWT המאבטח את ההעברה
        }
      );

      if (response.status === 200 && response.data.transaction) {
        const transaction = response.data.transaction;

        const dashboardRes = await axios.get(
          `${API_BASE}/dashboard/${userId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setBalance(dashboardRes.data.balance);

        const storedUser = getStoredUser();
        if (storedUser) {
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...storedUser,
              balance: dashboardRes.data.balance,
            })
          );
        }

        setRecentTransactions((prev) => [transaction, ...prev]);
        setReceiverEmail('');
        setAmount('');
        setSuccess(response.data.message || 'Transaction successful');
      }
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Transfer failed. Please try again.';
      setError(message);
    } finally {
      setTransferring(false);
    }
  };

  const formatTransactionAmount = (transaction) => {
    const isSender = transaction.senderId === userId;
    const prefix = isSender ? '-' : '+';
    const style = isSender ? styles.amountSent : styles.amountReceived;
    return (
      <span style={style}>
        {prefix}${transaction.amount.toFixed(2)}
      </span>
    );
  };

  const formatTransactionLabel = (transaction) => {
    const isSender = transaction.senderId === userId;
    return isSender ? 'Sent' : 'Received';
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.loading}>Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationCenter token={token} onNewNotification={refreshDashboard} />
          <button type="button" style={styles.signOut} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={styles.container}>
        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}
        {success && (
          <div style={styles.success} role="status">
            {success}
          </div>
        )}

        <section style={styles.card}>
          <p style={styles.greeting}>Welcome, {username}</p>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: '#64748b' }}>
            {email}
          </p>
          <p style={styles.cardTitle}>Account balance</p>
          <p style={styles.balance}>
            ${balance !== null ? balance.toFixed(2) : '—'}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Send Money</h2>
          <form style={styles.form} onSubmit={handleTransfer} noValidate>
            <div style={styles.field}>
              <label htmlFor="receiverEmail" style={styles.label}>
                Receiver email
              </label>
              <input
                id="receiverEmail"
                type="email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
                style={styles.input}
                placeholder="friend@example.com"
                required
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="amount" style={styles.label}>
                Amount
              </label>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={styles.input}
                placeholder="100.00"
                required
              />
            </div>

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(transferring ? styles.buttonDisabled : {}),
              }}
              disabled={transferring}
            >
              {transferring ? 'Sending…' : 'Send Money'}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Recent transactions</h2>
          {recentTransactions.length === 0 ? (
            <p style={styles.empty}>No transactions yet.</p>
          ) : (
            <ul style={styles.transactionList}>
              {recentTransactions.map((tx) => (
                <li key={tx.id} style={styles.transactionItem}>
                  <div>
                    <strong>{formatTransactionLabel(tx)}</strong>
                    <p style={styles.transactionMeta}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {formatTransactionAmount(tx)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}