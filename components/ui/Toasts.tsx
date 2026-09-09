"use client";

import type { Toast } from "@/hooks/useToasts";

export function Toasts({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;

  return (
    // Announce changes so a screen-reader user hears the result of a submit.
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`notice${toast.tone === "error" ? " error" : ""}`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
