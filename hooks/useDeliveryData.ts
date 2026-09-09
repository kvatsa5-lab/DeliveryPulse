"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson } from "@/lib/api-client";
import type { Engagement } from "@/types/engagement";
import type { Improvement, Runbook, SkillAssessment } from "@/types/operating";

interface Member {
  email: string;
  role: string;
  canApprove: boolean;
}

export interface DeliveryData {
  member: Member | null;
  engagements: Engagement[];
  improvements: Improvement[];
  runbooks: Runbook[];
  assessments: SkillAssessment[];
  loading: boolean;
  /** Set only when the whole workspace failed to load (e.g. access denied). */
  fatalError: string;
  reload: () => Promise<void>;
}

/**
 * Loads every workspace collection in parallel.
 *
 * Engagements are the gate: if that request fails the user has no access and we
 * surface a fatal error. The operating collections degrade to empty lists so one
 * failing panel never blanks the whole dashboard.
 */
export function useDeliveryData(): DeliveryData {
  const [member, setMember] = useState<Member | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [assessments, setAssessments] = useState<SkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setFatalError("");

    try {
      const optional = <T,>(path: string): Promise<{ records: T[] }> =>
        getJson<{ records: T[] }>(path).catch(() => ({ records: [] }));

      // One round of parallel requests instead of engagements-then-the-rest.
      const [engagementResult, me, improvementResult, runbookResult, assessmentResult] =
        await Promise.all([
          getJson<{ engagements: Engagement[] }>("/api/engagements"),
          getJson<{ member: Member }>("/api/me").catch(() => null),
          optional<Improvement>("/api/operating?type=improvements"),
          optional<Runbook>("/api/operating?type=runbooks"),
          optional<SkillAssessment>("/api/operating?type=assessments"),
        ]);

      setEngagements(engagementResult.engagements ?? []);
      setMember(me?.member ?? null);
      setImprovements(improvementResult.records ?? []);
      setRunbooks(runbookResult.records ?? []);
      setAssessments(assessmentResult.records ?? []);
    } catch (error) {
      setFatalError(
        error instanceof ApiError
          ? error.message
          : "Delivery Pulse could not load right now. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch. The lint rule guards against cascading renders from
    // synchronous setState in effects; here the initial load genuinely has to
    // start from the effect, and `reload` is stable (useCallback with no deps)
    // so this runs exactly once. Replace with a data library if one is adopted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return {
    member,
    engagements,
    improvements,
    runbooks,
    assessments,
    loading,
    fatalError,
    reload,
  };
}
