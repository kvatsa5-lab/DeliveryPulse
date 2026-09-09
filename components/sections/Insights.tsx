"use client";

import { useMemo } from "react";
import { staleness } from "@/lib/utils/date";
import type { Engagement } from "@/types/engagement";
import type { Runbook } from "@/types/operating";

/**
 * Derived insight panels. The previous version rendered five fixed-height bars
 * that were pure decoration -- these are computed from the real record set, so
 * the numbers move when the data does.
 */
export function Insights({
  engagements,
  runbooks,
}: {
  engagements: Engagement[];
  runbooks: Runbook[];
}) {
  const stats = useMemo(() => {
    const byEnvironment = new Map<string, number>();
    const byArchitecture = new Map<string, number>();
    let completed = 0;
    let blocked = 0;
    let stale = 0;
    let missingUpdate = 0;

    for (const item of engagements) {
      byEnvironment.set(item.environment, (byEnvironment.get(item.environment) ?? 0) + 1);
      byArchitecture.set(
        item.architecture,
        (byArchitecture.get(item.architecture) ?? 0) + 1
      );
      if (item.status === "Completed") completed += 1;
      if (item.status === "Blocked") blocked += 1;
      if (!item.progress) missingUpdate += 1;
      if (item.status !== "Completed" && staleness(item.updatedAt)?.overdue) stale += 1;
    }

    const topEnvironments = [...byEnvironment.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const max = Math.max(1, ...topEnvironments.map(([, count]) => count));

    return {
      completed,
      blocked,
      stale,
      missingUpdate,
      topEnvironments,
      max,
      awaitingReview: runbooks.filter((item) => item.approval !== "Approved").length,
      approved: runbooks.filter((item) => item.approval === "Approved").length,
      coverage: engagements.length
        ? Math.round(
            ((engagements.length - missingUpdate) / engagements.length) * 100
          )
        : 0,
    };
  }, [engagements, runbooks]);

  return (
    <>
      <div className="two">
        <section className="panel insight">
          <p className="label">PILOT METRICS</p>
          <h2>Current delivery outcomes</h2>
          <b>
            {stats.completed} <small>completed engagements</small>
          </b>
          {stats.topEnvironments.length ? (
            <>
              <div className="bars">
                {stats.topEnvironments.map(([environment, count]) => (
                  <i
                    key={environment}
                    style={{ height: `${(count / stats.max) * 100}%` }}
                    title={`${environment}: ${count}`}
                  />
                ))}
              </div>
              <div className="bar-labels">
                {stats.topEnvironments.map(([environment, count]) => (
                  <small key={environment}>
                    {environment}
                    <strong>{count}</strong>
                  </small>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-row">
              Environment mix appears once engagements are tracked.
            </p>
          )}
        </section>

        <section className="panel">
          <p className="label">CHECK-IN HEALTH</p>
          <h2>Weekly update coverage</h2>
          <b className="insight-figure">
            {stats.coverage}% <small>of engagements have an update</small>
          </b>
          <ul className="insight-list">
            <li>
              <span>Never updated</span>
              <strong className={stats.missingUpdate ? "red" : "green"}>
                {stats.missingUpdate}
              </strong>
            </li>
            <li>
              <span>Overdue (over a week)</span>
              <strong className={stats.stale ? "red" : "green"}>{stats.stale}</strong>
            </li>
            <li>
              <span>Active blockers</span>
              <strong className={stats.blocked ? "red" : "green"}>{stats.blocked}</strong>
            </li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <p className="label">RUNBOOK READINESS</p>
        <h2>Approved knowledge</h2>
        <ul className="insight-list">
          <li>
            <span>Approved runbooks</span>
            <strong className="green">{stats.approved}</strong>
          </li>
          <li>
            <span>Awaiting approval</span>
            <strong className={stats.awaitingReview ? "red" : "green"}>
              {stats.awaitingReview}
            </strong>
          </li>
        </ul>
      </section>
    </>
  );
}
