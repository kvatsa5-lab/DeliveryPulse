export interface Improvement {
  id: number;
  title: string;
  category: string;
  owner: string;
  impact: string;
  status: string;
  created_at: string;
}

export interface RunbookAttachment {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface Runbook {
  id: number;
  title: string;
  product: string;
  environment: string;
  architecture: string;
  approval: string;
  owner: string;
  reviewed_at: string;
  attachments: RunbookAttachment[];
}

export interface SkillAssessment {
  id: number;
  engineer: string;
  skill: string;
  rating: string;
  evidence: string;
  updated_at: string;
}

export type OperatingRecordType = "improvements" | "runbooks" | "assessments";
