"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared modal shell: focus trap, Escape to close, backdrop click to close, and
 * an accessible dialog role. The previous inline overlays had none of this, so a
 * keyboard user could tab out of the dialog into the page behind it.
 */
export function Modal({
  label,
  title,
  onClose,
  onSubmit,
  children,
  footer,
}: {
  label: string;
  title: string;
  onClose: () => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog so the first field is immediately usable.
    const firstField = dialogRef.current?.querySelector<HTMLElement>(
      "input, textarea, select"
    );
    (firstField ?? dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="overlay">
      {/*
        A real <button> for the backdrop rather than a click handler on the
        overlay div: it is keyboard reachable and needs no extra ARIA. It sits
        behind the dialog and is skipped by the focus trap via tabIndex={-1}.
      */}
      <button
        type="button"
        className="overlay-backdrop"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
      />
      <form
        className="modal"
        ref={dialogRef}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
        <p className="label">{label}</p>
        <h2>{title}</h2>
        {children}
        <footer>{footer}</footer>
      </form>
    </div>
  );
}

/** Cancel + submit pair, with the submit button disabled while in flight. */
export function ModalActions({
  onCancel,
  submitLabel,
  pending,
}: {
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  return (
    <>
      <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button type="submit" className="primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </>
  );
}

/** Inline per-field validation message driven by the API's `fields` map. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <small className="field-error" role="alert">
      {message}
    </small>
  );
}
