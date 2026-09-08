/**
 * The D1 bootstrap DDL, kept in a dependency-free module.
 *
 * This lives apart from `lib/schema-setup.ts` because that module imports
 * `cloudflare:workers` and therefore cannot be loaded outside a worker isolate.
 * Holding the statements here lets `tests/unit/schema-ddl.test.mjs` check them
 * against `db/schema.ts` in plain Node.
 *
 * IMPORTANT: this array -- not `drizzle/` -- is what actually creates tables.
 * The generated migrations in `drizzle/` are applied by nothing; there is no
 * `wrangler d1 migrations apply` step and no driver configured in
 * drizzle.config.ts. `db/schema.ts` still has to match, because the routes build
 * their queries from it, so the two are checked against each other by the test.
 */
export const SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS engagements (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, title TEXT NOT NULL, products TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, status TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS weekly_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL, week_of TEXT NOT NULL, progress TEXT NOT NULL, next_step TEXT NOT NULL, risk TEXT NOT NULL, submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS improvements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, owner TEXT NOT NULL, impact TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, product TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, approval TEXT NOT NULL, owner TEXT NOT NULL, reviewed_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbook_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, runbook_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)",
  // Append-only approval trail. Deliberately NOT cleaned up when a runbook is
  // deleted: a trail the subject can erase by deleting the record is not a
  // trail. `runbooks.id` is AUTOINCREMENT, which SQLite never reuses, so a
  // retained row can never be misread as belonging to a later runbook.
  "CREATE TABLE IF NOT EXISTS runbook_approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, runbook_id INTEGER NOT NULL, from_approval TEXT NOT NULL, to_approval TEXT NOT NULL, actor TEXT NOT NULL, occurred_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS skill_assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, engineer TEXT NOT NULL, skill TEXT NOT NULL, rating TEXT NOT NULL, evidence TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)",
  // Indexes matching the actual query shapes used by the routes.
  "CREATE INDEX IF NOT EXISTS idx_engagements_status_updated ON engagements(status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_engagements_owner ON engagements(owner)",
  "CREATE INDEX IF NOT EXISTS idx_weekly_updates_engagement_week ON weekly_updates(engagement_id, week_of)",
  // Serves the correlated "latest update per engagement" subquery.
  "CREATE INDEX IF NOT EXISTS idx_weekly_updates_engagement_submitted ON weekly_updates(engagement_id, submitted_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_runbook_attachments_runbook_id ON runbook_attachments(runbook_id)",
  // Ordered by id, not occurred_at: id is AUTOINCREMENT so it is already a total
  // chronological order, which makes the read both tie-free and sort-free. Two
  // transitions in the same millisecond share an occurred_at and would otherwise
  // need a tiebreak that forces a temp b-tree.
  "CREATE INDEX IF NOT EXISTS idx_runbook_approvals_runbook ON runbook_approvals(runbook_id, id DESC)",
  "CREATE INDEX IF NOT EXISTS idx_runbooks_reviewed_at ON runbooks(reviewed_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_improvements_created_at ON improvements(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_skill_assessments_updated_at ON skill_assessments(updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)",
];
