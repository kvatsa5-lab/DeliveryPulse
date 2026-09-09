import { env } from "cloudflare:workers";

/**
 * Single source of truth for the D1 bootstrap DDL.
 *
 * Previously each route kept its own `CREATE TABLE IF NOT EXISTS` list and ran
 * it on every request, so a page load fired ~15 redundant DDL statements. The
 * statements are idempotent, so we only need them once per worker isolate --
 * `ensureSchema()` memoises the in-flight promise and reuses it thereafter.
 */
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS engagements (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, title TEXT NOT NULL, products TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, status TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS weekly_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL, week_of TEXT NOT NULL, progress TEXT NOT NULL, next_step TEXT NOT NULL, risk TEXT NOT NULL, submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS improvements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, owner TEXT NOT NULL, impact TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, product TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, approval TEXT NOT NULL, owner TEXT NOT NULL, reviewed_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbook_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, runbook_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS skill_assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, engineer TEXT NOT NULL, skill TEXT NOT NULL, rating TEXT NOT NULL, evidence TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)",
  // Indexes matching the actual query shapes used by the routes.
  "CREATE INDEX IF NOT EXISTS idx_engagements_status_updated ON engagements(status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_engagements_owner ON engagements(owner)",
  "CREATE INDEX IF NOT EXISTS idx_weekly_updates_engagement_week ON weekly_updates(engagement_id, week_of)",
  // Serves the correlated "latest update per engagement" subquery.
  "CREATE INDEX IF NOT EXISTS idx_weekly_updates_engagement_submitted ON weekly_updates(engagement_id, submitted_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_runbook_attachments_runbook_id ON runbook_attachments(runbook_id)",
  "CREATE INDEX IF NOT EXISTS idx_runbooks_reviewed_at ON runbooks(reviewed_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_improvements_created_at ON improvements(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_skill_assessments_updated_at ON skill_assessments(updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)",
];

let bootstrap: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Reuse the in-flight promise so concurrent requests share one batch, and
  // reset on failure so a transient error does not poison the isolate.
  const existing = bootstrap;
  if (existing) return existing;

  const started = env.DB.batch(
    STATEMENTS.map((statement) => env.DB.prepare(statement))
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      bootstrap = null;
      throw error;
    });

  bootstrap = started;
  return started;
}
