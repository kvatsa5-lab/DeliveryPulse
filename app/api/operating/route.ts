import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";
import { canApprove } from "@/lib/authorization";
import {
  accessDenied,
  fail,
  notFound,
  readBody,
  validationFailed,
  withErrorHandling,
} from "@/lib/api-response";
import { field, parseId, validate } from "@/lib/validation";
import { ERROR_CODES } from "@/types/api";
import {
  ENVIRONMENTS,
  IMPROVEMENT_CATEGORIES,
  PRODUCTS,
  RUNBOOK_APPROVAL_STATUS,
  SKILL_RATINGS,
} from "@/lib/constants/statuses";
import {
  MAX_ATTACHMENT_BYTES,
  isAttachmentAllowed,
  safeFileName,
} from "@/lib/constants/attachments";

const IMPROVEMENT_SCHEMA = {
  title: { label: "Improvement title", maxLength: 200 },
  category: { label: "Category", oneOf: IMPROVEMENT_CATEGORIES },
  owner: { label: "Owner", maxLength: 120 },
  impact: { label: "Observed impact", maxLength: 2000 },
} as const;

const RUNBOOK_SCHEMA = {
  title: { label: "Runbook title", maxLength: 200 },
  product: { label: "Product", oneOf: PRODUCTS },
  environment: { label: "Environment", oneOf: ENVIRONMENTS },
  architecture: { label: "Architecture", maxLength: 160 },
  owner: { label: "Owner / author", maxLength: 120 },
} as const;

const ASSESSMENT_SCHEMA = {
  engineer: { label: "Engineer", maxLength: 120 },
  skill: { label: "Skill", maxLength: 160 },
  rating: { label: "Rating", oneOf: SKILL_RATINGS },
  evidence: { label: "Delivery evidence", maxLength: 2000 },
} as const;

// ---------------------------------------------------------------- GET

export const GET = withErrorHandling(async (request: Request) => {
  if (!(await currentMember(request))) return accessDenied();

  const type = new URL(request.url).searchParams.get("type");

  if (type === "runbooks") {
    // Two queries + an in-memory join, rather than one row-per-attachment
    // result set that the client would have to de-duplicate.
    const [runbooks, attachments] = await Promise.all([
      env.DB.prepare(
        "SELECT id, title, product, environment, architecture, approval, owner, reviewed_at FROM runbooks ORDER BY reviewed_at DESC LIMIT 500"
      ).all<Record<string, unknown>>(),
      env.DB.prepare(
        "SELECT id, runbook_id AS runbookId, file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes FROM runbook_attachments ORDER BY id DESC"
      ).all<Record<string, unknown>>(),
    ]);

    const byRunbook = new Map<number, Record<string, unknown>[]>();
    for (const attachment of attachments.results) {
      const id = Number(attachment.runbookId);
      const list = byRunbook.get(id);
      if (list) list.push(attachment);
      else byRunbook.set(id, [attachment]);
    }

    return Response.json({
      records: runbooks.results.map((runbook: Record<string, unknown>) => ({
        ...runbook,
        attachments: byRunbook.get(Number(runbook.id)) ?? [],
      })),
    });
  }

  // Who changed a runbook's approval state, and when. Readable by any member
  // rather than approvers only: the point of the trail is that the team can see
  // it, and it contains nothing the runbook list does not already expose.
  if (type === "runbook-history") {
    const id = parseId(new URL(request.url).searchParams.get("id"));
    if (!id) return validationFailed({ id: "A valid runbook is required." });

    const { results } = await env.DB.prepare(
      "SELECT from_approval AS fromApproval, to_approval AS toApproval, actor, occurred_at AS occurredAt FROM runbook_approvals WHERE runbook_id = ? ORDER BY id DESC LIMIT 200"
    )
      .bind(id)
      .all();
    return Response.json({ records: results });
  }

  if (type === "improvements") {
    const { results } = await env.DB.prepare(
      "SELECT id, title, category, owner, impact, status, created_at FROM improvements ORDER BY created_at DESC LIMIT 500"
    ).all();
    return Response.json({ records: results });
  }

  if (type === "assessments") {
    const { results } = await env.DB.prepare(
      "SELECT id, engineer, skill, rating, evidence, updated_at FROM skill_assessments ORDER BY updated_at DESC LIMIT 500"
    ).all();
    return Response.json({ records: results });
  }

  return fail(ERROR_CODES.VALIDATION_FAILED, "Unknown record type.", 400);
});

