import { env } from "cloudflare:workers";
import { ensureSchema } from "@/lib/schema-setup";

export interface Member {
  email: string;
  role: string;
}

const SEED_EMAIL = "kshitij.vatsa@sonatype.com";
const SEED_ROLE = "Manager & Runbook Approver";

let seeded: Promise<void> | null = null;

/**
 * Ensure the bootstrap owner row exists. Runs once per isolate rather than on
 * every request -- the previous implementation issued an INSERT OR IGNORE on
 * each call, which was a wasted write round-trip on every page load.
 */
function ensureSeedMember(): Promise<void> {
  const existing = seeded;
  if (existing) return existing;

  const started = env.DB.prepare(
    "INSERT OR IGNORE INTO team_members (email,role,active,created_at) VALUES (?,?,1,?)"
  )
    .bind(SEED_EMAIL, SEED_ROLE, new Date().toISOString())
    .run()
    .then(() => undefined)
    .catch((error: unknown) => {
      seeded = null;
      throw error;
    });

  seeded = started;
  return started;
}

/**
 * Resolve the caller to an active team member, or null when the request has no
 * identity header or the email is not on the roster.
 */
export async function currentMember(request: Request): Promise<Member | null> {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();

  await ensureSchema();
  await ensureSeedMember();

  // Anonymous visitors can never be members, but the schema still had to be
  // ready above so the first authenticated request does not race the bootstrap.
  if (!email) return null;

  return env.DB.prepare(
    "SELECT email, role FROM team_members WHERE email = ? AND active = 1"
  )
    .bind(email)
    .first<Member>();
}
