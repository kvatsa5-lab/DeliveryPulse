import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";
import {
  accessDenied,
  readBody,
  validationFailed,
  withErrorHandling,
} from "@/lib/api-response";
import { validate } from "@/lib/validation";
import { ARCHITECTURES, ENVIRONMENTS } from "@/lib/constants/statuses";

const ENGAGEMENT_SCHEMA = {
  customer: { label: "Customer", maxLength: 120 },
  title: { label: "Work title", maxLength: 200 },
  products: { label: "Product(s)", maxLength: 200 },
  environment: { label: "Environment", oneOf: ENVIRONMENTS },
  architecture: { label: "Architecture", oneOf: ARCHITECTURES },
  owner: { label: "Owner", maxLength: 120 },
} as const;

// Ordered so the rows needing attention surface first, then most recent.
const LIST_QUERY = `
  SELECT e.id, e.customer, e.title, e.products, e.environment, e.architecture,
         e.status, e.owner, e.created_at AS createdAt, e.updated_at AS updatedAt,
         w.progress, w.next_step AS nextStep, w.risk, w.submitted_at AS submittedAt
  FROM engagements e
  LEFT JOIN weekly_updates w
    ON w.id = (
      SELECT id FROM weekly_updates
      WHERE engagement_id = e.id
      ORDER BY submitted_at DESC
      LIMIT 1
    )
  ORDER BY CASE e.status
             WHEN 'Blocked' THEN 0
             WHEN 'Awaiting customer' THEN 1
             WHEN 'In progress' THEN 2
             ELSE 3
           END,
           e.updated_at DESC
  LIMIT ?`;

const MAX_ROWS = 500;

export const GET = withErrorHandling(async (request: Request) => {
  if (!(await currentMember(request))) return accessDenied();

  const { results } = await env.DB.prepare(LIST_QUERY).bind(MAX_ROWS).all();
  return Response.json({ engagements: results });
});

export const POST = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  const body = await readBody(request);
  const { ok, data, errors } = validate(body, ENGAGEMENT_SCHEMA);
  if (!ok) return validationFailed(errors);

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "INSERT INTO engagements (customer,title,products,environment,architecture,status,owner,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  )
    .bind(
      data.customer,
      data.title,
      data.products,
      data.environment,
      data.architecture,
      "Not started",
      data.owner,
      now,
      now
    )
    .run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
});