// ---------------------------------------------------------------- POST

export const POST = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  const body = await readBody(request);
  const type = field(body, "type");
  const now = new Date().toISOString();

  if (type === "improvements") {
    const { ok, data, errors } = validate(body, IMPROVEMENT_SCHEMA);
    if (!ok) return validationFailed(errors);

    await env.DB.prepare(
      "INSERT INTO improvements (title,category,owner,impact,status,created_at) VALUES (?,?,?,?,?,?)"
    )
      .bind(data.title, data.category, data.owner, data.impact, "Proposed", now)
      .run();

    return Response.json({ ok: true }, { status: 201 });
  }

  if (type === "runbooks") {
    const { ok, data, errors } = validate(body, RUNBOOK_SCHEMA);
    if (!ok) return validationFailed(errors);

    const attachment = body instanceof FormData ? body.get("attachment") : null;
    const hasFile =
      attachment && typeof attachment !== "string" && attachment.size > 0;

    // Validate the file BEFORE inserting the runbook row, so a rejected upload
    // cannot leave a runbook behind that the user did not intend to create.
    if (hasFile) {
      const file = attachment as File;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return fail(
          ERROR_CODES.FILE_TOO_LARGE,
          "Attachments must be 10 MB or smaller.",
          400,
          { attachment: "This file is larger than 10 MB." }
        );
      }
      if (!isAttachmentAllowed(file.name, file.type)) {
        return fail(
          ERROR_CODES.UNSUPPORTED_TYPE,
          "That attachment type is not supported.",
          400,
          { attachment: "Use a PDF, document, spreadsheet, or text file." }
        );
      }
    }

    const result = await env.DB.prepare(
      "INSERT INTO runbooks (title,product,environment,architecture,approval,owner,reviewed_at) VALUES (?,?,?,?,?,?,?)"
    )
      .bind(
        data.title,
        data.product,
        data.environment,
        data.architecture,
        "Review needed",
        data.owner,
        now
      )
      .run();

    const runbookId = Number(result.meta.last_row_id);

    if (hasFile) {
      const file = attachment as File;
      const displayName = safeFileName(file.name);
      const objectKey = `runbooks/${runbookId}/${crypto.randomUUID()}-${displayName}`;
      const contentType = file.type || "application/octet-stream";

      try {
        await env.FILES.put(objectKey, file.stream(), {
          httpMetadata: {
            contentType,
            contentDisposition: `attachment; filename="${displayName}"`,
          },
        });
        await env.DB.prepare(
          "INSERT INTO runbook_attachments (runbook_id,object_key,file_name,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?)"
        )
          .bind(runbookId, objectKey, displayName, contentType, file.size, now)
          .run();
      } catch (error) {
        // Roll back both sides so we never leave a dangling R2 object or a
        // runbook that claims an attachment it does not have.
        console.error("Attachment upload failed, rolling back:", error);
        await env.FILES.delete(objectKey).catch(() => {});
        await env.DB.prepare("DELETE FROM runbooks WHERE id = ?")
          .bind(runbookId)
          .run();
        return fail(
          ERROR_CODES.SERVER_ERROR,
          "The attachment could not be stored, so the runbook was not saved.",
          502
        );
      }
    }

    return Response.json({ id: runbookId }, { status: 201 });
  }

  if (type === "assessments") {
    const { ok, data, errors } = validate(body, ASSESSMENT_SCHEMA);
    if (!ok) return validationFailed(errors);

    await env.DB.prepare(
      "INSERT INTO skill_assessments (engineer,skill,rating,evidence,updated_at) VALUES (?,?,?,?,?)"
    )
      .bind(data.engineer, data.skill, data.rating, data.evidence, now)
      .run();

    return Response.json({ ok: true }, { status: 201 });
  }

  return fail(ERROR_CODES.VALIDATION_FAILED, "Unknown record type.", 400);
});

