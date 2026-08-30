import { env } from "cloudflare:workers";

const setup = [
  "CREATE TABLE IF NOT EXISTS team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)",
];

export async function currentMember(request: Request) {
  await env.DB.batch(setup.map((statement) => env.DB.prepare(statement)));
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO team_members (email,role,active,created_at) VALUES (?,?,?,?)").bind("kshitij.vatsa@sonatype.com", "Manager & Runbook Approver", 1, now).run();
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  if (!email) return null;
  return env.DB.prepare("SELECT email, role FROM team_members WHERE email = ? AND active = 1").bind(email).first<{ email: string; role: string }>();
}
