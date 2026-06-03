import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';
import BankingBot from '../components/BankingBot';
import BankLogo from '../components/BankLogo';
import UserGuideModal from '../components/UserGuideModal';
import TransferModal from '../components/TransferModal';
import ReceiptModal from '../components/ReceiptModal';
import { extractContactsFromTransactions } from '../utils/contacts';

const API_BASE = 'https://bank-backend-frws.onrender.com/api/bank';

function getStoredUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getUserInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [balance, setBalance] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const refreshDashboard = useCallback(async () => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem('token');
    if (!storedUser?._id || !storedToken) return;

    try {
      const response = await axios.get(
        `${API_BASE}/dashboard/${storedUser._id}`,
        {
          headers: { Authorization: `Bearer ${storedToken}` },
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
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        err.response?.status === 404
      ) {
        localStorage.clear();
        navigate('/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem('token');

    if (!storedUser?._id || !storedToken) {
      localStorage.clear();
      navigate('/login');
      return;
    }

    setUserId(storedUser._id);
    setToken(storedToken);
    refreshDashboard().finally(() => setLoading(false));
  }, [navigate, refreshDashboard]);

  const contacts = useMemo(
    () =>
      extractContactsFromTransactions(recentTransactions, userId, email),
    [recentTransactions, userId, email]
  );

  const handleSignOut = () => {
    localStorage.clear();
    navigate('/login');
  };

  const openTransfer = (prefillEmail = '') => {
    setTransferError('');
    setReceiverEmail(prefillEmail);
    setAmount('');
    setReason('');
    setTransferOpen(true);
  };

  const closeTransfer = () => {
    if (transferring) return;
    setTransferOpen(false);
    setTransferError('');
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferring(true);

    const numericAmount = Number(amount);
    const authToken = localStorage.getItem('token');

    try {
      const response = await axios.post(
        `${API_BASE}/transaction`,
        {
          receiverEmail: receiverEmail.trim().toLowerCase(),
          amount: numericAmount,
          reason: reason.trim() || undefined,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (response.status === 200 && response.data.transaction) {
        const tx = response.data.transaction;
        setTransferOpen(false);
        setReceipt({
          senderEmail: tx.senderEmail || email,
          receiverEmail: tx.receiverEmail || receiverEmail.trim().toLowerCase(),
          amount: tx.amount,
          timestamp: tx.timestamp,
          reason: tx.reason,
        });

        await refreshDashboard();
      }
    } catch (err) {
      setTransferError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Transfer failed. Please try again.'
      );
    } finally {
      setTransferring(false);
    }
  };

  const formatTxParty = (tx) => {
    if (tx.counterpartyEmail) return tx.counterpartyEmail;
    if (tx.counterpartyUsername) return tx.counterpartyUsername;
    return tx.type === 'sent' ? 'Outgoing transfer' : 'Incoming transfer';
  };

  const formatTxAmount = (tx) => {
    const isOutgoing = tx.type === 'sent' || tx.senderId === userId;
    const prefix = isOutgoing ? '-' : '+';
    const className = isOutgoing
      ? 'tx-row__amount tx-row__amount--out'
      : 'tx-row__amount tx-row__amount--in';
    return (
      <span className={className}>
        {prefix}${Number(tx.amount).toFixed(2)}
      </span>
    );
  };

  if (loading) {
    return <div className="loading-screen">Loading your dashboard…</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard__shell">
        <header className="dashboard__header">
          <div className="dashboard__header-left">
            <BankLogo compact />
            <div
              className="dashboard__avatar"
              aria-hidden="true"
              title={username}
            >
              {getUserInitials(username)}
            </div>
            <p className="dashboard__greeting">Hi, {username}!</p>
          </div>
          <div className="dashboard__header-right">
            <NotificationCenter token={token} onNewNotification={refreshDashboard} />
            <button
              type="button"
              className="dashboard__icon-btn"
              onClick={() => setGuideOpen(true)}
              aria-label="Open user guide"
              title="Quick guide"
            >
              ⓘ
            </button>
            <button
              type="button"
              className="dashboard__sign-out"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </header>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <section className="balance-card balance-card--centered" aria-label="Account balance">
          <p className="balance-card__label">Account Balance</p>
          <p className="balance-card__amount">
            ${balance !== null ? balance.toFixed(2) : '—'}
          </p>
        </section>

        <section className="card-white" aria-label="Quick transfer">
          <div className="card-white__header">
            <h2 className="card-white__title">Quick Transfer</h2>
            <button
              type="button"
              className="btn-send-money"
              onClick={() => openTransfer()}
            >
              Send Money
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="empty-hint">
              Your recent contacts will appear here after your first transfer.
            </p>
          ) : (
            <div
              className="contacts-scroll"
              role="list"
              aria-label="Quick transfer contacts"
            >
              {contacts.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  className="contact-chip"
                  role="listitem"
                  onClick={() => openTransfer(c.email)}
                  title={`Send to ${c.email}`}
                >
                  <span className="contact-chip__avatar">{c.initials}</span>
                  <span className="contact-chip__name">{c.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card-surface" aria-labelledby="tx-heading">
          <h2 id="tx-heading" className="card-surface__title">
            Latest Transactions
          </h2>
          {recentTransactions.length === 0 ? (
            <p className="empty-hint">No transactions yet.</p>
          ) : (
            <ul className="tx-list">
              {recentTransactions.map((tx) => (
                <li key={tx.id} className="tx-row">
                  <div>
                    <p className="tx-row__party">{formatTxParty(tx)}</p>
                    {tx.reason && (
                      <p className="tx-row__reason">{tx.reason}</p>
                    )}
                    <p className="tx-row__time">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {formatTxAmount(tx)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TransferModal
        open={transferOpen}
        onClose={closeTransfer}
        receiverEmail={receiverEmail}
        onReceiverEmailChange={setReceiverEmail}
        amount={amount}
        onAmountChange={setAmount}
        reason={reason}
        onReasonChange={setReason}
        onSubmit={handleTransfer}
        transferring={transferring}
        error={transferError}
      />

      <ReceiptModal
        open={Boolean(receipt)}
        receipt={receipt}
        onClose={() => setReceipt(null)}
      />

      <BankingBot onTransferComplete={refreshDashboard} />
      <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
