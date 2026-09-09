export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Server-side allowlist of attachment content types. The file input's `accept`
 * attribute is a client hint only -- it is trivially bypassed, so the same
 * restriction is enforced here before anything reaches R2.
 */
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/x-yaml",
  "text/yaml",
  "application/yaml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/**
 * Types that carry no information about the payload. Browsers genuinely send
 * these for .md/.yaml/.csv on some platforms, so they are tolerated -- but only
 * once the extension has already been vetted. They are deliberately NOT in
 * ALLOWED_ATTACHMENT_TYPES: listing them there previously made the type check a
 * no-op, because any file could claim to be application/octet-stream.
 */
const GENERIC_ATTACHMENT_TYPES = new Set(["", "application/octet-stream"]);

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "pdf", "txt", "md", "csv", "json", "yaml", "yml",
  "doc", "docx", "xls", "xlsx",
]);

export function attachmentExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index + 1).toLowerCase();
}

/** Drop parameters and casing: `text/plain; charset=utf-8` -> `text/plain`. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/**
 * Decide whether an upload may be stored.
 *
 * The extension is the primary gate and the MIME type is a secondary check --
 * deliberately AND, not OR. The browser-supplied type is fully caller
 * controlled, so an OR meant a `.exe` sent as `application/octet-stream` (the
 * default curl and several browsers use when they cannot classify a file) was
 * accepted and written to R2.
 */
export function isAttachmentAllowed(fileName: string, mimeType: string): boolean {
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(attachmentExtension(fileName))) {
    return false;
  }

  const normalized = normalizeMimeType(mimeType);
  if (GENERIC_ATTACHMENT_TYPES.has(normalized)) return true;

  // A vetted extension carrying a contradictory type (a .txt declaring itself an
  // executable) is treated as suspicious rather than trusted.
  return ALLOWED_ATTACHMENT_TYPES.has(normalized);
}

/** Strip path separators and unusual characters from a user-supplied filename. */
export function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  // A name left with no alphanumeric character ("///" -> "___", ".." -> "..")
  // carries no information and is useless as a download name, so fall back
  // instead of serving it. Guarding on emptiness alone missed these.
  return /[a-zA-Z0-9]/.test(cleaned) ? cleaned : "attachment";
}
