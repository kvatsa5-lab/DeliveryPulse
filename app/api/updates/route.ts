import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";
import {
  accessDenied,
  notFound,
  readBody,
  validationFailed,
  withErrorHandling,
} from "@/lib/api-response";
import { field, parseId, validate } from "@/lib/validation";
import { ENGAGEMENT_STATUSES } from "@/lib/constants/statuses";

const UPDATE_SCHEMA = {
  status: { label: "Current state", oneOf: ENGAGEMENT_STATUSES },
  progress: { label: "Progress", maxLength: 4000 },
  nextStep: { label: "Next step", maxLength: 2000 },
  risk: { label: "Risk / blocker", maxLength: 2000 },
} as const;

export const POST = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  const body = await readBody(request);

  const engagementId = parseId(field(body, "engagementId"));
  const { ok, data, errors } = validate(body, UPDATE_SCHEMA);

  if (!engagementId) errors.engagementId = "An engagement is required.";
  if (!ok || !engagementId) return validationFailed(errors);

  // Confirm the target exists before writing the child row -- D1 does not
  // enforce the foreign key here, so an unchecked id would orphan the update.
  const exists = await env.DB.prepare("SELECT id FROM engagements WHERE id = ?")
    .bind(engagementId)
    .first<{ id: number }>();
  if (!exists) return notFound("That engagement no longer exists.");

  const now = new Date().toISOString();
  // Attribute the update to the signed-in member rather than trusting the body.
  const submittedBy = member.email;

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO weekly_updates (engagement_id,week_of,progress,next_step,risk,submitted_by,submitted_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(
      engagementId,
      now.slice(0, 10),
      data.progress,
      data.nextStep,
      data.risk,
      submittedBy,
      now
    ),
    env.DB.prepare(
      "UPDATE engagements SET status = ?, updated_at = ? WHERE id = ?"
    ).bind(data.status, now, engagementId),
  ]);

  return Response.json({ ok: true }, { status: 201 });
});