// ---------------------------------------------------------------- PATCH

/**
 * Approve or send back a runbook. This closes the gap where every runbook was
 * created as "Review needed" with no way to ever move it forward.
 */
export const PATCH = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  const url = new URL(request.url);
  if (url.searchParams.get("type") !== "runbooks") {
    return fail(ERROR_CODES.VALIDATION_FAILED, "Unknown record type.", 400);
  }

  const id = parseId(url.searchParams.get("id"));
  if (!id) return validationFailed({ id: "A valid runbook is required." });

  const body = await readBody(request);
  const approval = field(body, "approval");
  if (!(RUNBOOK_APPROVAL_STATUS as readonly string[]).includes(approval)) {
    return validationFailed({ approval: "Choose a valid approval state." });
  }

  if (!canApprove(member)) {
    return fail(
      ERROR_CODES.ACCESS_DENIED,
      "Only a runbook approver can change approval state.",
      403
    );
  }

  const now = new Date().toISOString();

  // Write the audit row and apply the change in one batched transaction.
  //
  // DO NOT split this into two run() calls. D1 executes a batch as a single
  // transaction, which is what stops a failed UPDATE from leaving behind an
  // audit row for a change that never applied.
  //
  // The INSERT reads the outgoing state via `SELECT approval FROM runbooks`
  // rather than a separate query, so the recorded "from" value is exactly what
  // the UPDATE overwrites -- a read-then-write would let a concurrent approval
  // land in between and log a transition that never happened.
  //
  // It also replaces the previous existence check: both statements share the
  // `WHERE id = ?` predicate, so a missing runbook inserts no audit row and
  // updates nothing, and `changes` tells us which case we are in.
  const [audited] = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO runbook_approvals (runbook_id,from_approval,to_approval,actor,occurred_at) SELECT id, approval, ?, ?, ? FROM runbooks WHERE id = ?"
    ).bind(approval, member.email, now, id),
    env.DB.prepare(
      "UPDATE runbooks SET approval = ?, reviewed_at = ? WHERE id = ?"
    ).bind(approval, now, id),
  ]);

  if (!audited.meta.changes) return notFound("That runbook no longer exists.");

  return Response.json({ ok: true, approval });
});

// ---------------------------------------------------------------- DELETE

export const DELETE = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  const url = new URL(request.url);
  if (url.searchParams.get("type") !== "runbooks") {
    return fail(ERROR_CODES.VALIDATION_FAILED, "Unknown record type.", 400);
  }

  const id = parseId(url.searchParams.get("id"));
  if (!id) return validationFailed({ id: "A valid runbook is required." });

  const { results: attachments } = await env.DB.prepare(
    "SELECT object_key AS objectKey FROM runbook_attachments WHERE runbook_id = ?"
  )
    .bind(id)
    .all<{ objectKey: string }>();

  // Remove DB rows first: an orphaned R2 object is recoverable waste, whereas a
  // row pointing at a deleted object breaks every future download.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM runbook_attachments WHERE runbook_id = ?").bind(id),
    env.DB.prepare("DELETE FROM runbooks WHERE id = ?").bind(id),
  ]);
  await Promise.all(
    attachments.map((attachment: { objectKey: string }) =>
      env.FILES.delete(attachment.objectKey).catch((error: unknown) => {
        console.error("Failed to delete R2 object", attachment.objectKey, error);
      })
    )
  );

  return Response.json({ ok: true });
});
