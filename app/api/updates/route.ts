import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";

export async function POST(request: Request) {
  if (!await currentMember(request)) return Response.json({ error: "Access denied" }, { status: 403 });
  const body = await request.json();
  const required = ["engagementId", "status", "progress", "nextStep", "risk"];
  if (required.some((key) => !String(body[key] ?? "").trim())) return Response.json({ error: "Complete all weekly update fields." }, { status: 400 });
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO weekly_updates (engagement_id,week_of,progress,next_step,risk,submitted_by,submitted_at) VALUES (?,?,?,?,?,?,?)").bind(body.engagementId,body.weekOf ?? now.slice(0,10),body.progress,body.nextStep,body.risk,body.submittedBy ?? "Pilot engineer",now),
    env.DB.prepare("UPDATE engagements SET status = ?, updated_at = ? WHERE id = ?").bind(body.status,now,body.engagementId),
  ]);
  return Response.json({ ok: true });
}
