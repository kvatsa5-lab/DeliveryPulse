"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Without this, an unexpected render error produced
 * a blank page with no way to recover.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Delivery Pulse render error:", error);
  }, [error]);

  return (
    <main className="app">
      <section className="body">
        <section className="panel empty">
          <p className="label">DELIVERY PULSE</p>
          <h2>This view hit an unexpected error.</h2>
          <p>
            Nothing was lost. Reloading this section usually clears it. If it keeps
            happening, share the reference below.
          </p>
          {error.digest && <p className="label">REFERENCE {error.digest}</p>}
          <button type="button" className="primary" onClick={reset}>
            Reload this section
          </button>
        </section>
      </section>
    </main>
  );
}
