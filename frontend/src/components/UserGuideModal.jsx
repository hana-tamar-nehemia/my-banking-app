const GUIDE_ITEMS = [
  {
    title: 'Send money',
    body: 'Tap Send Money or a contact avatar in Quick Transfer to open the transfer window. Add an optional reason, confirm, and review your receipt.',
  },
  {
    title: 'Quick Transfer',
    body: 'People you have sent to or received from appear as avatars in the white Quick Transfer card. Tap one to open the transfer modal with their email pre-filled.',
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
