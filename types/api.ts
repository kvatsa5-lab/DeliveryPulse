export interface ApiErrorResponse {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export const ERROR_CODES = {
  ACCESS_DENIED: "ACCESS_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
