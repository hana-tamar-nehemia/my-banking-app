import { useCallback, useRef, useState } from 'react';
import axios from 'axios';

const BOT_API = 'https://bank-backend-frws.onrender.com/api/bot/chat';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Hi! I can check your balance, show recent transactions, or help you send money. What would you like to do?',
};

export default function BankingBot({ onTransferComplete }) {
  const [open, setOpen] = useState(false);
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
    <>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="AI banking assistant">
          <header className="chat-panel__header">
            <div>
              <p className="chat-panel__title">AI Banking Assistant</p>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Secured to your account
              </p>
            </div>
            <button
              type="button"
              className="chat-panel__close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          {error && (
            <div className="alert-error" style={{ margin: '0.5rem 0.75rem 0' }} role="alert">
              {error}
            </div>
          )}

          <div ref={listRef} className="chat-messages" role="log" aria-live="polite">
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={
                  msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--bot'
                }
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble--bot" aria-busy="true">
                Thinking…
              </div>
            )}
          </div>

          <form className="chat-input-row" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about balance or send money…"
              disabled={loading}
              aria-label="Message to banking assistant"
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close banking assistant' : 'Open banking assistant'}
        aria-expanded={open}
      >
        {open ? '×' : '✦'}
      </button>
    </>
  );
}
