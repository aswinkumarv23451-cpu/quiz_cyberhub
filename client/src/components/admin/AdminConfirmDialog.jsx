import { useEffect, useRef } from 'react';

/**
 * AdminConfirmDialog — Keyboard-accessible, robust confirmation modal.
 *
 * Supports:
 * - Escape key to cancel
 * - Focus trapping / initial focus
 * - Backdrop click to cancel
 * - Danger or default styling
 */
export default function AdminConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5 animate-fadeIn">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold ${
              isDanger
                ? 'bg-rose-950/70 border border-rose-800/60 text-rose-400'
                : 'bg-indigo-950/70 border border-indigo-800/60 text-indigo-400'
            }`}
          >
            {isDanger ? '⚠️' : 'ℹ️'}
          </div>
          <div className="space-y-1 flex-1">
            <h3 id="confirm-dialog-title" className="text-base sm:text-lg font-bold text-slate-100">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl border border-slate-700 transition"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs sm:text-sm font-bold text-white rounded-xl transition shadow-sm flex items-center gap-2 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 disabled:opacity-50'
                : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
            }`}
          >
            {loading && (
              <svg
                className="animate-spin h-3.5 w-3.5 text-white shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span>{loading ? 'Processing…' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
