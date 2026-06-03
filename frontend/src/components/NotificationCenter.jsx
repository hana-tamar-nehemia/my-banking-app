import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'https://bank-backend-frws.onrender.com';
const API_URL = `${SERVER_URL}/api/notifications`;

// How many unread notifications are surfaced as floating toasts at once.
const MAX_TOASTS = 4;

const styles = {
  bellWrapper: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.15rem',
    color: '#0f172a',
    background: 'rgba(255, 255, 255, 0.75)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(15, 23, 42, 0.06)',
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    minWidth: '20px',
    height: '20px',
    padding: '0 5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#fff',
    background: '#f43f5e',
    borderRadius: '999px',
    boxSizing: 'border-box',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '340px',
    maxHeight: '420px',
    overflowY: 'auto',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    zIndex: 50,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
    position: 'sticky',
    top: 0,
    background: 'rgba(255, 255, 255, 0.95)',
  },
  panelTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    color: '#0f172a',
  },
  markAll: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#0f172a',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  panelEmpty: {
    padding: '1.5rem 1rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(15, 23, 42, 0.05)',
  },
  rowUnread: {
    background: '#fef9c3',
  },
  rowMessage: {
    margin: '0 0 0.2rem',
    fontSize: '0.88rem',
    color: '#0f172a',
    lineHeight: 1.35,
  },
  rowMeta: {
    margin: 0,
    fontSize: '0.72rem',
    color: '#94a3b8',
  },
  rowClose: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    color: '#64748b',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  toastContainer: {
    position: 'fixed',
    left: '1.25rem',
    bottom: '6.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    zIndex: 999,
    maxWidth: '340px',
  },
  toast: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    padding: '0.9rem 1rem',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
    borderLeft: '4px solid #10b981',
    animation: 'notif-slide-in 0.25s ease-out',
  },
  toastIcon: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  toastBody: {
    flex: 1,
  },
  toastTitle: {
    margin: '0 0 0.15rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  toastMessage: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#475569',
    lineHeight: 1.35,
  },
  toastClose: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    color: '#64748b',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    lineHeight: 1,
  },
};

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export default function NotificationCenter({ token, onNewNotification }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // Load persisted notifications once on mount (survives logins/devices).
  useEffect(() => {
    if (!token) return;
    let active = true;

    axios
      .get(API_URL, authHeaders(token))
      .then((res) => {
        if (active) setNotifications(res.data.notifications || []);
      })
      .catch((err) => console.error('Failed to load notifications:', err));

    return () => {
      active = false;
    };
  }, [token]);

  // Live updates via Socket.IO.
  useEffect(() => {
    if (!token) return;

    const socket = io(SERVER_URL, { auth: { token } });

    socket.on('transfer:received', (notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      if (onNewNotification) onNewNotification(notification);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, onNewNotification]);

  // Close the panel when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unread = notifications.filter((n) => !n.read);
  const toasts = unread.slice(0, MAX_TOASTS);

  // Toast X: dismiss the floating toast but keep it in history (mark read).
  const dismissToast = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await axios.patch(`${API_URL}/${id}/read`, {}, authHeaders(token));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // List X: delete the notification permanently.
  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await axios.delete(`${API_URL}/${id}`, authHeaders(token));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const markAllRead = async () => {
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await axios.patch(`${API_URL}/read-all`, {}, authHeaders(token));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <>
      <style>
        {'@keyframes notif-slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }'}
      </style>
      <div style={styles.bellWrapper}>
        <button
          type="button"
          ref={bellRef}
          style={styles.bellButton}
          onClick={() => setOpen((v) => !v)}
          aria-label="Notifications"
        >
          🔔
          {unread.length > 0 && (
            <span style={styles.badge}>
              {unread.length > 99 ? '99+' : unread.length}
            </span>
          )}
        </button>

        {open && (
          <div style={styles.panel} ref={panelRef}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Notifications</h3>
              {unread.length > 0 && (
                <button type="button" style={styles.markAll} onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p style={styles.panelEmpty}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    ...styles.row,
                    ...(n.read ? {} : styles.rowUnread),
                  }}
                >
                  <div>
                    <p style={styles.rowMessage}>{n.message}</p>
                    <p style={styles.rowMeta}>
                      {new Date(n.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    style={styles.rowClose}
                    onClick={() => deleteNotification(n.id)}
                    aria-label="Delete notification"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={styles.toastContainer}>
        {toasts.map((n) => (
          <div key={n.id} style={styles.toast}>
            <span style={styles.toastIcon}>💰</span>
            <div style={styles.toastBody}>
              <p style={styles.toastTitle}>Money received</p>
              <p style={styles.toastMessage}>{n.message}</p>
            </div>
            <button
              type="button"
              style={styles.toastClose}
              onClick={() => dismissToast(n.id)}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
