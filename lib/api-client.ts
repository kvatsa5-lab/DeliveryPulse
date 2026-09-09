import type { ApiErrorResponse } from "@/types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code?: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields ?? {};
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorResponse | null = null;
  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    // Non-JSON body (proxy error page, empty 502) -- fall through to a generic
    // message rather than surfacing a parse failure to the user.
  }

  return new ApiError(
    payload?.error ?? "Delivery Pulse could not complete that request.",
    response.status,
    payload?.code,
    payload?.fields
  );
}

/** GET JSON, throwing a structured ApiError on any non-2xx response. */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

/** Send a JSON or FormData body, throwing a structured ApiError on failure. */
export async function send<T = unknown>(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST"
): Promise<T> {
  const isFormData = body instanceof FormData;
  const response = await fetch(path, {
    method,
    headers: isFormData || body === undefined
      ? undefined
      : { "content-type": "application/json" },
    body: isFormData
      ? body
      : body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  if (!response.ok) throw await toApiError(response);
  return (await response.json().catch(() => ({}))) as T;
}
