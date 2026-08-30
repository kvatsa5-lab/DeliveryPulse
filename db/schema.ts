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
