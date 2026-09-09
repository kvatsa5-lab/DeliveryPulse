import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";
import { accessDenied, notFound, withErrorHandling } from "@/lib/api-response";
import { parseId } from "@/lib/validation";

interface AttachmentRow {
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    if (!(await currentMember(request))) return accessDenied();

    const id = parseId((await params).id);
    if (!id) return notFound("That attachment does not exist.");

    const attachment = await env.DB.prepare(
      "SELECT object_key AS objectKey, file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes FROM runbook_attachments WHERE id = ?"
    )
      .bind(id)
      .first<AttachmentRow>();
    if (!attachment) return notFound("That attachment does not exist.");

    const object = await env.FILES.get(attachment.objectKey);
    if (!object) return notFound("That attachment file is no longer stored.");

    // Quote-strip the filename so it cannot break out of the header value, and
    // force a download rather than letting the browser render it inline.
    const safeName = attachment.fileName.replace(/["\\\r\n]/g, "");

    return new Response(object.body, {
      headers: {
        "content-type": attachment.contentType,
        "content-disposition": `attachment; filename="${safeName}"`,
        "content-length": String(attachment.sizeBytes),
        // Never let a shared cache hold a member-gated file.
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }
);
