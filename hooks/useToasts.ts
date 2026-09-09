"use client";

import { useCallback, useState } from "react";

export type ToastTone = "success" | "error";

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

let nextId = 1;

/**
 * Small stacking notice queue. Replaces the previous single `message`/`error`
 * string pair, which meant a second event silently overwrote the first.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, text: string) => {
    const id = nextId++;
    setToasts((current) => [...current, { id, tone, text }]);
    // Successes are transient; errors stay until dismissed so they can be read.
    if (tone === "success") {
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 5000);
    }
  }, []);

  const success = useCallback((text: string) => push("success", text), [push]);
  const error = useCallback((text: string) => push("error", text), [push]);

  return { toasts, success, error, dismiss };
}
