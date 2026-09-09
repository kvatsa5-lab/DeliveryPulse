import assert from "node:assert/strict";
import test from "node:test";

import { field, parseId, validate } from "../../lib/validation.ts";

test("field reads and trims from a plain object", () => {
  assert.equal(field({ title: "  spaced  " }, "title"), "spaced");
  assert.equal(field({}, "missing"), "");
  assert.equal(field({ title: null }, "title"), "");
  assert.equal(field({ title: undefined }, "title"), "");
});

test("field reads from FormData identically, so one schema covers both bodies", () => {
  const form = new FormData();
  form.set("title", "  spaced  ");
  assert.equal(field(form, "title"), "spaced");
  assert.equal(field(form, "missing"), "");
});

test("field coerces non-strings so a numeric JSON id still validates", () => {
  assert.equal(field({ engagementId: 42 }, "engagementId"), "42");
  assert.equal(field({ flag: true }, "flag"), "true");
});

test("validate requires fields by default and names them with the label", () => {
  const { ok, errors } = validate({}, { title: { label: "Work title" } });
  assert.equal(ok, false);
  assert.equal(errors.title, "Work title is required.");
});

test("validate allows an explicitly optional field to be blank", () => {
  const { ok, data } = validate({}, { note: { required: false } });
  assert.equal(ok, true);
  assert.equal(data.note, "");
});

test("validate enforces maxLength, so a paste bomb cannot fill the column", () => {
  const { ok, errors } = validate(
    { title: "x".repeat(201) },
    { title: { label: "Title", maxLength: 200 } }
  );
  assert.equal(ok, false);
  assert.equal(errors.title, "Title must be 200 characters or fewer.");
});

test("validate applies a default length ceiling when the schema omits one", () => {
  const { ok, errors } = validate({ note: "x".repeat(2001) }, { note: {} });
  assert.equal(ok, false);
  assert.match(errors.note, /2000 characters or fewer/);
});

test("validate enforces minLength only when a value is present", () => {
  const schema = { code: { label: "Code", minLength: 3 } };
  assert.equal(validate({ code: "ab" }, schema).errors.code, "Code must be at least 3 characters.");
  assert.equal(validate({ code: "abc" }, schema).ok, true);
});

test("validate restricts oneOf fields, guarding status columns against typos", () => {
  const schema = { status: { label: "Status", oneOf: ["Blocked", "Completed"] } };
  assert.equal(validate({ status: "Blocked" }, schema).ok, true);
  assert.equal(
    validate({ status: "blocked" }, schema).errors.status,
    "Status is not a recognised value.",
    "oneOf is case-sensitive: it must match the stored enum exactly"
  );
  assert.equal(validate({ status: "Totally fine" }, schema).errors.status, "Status is not a recognised value.");
});

test("validate reports every failing field at once, not just the first", () => {
  const { ok, errors } = validate(
    {},
    { customer: { label: "Customer" }, title: { label: "Title" } }
  );
  assert.equal(ok, false);
  assert.deepEqual(Object.keys(errors).sort(), ["customer", "title"]);
});

test("validate returns trimmed values, so what is stored is what was checked", () => {
  const { data } = validate({ title: "  NXRM upgrade  " }, { title: {} });
  assert.equal(data.title, "NXRM upgrade");
});

test("validate never throws on a hostile shape", () => {
  assert.equal(validate({ title: { nested: true } }, { title: { maxLength: 5 } }).ok, false);
  assert.equal(validate({ title: [] }, { title: {} }).ok, false);
});

test("parseId accepts positive integers", () => {
  assert.equal(parseId("1"), 1);
  assert.equal(parseId("500"), 500);
});

test("parseId rejects everything that is not a usable row id", () => {
  for (const bad of [null, undefined, "", "0", "-1", "1.5", "abc", " ", "NaN", "Infinity"]) {
    assert.equal(parseId(bad), null, `parseId(${JSON.stringify(bad)}) must be null`);
  }
});

/**
 * Documents a quirk rather than endorsing it: parseId goes through Number(), so
 * exponent and hex forms resolve to integers. Harmless here -- the result is
 * still a bounded positive integer used only as a lookup key -- but pinned so a
 * future switch to a stricter parser is a deliberate, visible change.
 */
test("parseId tolerates alternate numeric notations", () => {
  assert.equal(parseId("1e3"), 1000);
  assert.equal(parseId("0x10"), 16);
  assert.equal(parseId(" 7 "), 7);
});
