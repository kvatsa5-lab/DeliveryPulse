export const ENGAGEMENT_STATUSES = [
  "Not started",
  "In progress",
  "Awaiting customer",
  "Blocked",
  "Completed",
] as const;

export const IMPROVEMENT_CATEGORIES = [
  "Documentation",
  "Process",
  "Automation",
  "Knowledge sharing",
] as const;

export const IMPROVEMENT_STATUS = ["Proposed", "In progress", "Completed"] as const;

export const RUNBOOK_APPROVAL_STATUS = [
  "Review needed",
  "Approved",
  "Deprecated",
] as const;

export const SKILL_RATINGS = [
  "Learning",
  "Working",
  "Independent",
  "Advanced",
] as const;

export const NAV_ITEMS = [
  "My work",
  "Team pulse",
  "Insights",
  "Runbook library",
  "Improvements",
  "Growth",
] as const;

export const ENVIRONMENTS = [
  "AWS",
  "Azure",
  "GCP",
  "On-premises",
  "Kubernetes",
  "OpenShift",
] as const;

export const ARCHITECTURES = [
  "Single node",
  "HA",
  "Resiliency / DR",
  "Scalability / distribution",
  "Migration / upgrade",
] as const;

export const PRODUCTS = [
  "Nexus Repository",
  "IQ Server",
  "Lifecycle",
  "Repository Firewall",
  "SBOM",
] as const;
