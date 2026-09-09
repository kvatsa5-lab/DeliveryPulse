"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { ENGAGEMENT_STATUSES } from "@/lib/constants/statuses";
import { formatDate, staleness } from "@/lib/utils/date";
import type { Engagement } from "@/types/engagement";

function Card({
  value,
  title,
  foot,
  alert,
}: {
  value: number;
  title: string;
  foot: string;
  alert?: boolean;
}) {
  return (
    <article>
      <p>{title}</p>
      <b>{value}</b>
      <small className={alert && value > 0 ? "red" : "green"}>{foot}</small>
    </article>
  );
}

export function TeamPulse({
  engagements,
  loading,
  onOpenSection,
}: {
  engagements: Engagement[];
  loading: boolean;
  onOpenSection: (section: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  // One pass over the list instead of six separate .filter() scans per render.
  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    let withUpdates = 0;
    let stale = 0;

    for (const item of engagements) {
      byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
      if (item.progress) withUpdates += 1;
      if (item.status !== "Completed" && staleness(item.updatedAt)?.overdue) {
        stale += 1;
      }
    }

    return {
      byStatus,
      withUpdates,
      stale,
      active: engagements.length - (byStatus.get("Completed") ?? 0),
      get: (status: string) => byStatus.get(status) ?? 0,
    };
  }, [engagements]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return engagements.filter((item) => {
      if (filter !== "All" && item.status !== filter) return false;
      if (!needle) return true;
      return `${item.customer} ${item.title} ${item.products} ${item.environment} ${item.owner}`
        .toLowerCase()
        .includes(needle);
    });
  }, [engagements, filter, query]);

  const blockers = counts.get("Blocked");

  return (
    <>
      <section className="signal">
        <div>
          <p className="label">TEAM SIGNAL</p>
          <h2>
            {blockers
              ? `Delivery is steady. ${blockers} ${blockers === 1 ? "blocker needs" : "blockers need"} intervention.`
              : "Delivery is moving without active blockers."}
          </h2>
          <p>
            {engagements.length} engagements are tracked. Weekly updates become the
            shared operating record.
            {counts.stale > 0 &&
              ` ${counts.stale} ${counts.stale === 1 ? "engagement has" : "engagements have"} no update in over a week.`}
          </p>
        </div>
        <div className="signalStats">
          <span>
            <b>{counts.active}</b>active items
          </span>
          <span>
            <b>{blockers}</b>blockers
          </span>
          <span>
            <b>{counts.withUpdates}</b>weekly updates
          </span>
        </div>
      </section>

      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="metrics">
          <Card value={counts.get("In progress")} title="In progress" foot="Active delivery" />
          <Card
            value={counts.get("Awaiting customer")}
            title="Awaiting customer"
            foot="Follow-up due"
          />
          <Card value={blockers} title="Blocked" foot="Needs attention" alert />
          <Card
            value={counts.get("Completed")}
            title="Completed"
            foot="Delivery outcomes"
          />
        </div>
      )}

      <section className="panel">
        <div className="heading">
          <div>
            <h2>Engagement pulse</h2>
            <p>Live state from submitted weekly updates</p>
          </div>
          <div className="filters" role="group" aria-label="Filter by status">
            {["All", ...ENGAGEMENT_STATUSES].map((status) => (
              <button
                key={status}
                type="button"
                className={filter === status ? "selected" : ""}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <input
          className="pulse-search"
          placeholder="Search customer, product, or owner"
          aria-label="Search engagements"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="table">
          <div className="tr th">
            <span>ENGAGEMENT</span>
            <span>STATUS</span>
            <span>THIS WEEK</span>
            <span>NEXT STEP</span>
            <span>UPDATED</span>
          </div>

          {loading ? (
            <SkeletonRows rows={4} columns={5} />
          ) : (
            shown.map((item) => {
              const age = staleness(item.updatedAt);
              return (
                <div className="tr" key={item.id}>
                  <span>
                    <strong>{item.customer}</strong>
                    <small>
                      {item.title} · {item.environment} · {item.architecture}
                    </small>
                  </span>
                  <span>
                    <Badge status={item.status} />
                  </span>
                  <span>
                    {item.progress ?? "No weekly update yet"}
                    {item.risk && item.risk !== "None" && (
                      <small className="risk">{item.risk}</small>
                    )}
                  </span>
                  <span>{item.nextStep ?? "Add the first weekly update"}</span>
                  <span>
                    {formatDate(item.updatedAt)}
                    {age && item.status !== "Completed" && (
                      <small className={age.overdue ? "risk" : ""}>{age.label}</small>
                    )}
                  </span>
                </div>
              );
            })
          )}

          {!loading && !shown.length && (
            <p className="empty-row">
              {engagements.length
                ? "No engagements match this filter."
                : "No engagements yet. Create the first one to start the pulse."}
            </p>
          )}
        </div>
      </section>

      <div className="two">
        <section className="panel">
          <p className="label">IMPROVEMENTS</p>
          <h2>Make the next delivery easier.</h2>
          <p>
            Capture documentation, process, automation, and knowledge contributions
            independently from customer work.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => onOpenSection("Improvements")}
          >
            Open improvements
          </button>
        </section>
        <section className="panel">
          <p className="label">TEAM DEVELOPMENT</p>
          <h2>Architecture readiness</h2>
          <p>
            Track separate capability evidence for HA, resiliency/DR, capacity sizing,
            cloud-native patterns, and distribution.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => onOpenSection("Growth")}
          >
            Open growth plan
          </button>
        </section>
      </div>
    </>
  );
}
