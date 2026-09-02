import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const engagements = sqliteTable("engagements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customer: text("customer").notNull(),
  title: text("title").notNull(),
  products: text("products").notNull(),
  environment: text("environment").notNull(),
  architecture: text("architecture").notNull(),
  status: text("status").notNull(),
  owner: text("owner").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const weeklyUpdates = sqliteTable("weekly_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  engagementId: integer("engagement_id").notNull(),
  weekOf: text("week_of").notNull(),
  progress: text("progress").notNull(),
  nextStep: text("next_step").notNull(),
  risk: text("risk").notNull(),
  submittedBy: text("submitted_by").notNull(),
  submittedAt: text("submitted_at").notNull(),
});

export const improvements = sqliteTable("improvements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(), category: text("category").notNull(), owner: text("owner").notNull(), impact: text("impact").notNull(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
});
export const runbooks = sqliteTable("runbooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(), product: text("product").notNull(), environment: text("environment").notNull(), architecture: text("architecture").notNull(), approval: text("approval").notNull(), owner: text("owner").notNull(), reviewedAt: text("reviewed_at").notNull(),
});
export const runbookAttachments = sqliteTable("runbook_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runbookId: integer("runbook_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull(),
});
export const skillAssessments = sqliteTable("skill_assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  engineer: text("engineer").notNull(), skill: text("skill").notNull(), rating: text("rating").notNull(), evidence: text("evidence").notNull(), updatedAt: text("updated_at").notNull(),
});
export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }), email: text("email").notNull().unique(), role: text("role").notNull(), active: integer("active").notNull(), createdAt: text("created_at").notNull(),
});
