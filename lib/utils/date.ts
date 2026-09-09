/** Format an ISO timestamp for display, with a fallback for missing values. */
export function formatDate(value?: string | null, fallback = "No updates yet"): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole days between an ISO timestamp and now. Negative values mean future. */
export function daysSince(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
}

/**
 * Relative staleness label for an engagement's last update. Used to make an
 * overdue check-in visible without the reader doing date arithmetic.
 */
export function staleness(value?: string | null): {
  label: string;
  overdue: boolean;
} | null {
  const days = daysSince(value);
  if (days === null) return null;
  if (days <= 0) return { label: "Updated today", overdue: false };
  if (days === 1) return { label: "Updated yesterday", overdue: false };
  if (days < 7) return { label: `Updated ${days} days ago`, overdue: false };
  if (days < 14) return { label: "Update due", overdue: true };
  return { label: `No update in ${Math.floor(days / 7)} weeks`, overdue: true };
}

/** Human-readable file size for attachment rows. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
