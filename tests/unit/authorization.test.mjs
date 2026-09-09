import assert from "node:assert/strict";
import test from "node:test";

import { canApprove } from "../../lib/authorization.ts";

test("grants approval to the roles the workspace treats as approvers", () => {
  assert.equal(canApprove({ role: "Manager & Runbook Approver" }), true);
  assert.equal(canApprove({ role: "Runbook Approver" }), true);
  assert.equal(canApprove({ role: "Engineering Manager" }), true);
  assert.equal(canApprove({ role: "Admin" }), true);
  // Matching is case-insensitive so roster casing does not decide permissions.
  assert.equal(canApprove({ role: "MANAGER" }), true);
  assert.equal(canApprove({ role: "approver" }), true);
});

test("denies approval to delivery roles", () => {
  assert.equal(canApprove({ role: "Delivery Engineer" }), false);
  assert.equal(canApprove({ role: "Solution Delivery Engineer" }), false);
  assert.equal(canApprove({ role: "Consultant" }), false);
  assert.equal(canApprove({ role: "" }), false);
});

/**
 * Pins a known flaw rather than asserting it is correct.
 *
 * The predicate is a substring match over a free-text role column, so a role
 * written to DENY authority still grants it. Nothing hits this today (the roster
 * is a single seeded approver) but the behaviour is captured here so it cannot
 * regress unnoticed, and so whoever adds a `can_approve` column has a failing
 * test telling them exactly which assertions to invert.
 */
test("KNOWN LIMITATION: negated role wording still confers approval", () => {
  assert.equal(
    canApprove({ role: "Non-admin" }),
    true,
    "substring match cannot see the negation -- fix by adding an explicit can_approve column"
  );
  assert.equal(canApprove({ role: "Not an approver" }), true);
  assert.equal(canApprove({ role: "read-only manager" }), true);
});

test("does not read approval rights out of unrelated words", () => {
  // Guards against a future loosening of the pattern, e.g. matching "admin"
  // inside words where it carries no authority.
  assert.equal(canApprove({ role: "Documentation lead" }), false);
  assert.equal(canApprove({ role: "Support" }), false);
});
