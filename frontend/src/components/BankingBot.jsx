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
  const [loanOffer, setLoanOffer] = useState(null);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  const postToBot = async ({ text, historyForApi, loanDecision = null }) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('You are not signed in.');
      return null;
    }

    const response = await axios.post(
      BOT_API,
      {
        message: text,
        history: historyForApi,
        ...(loanDecision ? { loanDecision } : {}),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data;
  };

  const applyAssistantResponse = async (data) => {
    const assistantMessage = {
      role: 'assistant',
      content: data.reply || 'No response from assistant.',
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setLoanOffer(data.loanOffer ?? null);

    if (data.refreshDashboard && typeof onTransferComplete === 'function') {
      await onTransferComplete();
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = { role: 'user', content: text };
    const historyForApi = messages.filter((m) => m.role !== 'system');

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setLoading(true);
    scrollToBottom();

    // send the AI message to the backend and get the response 
    try {
      const data = await postToBot({ text, historyForApi });
      if (!data) return;
      await applyAssistantResponse(data);
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

  const handleLoanDecision = async (decision) => {
    if (loading || !loanOffer) return;

    const label = decision === 'accept' ? 'Yes, accept the loan' : 'No, cancel';
    const userMessage = { role: 'user', content: label };
    const historyForApi = messages.filter((m) => m.role !== 'system');

    setMessages((prev) => [...prev, userMessage]);
    setError('');
    setLoading(true);
    scrollToBottom();

    try {
      const data = await postToBot({
        text: label,
        historyForApi,
        loanDecision: decision,
      });
      if (!data) return;
      await applyAssistantResponse(data);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Could not reach the banking assistant.';
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
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

          {loanOffer && !loading && (
            <div className="chat-loan-offer" role="group" aria-label="Loan offer actions">
              <p className="chat-loan-offer__text">
                Loan needed: ${loanOffer.shortfall.toFixed(2)} for transfer of $
                {loanOffer.transferAmount.toFixed(2)} to {loanOffer.receiverEmail}
              </p>
              <div className="chat-loan-offer__actions">
                <button
                  type="button"
                  className="chat-loan-offer__btn chat-loan-offer__btn--accept"
                  onClick={() => handleLoanDecision('accept')}
                >
                  Yes, accept loan
                </button>
                <button
                  type="button"
                  className="chat-loan-offer__btn chat-loan-offer__btn--reject"
                  onClick={() => handleLoanDecision('reject')}
                >
                  No, cancel
                </button>
              </div>
            </div>
          )}

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
