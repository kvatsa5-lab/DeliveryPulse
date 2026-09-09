"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils/date";
import type { Improvement, SkillAssessment } from "@/types/operating";

/** Shared shell for the simple list sections (improvements, growth). */
function ListPanel({
  label,
  title,
  description,
  action,
  onAdd,
  loading,
  empty,
  rows,
}: {
  label: string;
  title: string;
  description: string;
  action: string;
  onAdd: () => void;
  loading: boolean;
  empty: string;
  rows: ReactNode[];
}) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="label">{label}</p>
          <h2>{title}</h2>
          <p>{description}</p>
          <button type="button" className="secondary" onClick={onAdd}>
            {action}
          </button>
        </div>
      </div>
      {loading ? <SkeletonList rows={3} /> : rows}
      {!loading && !rows.length && <p className="empty-row">{empty}</p>}
    </section>
  );
}

export function Improvements({
  improvements,
  loading,
  onAdd,
}: {
  improvements: Improvement[];
  loading: boolean;
  onAdd: () => void;
}) {
  return (
    <ListPanel
      label="IMPROVEMENTS"
      title="Improvements that make the next delivery easier."
      description="Capture documentation, process, automation, and knowledge contributions with evidence of impact."
      action="+ Log improvement"
      onAdd={onAdd}
      loading={loading}
      empty="No improvements recorded yet. Add the first contribution that helps the next delivery."
      rows={improvements.map((item) => (
        <div className="record" key={item.id}>
          <span>
            <strong>{item.title}</strong>
            <small>
              {item.category} · {item.owner} · {formatDate(item.created_at)}
            </small>
          </span>
          <span>
            <Badge status={item.status} />
            <small>{item.impact}</small>
          </span>
        </div>
      ))}
    />
  );
}

export function Growth({
  assessments,
  loading,
  onAdd,
}: {
  assessments: SkillAssessment[];
  loading: boolean;
  onAdd: () => void;
}) {
  return (
    <ListPanel
      label="SKILL COVERAGE"
      title="Growth plan"
      description="Separate product and architecture ratings, grounded in delivery evidence."
      action="+ Add assessment"
      onAdd={onAdd}
      loading={loading}
      empty="No skill assessments recorded yet. Add a rating with a concrete delivery example."
      rows={assessments.map((item) => (
        <div className="skill" key={item.id}>
          <strong>
            {item.skill}
            <small>{item.engineer}</small>
          </strong>
          <em className={item.rating.toLowerCase()}>{item.rating}</em>
          <small>{item.evidence}</small>
        </div>
      ))}
    />
  );
}
