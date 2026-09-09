/**
 * Dependency-free runtime validation for API inputs.
 *
 * Keeps the worker bundle small (no Zod) while still rejecting bad payloads
 * before they reach D1, and returning per-field messages the UI can render.
 */

export type FieldErrors = Record<string, string>;

export interface ValidationResult<T> {
  ok: boolean;
  data: T;
  errors: FieldErrors;
}

export type Source = FormData | Record<string, unknown>;

/** Read a trimmed string from either a FormData body or a parsed JSON object. */
export function field(source: Source, key: string): string {
  const raw = source instanceof FormData ? source.get(key) : source[key];
  if (raw === null || raw === undefined) return "";
  if (typeof raw !== "string") return String(raw).trim();
  return raw.trim();
}

export interface Rule {
  /** Field is rejected when empty. Defaults to true. */
  required?: boolean;
  /** Reject values longer than this, so a paste bomb cannot fill the row. */
  maxLength?: number;
  /** Reject values shorter than this when a value is present. */
  minLength?: number;
  /** Restrict to a known set. Guards status/category columns against typos. */
  oneOf?: readonly string[];
  /** Human-readable name used in the error message. Defaults to the key. */
  label?: string;
}

export type Schema = Record<string, Rule>;

const DEFAULT_MAX_LENGTH = 2000;

/**
 * Validate a payload against a schema, returning cleaned values plus a
 * field->message map. Never throws: callers decide how to surface `errors`.
 */
export function validate<T extends Schema>(
  source: Source,
  schema: T
): ValidationResult<Record<keyof T & string, string>> {
  const data = {} as Record<keyof T & string, string>;
  const errors: FieldErrors = {};

  for (const [key, rule] of Object.entries(schema)) {
    const label = rule.label ?? key;
    const value = field(source, key);
    data[key as keyof T & string] = value;

    if (!value) {
      if (rule.required !== false) errors[key] = `${label} is required.`;
      continue;
    }

    const max = rule.maxLength ?? DEFAULT_MAX_LENGTH;
    if (value.length > max) {
      errors[key] = `${label} must be ${max} characters or fewer.`;
      continue;
    }

    if (rule.minLength && value.length < rule.minLength) {
      errors[key] = `${label} must be at least ${rule.minLength} characters.`;
      continue;
    }

    if (rule.oneOf && !rule.oneOf.includes(value)) {
      errors[key] = `${label} is not a recognised value.`;
    }
  }

  return { ok: Object.keys(errors).length === 0, data, errors };
}

/** Parse a positive integer id from a query string or body value. */
export function parseId(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
