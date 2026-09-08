/**
 * Guards the schema against silent drift.
 *
 * This repo describes its schema in three places, and only one of them runs:
 *
 *   1. `lib/constants/schema-ddl.ts` -- the bootstrap DDL. THIS is what creates
 *      the tables, via ensureSchema() on the first request per isolate.
 *   2. `db/schema.ts` -- the drizzle table definitions the routes build queries
 *      from. If a column here is missing from (1), queries compile but fail at
 *      runtime with "no such column".
 *   3. `drizzle/*.sql` -- generated migrations that NOTHING applies. There is no
 *      `wrangler d1 migrations apply` step and drizzle.config.ts configures no
 *      driver, so these are inert. They are not checked here; see the README
 *      note about removing them.
 *
 * (1) and (2) have to agree, and nothing but this test makes them.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/sqlite-core";

import * as schema from "../../db/schema.ts";
import { SCHEMA_STATEMENTS } from "../../lib/constants/schema-ddl.ts";

/**
 * Pull table name -> column names out of the CREATE TABLE statements.
 *
 * Naive comma splitting is sufficient because every column in this schema is a
 * simple `name TYPE constraints` clause. It would break on a composite
 * `PRIMARY KEY (a, b)` or a table-level FOREIGN KEY, so if one is ever added
 * this parser needs revisiting rather than silently mis-reporting.
 */
function parseTables(statements) {
  const tables = new Map();
  for (const statement of statements) {
    const match = /^CREATE TABLE IF NOT EXISTS (\w+) \((.*)\)$/.exec(statement);
    if (!match) continue;
    const [, name, body] = match;
    assert.ok(
      !/\bPRIMARY KEY\s*\(|\bFOREIGN KEY\b/i.test(body),
      `${name} uses a table-level constraint the test parser cannot read`
    );
    tables.set(
      name,
      body.split(",").map((column) => column.trim().split(/\s+/)[0])
    );
  }
  return tables;
}

function parseIndexes(statements) {
  const indexes = new Map();
  for (const statement of statements) {
    const match =
      /^CREATE INDEX IF NOT EXISTS (\w+) ON (\w+)\((.*)\)$/.exec(statement);
    if (!match) continue;
    const [, name, table, columns] = match;
    indexes.set(name, {
      table,
      // Drop ASC/DESC: db/schema.ts cannot express direction via `.on()`, so
      // comparing it would fail on a difference the ORM has no way to state.
      columns: columns
        .split(",")
        .map((column) => column.trim().replace(/\s+(ASC|DESC)$/i, "")),
    });
  }
  return indexes;
}

const ddlTables = parseTables(SCHEMA_STATEMENTS);
const ddlIndexes = parseIndexes(SCHEMA_STATEMENTS);
const models = Object.values(schema).map((table) => getTableConfig(table));

test("every drizzle table is created by the bootstrap DDL", () => {
  for (const model of models) {
    assert.ok(
      ddlTables.has(model.name),
      `db/schema.ts defines "${model.name}" but no CREATE TABLE exists for it, ` +
        `so every query against it fails at runtime`
    );
  }
});

test("the bootstrap DDL creates no table the routes cannot query", () => {
  const known = new Set(models.map((model) => model.name));
  for (const name of ddlTables.keys()) {
    assert.ok(known.has(name), `DDL creates "${name}" with no drizzle model`);
  }
});

test("columns agree between the DDL and the drizzle models", () => {
  for (const model of models) {
    const declared = ddlTables.get(model.name);
    if (!declared) continue; // reported by the test above
    assert.deepEqual(
      [...model.columns.map((column) => column.name)].sort(),
      [...declared].sort(),
      `column drift on "${model.name}" -- a column present in only one of ` +
        `db/schema.ts and lib/constants/schema-ddl.ts`
    );
  }
});

test("indexes agree between the DDL and the drizzle models", () => {
  const modelled = new Map();
  for (const model of models) {
    for (const index of model.indexes) {
      modelled.set(index.config.name, {
        table: model.name,
        columns: index.config.columns.map((column) => column.name),
      });
    }
  }

  assert.deepEqual(
    [...modelled.keys()].sort(),
    [...ddlIndexes.keys()].sort(),
    "index drift between db/schema.ts and lib/constants/schema-ddl.ts"
  );

  for (const [name, expected] of modelled) {
    assert.deepEqual(ddlIndexes.get(name), expected, `index "${name}" differs`);
  }
});

/**
 * Documents a real but harmless divergence rather than asserting it away.
 *
 * The DDL declares descending indexes (`reviewed_at DESC`) because the routes
 * always order newest-first. `db/schema.ts` states the same indexes without a
 * direction, since drizzle's `.on()` takes plain columns here. SQLite can walk
 * an index in either direction, so this costs nothing at runtime -- but it does
 * mean `drizzle-kit generate` would emit a migration trying to reconcile it.
 * Another reason the inert `drizzle/` folder is a trap.
 */
test("KNOWN DIVERGENCE: the DDL orders some indexes, the models cannot", () => {
  const descending = SCHEMA_STATEMENTS.filter((statement) =>
    /CREATE INDEX.*DESC\)/.test(statement)
  );
  assert.equal(
    descending.length,
    5,
    "if this count changed, re-check whether db/schema.ts should follow"
  );
});
