export interface Engagement {
  id: number;
  customer: string;
  title: string;
  products: string;
  environment: string;
  architecture: string;
  status: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  progress?: string;
  nextStep?: string;
  risk?: string;
}

export interface WeeklyUpdate {
  id: number;
  engagementId: number;
  weekOf: string;
  progress: string;
  nextStep: string;
  risk: string;
  submittedBy: string;
  submittedAt: string;
}

export interface EngagementWithLatestUpdate extends Engagement {
  progress?: string;
  nextStep?: string;
  risk?: string;
  submittedAt?: string;
}
