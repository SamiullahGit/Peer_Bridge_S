import '../styles/successPopup.css';

// Floating confirmation popup with an animated green tick.
// Render it conditionally and remove after ~2.5s (the CSS fades it at 2.2s).
export default function SuccessPopup({ message = 'Done!' }) {
  return (
    <div className="pb-success-pop" role="status" aria-live="polite">
      <span className="pb-check">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4 10-10" />
        </svg>
      </span>
      <span>{message}</span>
    </div>
  );
}
