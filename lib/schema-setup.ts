import { env } from "cloudflare:workers";

import { SCHEMA_STATEMENTS } from "./constants/schema-ddl";

/**
 * Applies the D1 bootstrap DDL once per worker isolate.
 *
 * Previously each route kept its own `CREATE TABLE IF NOT EXISTS` list and ran
 * it on every request, so a page load fired ~15 redundant DDL statements. The
 * statements are idempotent, so we only need them once per isolate --
 * `ensureSchema()` memoises the in-flight promise and reuses it thereafter.
 *
 * The statements themselves live in `./constants/schema-ddl` so they can be
 * checked against `db/schema.ts` by a unit test; this module cannot be imported
 * outside a worker because of the `cloudflare:workers` dependency above.
 */
let bootstrap: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Reuse the in-flight promise so concurrent requests share one batch, and
  // reset on failure so a transient error does not poison the isolate.
  const existing = bootstrap;
  if (existing) return existing;

  const started = env.DB.batch(
    SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement))
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      bootstrap = null;
      throw error;
    });

  bootstrap = started;
  return started;
}
