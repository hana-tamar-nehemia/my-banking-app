const GUIDE_ITEMS = [
  {
    title: 'Send money',
    body: 'Use the transfer form below your balance, or tap a contact in Quick Transfer to pre-fill their email. Enter an amount and confirm.',
  },
  {
    title: 'Quick Transfer',
    body: 'People you have sent to or received from appear as avatars under your balance. Tap one to start a transfer to them instantly.',
  },
  {
    title: 'AI banking assistant',
    body: 'Tap the chat button at the bottom-right to ask about your balance, recent activity, or to send money in natural language.',
  },
  {
    title: 'Notifications',
    body: 'The bell icon shows incoming transfers in real time. Your balance and transaction list refresh automatically when money arrives.',
  },
];

export default function UserGuideModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel__header">
          <h2 id="guide-title" className="modal-panel__title">
            Quick guide
          </h2>
          <button
            type="button"
            className="modal-panel__close"
            onClick={onClose}
            aria-label="Close guide"
          >
            ×
          </button>
        </div>
        {GUIDE_ITEMS.map((item) => (
          <div key={item.title} className="guide-item">
            <h4>{item.title}</h4>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
