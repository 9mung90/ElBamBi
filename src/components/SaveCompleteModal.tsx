function SaveCompleteModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="save-complete-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="save-complete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="save-complete-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="save-complete-modal-icon" aria-hidden="true">
          ✓
        </span>
        <strong id="save-complete-modal-title">{message}</strong>
        <button type="button" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}

export default SaveCompleteModal;
