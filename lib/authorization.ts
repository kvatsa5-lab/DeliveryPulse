/**
 * Authorization predicates.
 *
 * Deliberately dependency-free -- no `cloudflare:workers` import -- so the rules
 * can be unit tested in plain Node without a worker runtime. Authorization is
 * the last place you want covered only by manual testing.
 */

/** The minimum shape needed to decide approval rights. */
export interface RoleBearer {
  role: string;
}

/**
 * Whether a member may move a runbook out of "Review needed".
 *
 * Single source of truth: the enforcement path (the operating PATCH handler) and
 * the hint the UI uses to hide controls (/api/me) must agree. These were
 * separate copies of the same regex, so editing one would have silently let the
 * button and the permission it implies drift apart.
 *
 * KNOWN LIMITATION: this is a substring match over a free-text role column, so a
 * role worded as a denial ("Non-admin", "Not an approver") still matches and
 * confers approval. The roster is a single seeded row today so nothing reaches
 * this, but the durable fix is an explicit `can_approve` column on team_members
 * rather than inferring authority from prose. The behaviour is pinned in
 * tests/unit/authorization.test.mjs so the gap stays visible.
 */
export function canApprove(member: RoleBearer): boolean {
  return /approver|manager|admin/i.test(member.role);
}
