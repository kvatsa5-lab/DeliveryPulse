# Delivery Pulse

An internal operating hub for a delivery team: weekly check-ins, engagement
status, improvement items, skill assessments, and runbooks with an approval
workflow and file attachments.

Built on [vinext](https://github.com/cloudflare/vinext) and deployed as a
Cloudflare Worker, with D1 for records and R2 for attachments.

## Prerequisites

- Node.js `>=22.13.0` (the test scripts pass `--experimental-strip-types`, which
  is a no-op on Node 24+ where TypeScript stripping is on by default)
- `sqlite3` on `PATH` — optional, used by one integration test to seed a
  non-approver member. That test skips without it.

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit + build + render + integration
npm run lint
```

This project does not use `wrangler.jsonc`. Local D1 and R2 bindings are
simulated by `vite.config.ts` from `.openai/hosting.json`.

## Identity and access

Identity comes from ChatGPT Sign-In (SIWC), which injects an
`oai-authenticated-user-email` request header. `lib/access.ts` resolves that
header to a row in `team_members`; a request with no header, or an email that is
not on the roster, is refused with 403.

SIWC establishes *identity* only, not authorisation. Every route calls
`currentMember()` and refuses non-members, so the roster is the access boundary.

**Approval rights** are decided by `canApprove()` in `lib/authorization.ts`,
which both the enforcing route and the `/api/me` UI hint call, so the button and
the permission it implies cannot drift apart.

> **Known limitation.** `canApprove()` is a substring match over the free-text
> `role` column, so a role worded as a denial — `"Non-admin"`, `"Not an
> approver"` — still grants approval. This is pinned by a test
> (`tests/unit/authorization.test.mjs`) rather than fixed, because the durable
> fix is an explicit `can_approve` column and that changes the role model.

There is **no API or UI for roster management**. Adding a team member currently
requires writing to `team_members` directly.

## Schema: read this before changing it

The schema is defined in two places that must agree, plus a third that does
nothing:

| Location | Role |
| --- | --- |
| `lib/constants/schema-ddl.ts` | **This creates the tables.** Applied by `ensureSchema()` on the first request per worker isolate. |
| `db/schema.ts` | Drizzle models. The routes build queries from these, so a column missing from the DDL fails at runtime with `no such column`. |
| `drizzle/*.sql` | Generated migrations that **nothing applies.** There is no `wrangler d1 migrations apply` step and `drizzle.config.ts` configures no driver. |

`tests/unit/schema-ddl.test.mjs` compares the first two and fails on drift. It
is the only thing that does.

Two consequences worth knowing:

- **`npm run db:generate` is not the schema workflow.** It writes files that are
  never applied. To add a table, edit `lib/constants/schema-ddl.ts` *and*
  `db/schema.ts`. Consider deleting `drizzle/` and the `db:generate` script
  outright; they currently look like a migration system without being one.
- **The bootstrap can only ever add, never migrate.** Every statement is
  `CREATE ... IF NOT EXISTS`, so a change to an *existing* table or index is
  silently skipped on any database that already has it. Adding a new table works
  fine; altering one needs a real migration path.

## API

All routes require an on-roster member.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/me` | Signed-in member and their `canApprove` flag |
| `GET` `POST` | `/api/engagements` | Engagement list includes each one's latest weekly update |
| `POST` | `/api/updates` | Weekly check-in; rolls status onto the engagement |
| `GET` `POST` `PATCH` `DELETE` | `/api/operating?type=…` | `runbooks`, `improvements`, `assessments`, `runbook-history` |
| `GET` | `/api/attachments/:id` | Streams an attachment from R2 |

`PATCH /api/operating?type=runbooks&id=N` changes approval state and is the only
approver-gated operation. Authoring is deliberately open to any member; only the
state change is restricted, which keeps authorship and approval separate.

### Approval audit trail

Every approval state change appends a row to `runbook_approvals` recording the
previous state, the new state, the actor, and the timestamp. Read it with
`GET /api/operating?type=runbook-history&id=N`.

Two properties are deliberate and covered by tests:

- The trail is **append-only and survives deletion of the runbook**, so the
  record of who approved something cannot be laundered by deleting the subject.
  `runbooks.id` is `AUTOINCREMENT`, which SQLite never reuses, so a retained row
  can never be misattributed to a later runbook.
- A **refused** attempt writes nothing. The audit row and the `UPDATE` are issued
  as a single `env.DB.batch([...])` whose `INSERT ... SELECT` reads the outgoing
  state at write time, so the recorded transition is always one that actually
  happened.

  This relies on **D1 `batch()` being a transaction** — verified in the local
  runtime, where miniflare wraps every batch in `storage.transactionSync()`. If
  that call is ever split into two separate `run()` calls, the atomicity is lost
  and a failed `UPDATE` can leave an audit row for a change that never applied.
  Keep them in one batch.

## Attachments

Uploads are gated by `isAttachmentAllowed()` in `lib/constants/attachments.ts`.
The **extension is the primary check and the MIME type is secondary — an AND, not
an OR.** The declared content type is entirely caller-controlled, so an OR meant
a `.exe` sent as `application/octet-stream` was accepted and written to R2.
`tests/unit/attachments.test.mjs` and the integration suite both pin this.

Attachment rows are written only after the file lands in R2, and both sides are
rolled back on failure, so there are no runbooks claiming attachments they do not
have and no orphaned objects.

## Tests

```bash
npm test              # everything, in order
npm run test:unit     # pure functions, no runtime needed
npm run test:render   # server-rendered HTML, needs a build first
npm run test:integration
```

`test:integration` starts its own dev server, exercises the real worker over
HTTP against miniflare D1/R2, and shuts it down afterwards. Point it at an
already-running server with `DP_TEST_BASE_URL`. Tests skip with a stated reason
rather than failing when no runtime is available, so skips in the summary are
worth reading.

Route handlers read their bindings from a module-level `cloudflare:workers`
import, so they cannot be tested by importing them in plain Node — that is why
the API tier drives HTTP instead. Logic that needs unit coverage is extracted
into dependency-free modules (`lib/authorization.ts`,
`lib/constants/schema-ddl.ts`) for that reason.

## Known issues

- `tsc --noEmit` reports 9 errors, all from missing `cloudflare:workers`,
  `D1Database`, and `Fetcher` types. `@cloudflare/workers-types` is not
  installed. The Vite plugin resolves these at build time, so the build and the
  full test suite pass regardless. Installing that package is the fix.
- `package.json` lists `react-loading-skeleton`, which nothing imports.
- Both `package-lock.json` and `pnpm-lock.yaml` are committed and can disagree
  about the dependency tree. Pick one.
- No pagination: list endpoints cap at `LIMIT 500` and return everything under
  it. Fine at current scale, not indefinitely.
- Deletes are hard deletes.

## Reference

- [vinext](https://github.com/cloudflare/vinext)
- [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new)
