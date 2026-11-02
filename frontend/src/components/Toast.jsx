import { useEffect } from "react";

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  const color = type === "error"
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";

  return (
    <div
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-4 rounded-xl border px-4 py-3 shadow-lg ${color}`}
      role={type === "error" ? "alert" : "status"}
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        aria-label="Dismiss notification"
        className="shrink-0 font-bold opacity-70 hover:opacity-100"
        onClick={onClose}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
