export default function ReceiptModal({ open, receipt, onClose }) {
  if (!open || !receipt) return null;

  const formattedTime = new Date(receipt.timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={onClose}
    >
      <div className="modal-panel receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-modal__badge" aria-hidden="true">
          ✓
        </div>
        <h2 id="receipt-modal-title" className="modal-panel__title receipt-modal__title">
          Transfer successful
        </h2>
        <p className="receipt-modal__subtitle">Your payment has been processed.</p>

        <dl className="receipt-details">
          <div className="receipt-details__row">
            <dt>Sender</dt>
            <dd>{receipt.senderEmail}</dd>
          </div>
          <div className="receipt-details__row">
            <dt>Receiver</dt>
            <dd>{receipt.receiverEmail}</dd>
          </div>
          <div className="receipt-details__row">
            <dt>Amount</dt>
            <dd className="receipt-details__amount">
              ${Number(receipt.amount).toFixed(2)}
            </dd>
          </div>
          <div className="receipt-details__row">
            <dt>Date &amp; time</dt>
            <dd>{formattedTime}</dd>
          </div>
          <div className="receipt-details__row">
            <dt>Reason</dt>
            <dd>{receipt.reason?.trim() ? receipt.reason : '—'}</dd>
          </div>
        </dl>

        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
