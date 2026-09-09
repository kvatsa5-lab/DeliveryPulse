"use client";

import { useMemo, useState } from "react";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatBytes, formatDate } from "@/lib/utils/date";
import type { Runbook } from "@/types/operating";

export function RunbookLibrary({
  runbooks,
  loading,
  canApprove,
  onAdd,
  onApprove,
  onDelete,
}: {
  runbooks: Runbook[];
  loading: boolean;
  canApprove: boolean;
  onAdd: () => void;
  onApprove: (id: number, approval: string) => void;
  onDelete: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return runbooks.filter((item) => {
      if (pendingOnly && item.approval === "Approved") return false;
      if (!needle) return true;
      return `${item.title} ${item.product} ${item.environment} ${item.architecture} ${item.owner}`
        .toLowerCase()
        .includes(needle);
    });
  }, [runbooks, query, pendingOnly]);

  const awaiting = runbooks.filter((item) => item.approval === "Review needed").length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="label">APPROVED KNOWLEDGE</p>
          <h2>Runbook library</h2>
          <p>Find customer-safe guidance by product, environment, and architecture.</p>
          <button type="button" className="secondary" onClick={onAdd}>
            + Add runbook
          </button>
        </div>
        <div>
          <input
            placeholder="Search runbooks"
            aria-label="Search runbooks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {/* Give the approver a direct path to their queue. */}
          {awaiting > 0 && (
            <button
              type="button"
              className={pendingOnly ? "primary review-toggle" : "secondary review-toggle"}
              aria-pressed={pendingOnly}
              onClick={() => setPendingOnly((value) => !value)}
            >
              {awaiting} awaiting review
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        shown.map((item) => (
          <div className="runbook" key={item.id}>
            <span>
              <em className={item.approval === "Approved" ? "approved" : "review"}>
                {item.approval}
              </em>
              <h3>{item.title}</h3>
              <small>
                {item.product} · {item.environment} · {item.architecture}
              </small>
              {item.attachments?.map((attachment) => (
                <a
                  className="attachment"
                  href={`/api/attachments/${attachment.id}`}
                  key={attachment.id}
                >
                  {attachment.fileName}
                  <small>{formatBytes(attachment.sizeBytes)}</small>
                </a>
              ))}
            </span>
            <span className="runbook-actions">
              <small>
                {item.owner} · reviewed {formatDate(item.reviewed_at, "not yet")}
              </small>
              {canApprove &&
                (item.approval === "Approved" ? (
                  <button
                    type="button"
                    className="text"
                    onClick={() => onApprove(item.id, "Review needed")}
                  >
                    Send back to review
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary approve"
                    onClick={() => onApprove(item.id, "Approved")}
                  >
                    Approve
                  </button>
                ))}
              <button type="button" className="text" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </span>
          </div>
        ))
      )}

      {!loading && !shown.length && (
        <p className="empty-row">
          {runbooks.length
            ? "No runbooks match this search."
            : "No runbooks have been added yet. Add an approved command or a guide waiting for review."}
        </p>
      )}
    </section>
  );
}
