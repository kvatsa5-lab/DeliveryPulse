import { env } from "cloudflare:workers";

const schema = [
  "CREATE TABLE IF NOT EXISTS engagements (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, title TEXT NOT NULL, products TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, status TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS weekly_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL, week_of TEXT NOT NULL, progress TEXT NOT NULL, next_step TEXT NOT NULL, risk TEXT NOT NULL, submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_engagements_status_updated ON engagements(status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_weekly_updates_engagement_week ON weekly_updates(engagement_id, week_of)",
];

async function ready() { await env.DB.batch(schema.map((statement) => env.DB.prepare(statement))); }
const seed = [
  ["Apex Financial","Nexus Repository HA deployment","Nexus Repository","AWS","HA","In progress","Priya Shah"],
  ["Northstar Health","Lifecycle onboarding","Lifecycle, IQ Server","Kubernetes","Single node","Awaiting customer","Daniel Kim"],
  ["Orbit Commerce","Repository Firewall rollout","Repository Firewall","On-premises","Single node","Blocked","Maya Patel"],
  ["Luma Energy","Nexus upgrade planning","Nexus Repository","Azure","Migration / upgrade","Completed","Priya Shah"],
];

export async function GET() {
  await ready();
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM engagements").first<{ total: number }>();
  if (!count?.total) {
    const now = new Date().toISOString();
    await env.DB.batch(seed.map(([customer,title,products,environment,architecture,status,owner]) => env.DB.prepare("INSERT INTO engagements (customer,title,products,environment,architecture,status,owner,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(customer,title,products,environment,architecture,status,owner,now,now)));
  }
  const { results } = await env.DB.prepare("SELECT e.*, w.progress, w.next_step AS nextStep, w.risk, w.submitted_at AS submittedAt FROM engagements e LEFT JOIN weekly_updates w ON w.id = (SELECT id FROM weekly_updates WHERE engagement_id = e.id ORDER BY submitted_at DESC LIMIT 1) ORDER BY CASE e.status WHEN 'Blocked' THEN 0 WHEN 'Awaiting customer' THEN 1 WHEN 'In progress' THEN 2 ELSE 3 END, e.updated_at DESC").all();
  return Response.json({ engagements: results });
}

export async function POST(request: Request) {
  await ready();
  const body = await request.json();
  const required = ["customer", "title", "products", "environment", "architecture", "owner"];
  if (required.some((key) => !String(body[key] ?? "").trim())) return Response.json({ error: "Complete all engagement fields." }, { status: 400 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare("INSERT INTO engagements (customer,title,products,environment,architecture,status,owner,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(body.customer,body.title,body.products,body.environment,body.architecture,"Not started",body.owner,now,now).run();
  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
