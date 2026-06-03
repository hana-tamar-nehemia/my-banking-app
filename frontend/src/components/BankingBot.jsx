import { useCallback, useRef, useState } from 'react';
import axios from 'axios';

const BOT_API = 'https://bank-backend-frws.onrender.com/api/bot/chat';

const styles = {
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minHeight: '320px',
  },
  title: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#64748b',
  },
  messages: {
    flex: 1,
    minHeight: '200px',
    maxHeight: '360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0.5rem',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    padding: '0.65rem 0.85rem',
    background: '#2563eb',
    color: '#fff',
    borderRadius: '12px 12px 4px 12px',
    fontSize: '0.9rem',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    padding: '0.65rem 0.85rem',
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    borderRadius: '12px 12px 12px 4px',
    fontSize: '0.9rem',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  },
  form: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.65rem 0.75rem',
    fontSize: '0.95rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none',
  },
  button: {
    padding: '0.65rem 1rem',
    fontSize: '0.9rem',
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
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
  },
  empty: {
    margin: 'auto',
    fontSize: '0.85rem',
    color: '#94a3b8',
    textAlign: 'center',
  },
};

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Hi! I can check your balance, show recent transactions, or help you send money. What would you like to do?',
};

export default function BankingBot({ onTransferComplete }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('You are not signed in.');
      return;
    }

    const userMessage = { role: 'user', content: text };
    const historyForApi = messages.filter((m) => m.role !== 'system');

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setLoading(true);
    scrollToBottom();

    try {
      const response = await axios.post(
        BOT_API,
        {
          message: text,
          history: historyForApi,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const assistantMessage = {
        role: 'assistant',
        content: response.data.reply || 'No response from assistant.',
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.data.refreshDashboard && typeof onTransferComplete === 'function') {
        await onTransferComplete();
      }
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Could not reach the banking assistant.';
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <section style={styles.card} aria-label="AI banking assistant">
      <div>
        <h2 style={styles.title}>AI Banking Assistant</h2>
        <p style={styles.subtitle}>
          Secured to your account · Uses live balance &amp; transfer tools
        </p>
      </div>

      {error && (
        <div style={styles.error} role="alert">
          {error}
        </div>
      )}

      <div ref={listRef} style={styles.messages} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p style={styles.empty}>Start a conversation…</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              style={
                msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
              }
            >
              {msg.content}
            </div>
          ))
        )}
        {loading && (
          <div style={styles.bubbleAssistant} aria-busy="true">
            Thinking…
          </div>
        )}
      </div>

      <form style={styles.form} onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={styles.input}
          placeholder="Ask about your balance or send money…"
          disabled={loading}
          aria-label="Message to banking assistant"
        />
        <button
          type="submit"
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
