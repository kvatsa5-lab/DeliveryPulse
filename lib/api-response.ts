import { ERROR_CODES, type ErrorCode } from "@/types/api";
import type { FieldErrors } from "@/lib/validation";

/** Standard error envelope so the client can branch on `code`, not on prose. */
export function fail(
  code: ErrorCode,
  message: string,
  status: number,
  fields?: FieldErrors
) {
  return Response.json({ error: message, code, fields }, { status });
}

export const accessDenied = () =>
  fail(
    ERROR_CODES.ACCESS_DENIED,
    "Your account does not have access to this Delivery Pulse workspace.",
    403
  );

export const validationFailed = (fields: FieldErrors) =>
  fail(
    ERROR_CODES.VALIDATION_FAILED,
    "Please correct the highlighted fields.",
    400,
    fields
  );

export const notFound = (message = "That record no longer exists.") =>
  fail(ERROR_CODES.NOT_FOUND, message, 404);

export const serverError = () =>
  fail(
    ERROR_CODES.SERVER_ERROR,
    "Delivery Pulse hit an unexpected error. Please try again.",
    500
  );

/**
 * Thrown when a request body cannot be read. Kept distinct from a genuine
 * fault so it is reported as 400 rather than inflating the 500 rate (and the
 * alerting that hangs off it) every time a client sends a malformed payload.
 */
export class InvalidBodyError extends Error {
  constructor() {
    super("The request body could not be read.");
    this.name = "InvalidBodyError";
  }
}

/**
 * Read a request body as form data for multipart submissions, otherwise JSON.
 *
 * Non-object JSON (`null`, an array, a bare string) is rejected here too: every
 * caller casts the result to a record and would otherwise validate a shape that
 * cannot hold fields, producing misleading "field is required" errors.
 */
export async function readBody(
  request: Request
): Promise<FormData | Record<string, unknown>> {
  const isMultipart = request.headers
    .get("content-type")
    ?.includes("multipart/form-data");

  try {
    if (isMultipart) return await request.formData();
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidBodyError();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new InvalidBodyError();
  }
}

/**
 * Wrap a route handler so an unexpected throw becomes a 500 envelope instead
 * of a raw worker exception, and gets logged for triage. An unreadable body is
 * the caller's mistake, so it short-circuits to 400 and is not logged as a fault.
 */
export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof InvalidBodyError) {
        return fail(ERROR_CODES.VALIDATION_FAILED, error.message, 400);
      }
      console.error("Delivery Pulse route error:", error);
      return serverError();
    }
  };
}
