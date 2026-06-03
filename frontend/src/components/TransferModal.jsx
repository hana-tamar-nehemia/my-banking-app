export default function TransferModal({
  open,
  onClose,
  receiverEmail,
  onReceiverEmailChange,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  onSubmit,
  transferring,
  error,
}) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      onClick={onClose}
    >
      <div className="modal-panel transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel__header">
          <h2 id="transfer-modal-title" className="modal-panel__title">
            Send Money
          </h2>
          <button
            type="button"
            className="modal-panel__close"
            onClick={onClose}
            aria-label="Close transfer"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <form className="form-stack" onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="transfer-receiver">Receiver email</label>
            <input
              id="transfer-receiver"
              type="email"
              value={receiverEmail}
              onChange={(e) => onReceiverEmailChange(e.target.value)}
              placeholder="friend@example.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="transfer-amount">Amount ($)</label>
            <input
              id="transfer-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="100.00"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="transfer-reason">
              Reason for transfer{' '}
              <span className="label-optional">(Optional)</span>
            </label>
            <input
              id="transfer-reason"
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Dinner, rent, birthday gift"
              maxLength={200}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={transferring}>
            {transferring ? 'Sending…' : 'Confirm transfer'}
          </button>
        </form>
      </div>
    </div>
  );
}
