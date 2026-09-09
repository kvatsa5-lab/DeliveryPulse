"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatDate, staleness } from "@/lib/utils/date";
import type { Engagement } from "@/types/engagement";

/**
 * The signed-in engineer's own queue. Previously this section was a static empty
 * state with no data at all, so "My work" never showed any work.
 */
export function MyWork({
  engagements,
  loading,
  memberEmail,
  onUpdate,
}: {
  engagements: Engagement[];
  loading: boolean;
  memberEmail?: string;
  onUpdate: (engagementId: number) => void;
}) {
  const mine = useMemo(() => {
    if (!memberEmail) return [];
    // Owners are free-text names, so match on the local part of the email as a
    // best-effort heuristic until owners reference team_members by id.
    const handle = memberEmail.split("@")[0].toLowerCase();
    const tokens = handle.split(/[._-]/).filter(Boolean);
    return engagements.filter((item) => {
      const owner = item.owner.toLowerCase();
      return owner.includes(handle) || tokens.every((token) => owner.includes(token));
    });
  }, [engagements, memberEmail]);

  const queue = mine.length ? mine : engagements;
  const isFallback = !mine.length && engagements.length > 0;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="label">PERSONAL WORKSPACE</p>
          <h2>Keep the week current without daily reporting pressure.</h2>
          <p>
            {isFallback
              ? "No engagements are assigned to your name yet — showing the whole team so you can still post an update."
              : "Open any engagement, add an optional note during the week, and submit one clear weekly update."}
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        queue.map((item) => {
          const age = staleness(item.updatedAt);
          return (
            <div className="record" key={item.id}>
              <span>
                <strong>{item.customer}</strong>
                <small>
                  {item.title} · {item.owner}
                </small>
              </span>
              <span className="mywork-actions">
                <Badge status={item.status} />
                <small className={age?.overdue ? "risk" : ""}>
                  {age?.label ?? formatDate(item.updatedAt)}
                </small>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onUpdate(item.id)}
                >
                  Weekly update
                </button>
              </span>
            </div>
          );
        })
      )}

      {!loading && !queue.length && (
        <p className="empty-row">
          No engagements yet. Create one to start tracking your week.
        </p>
      )}
    </section>
  );
}
