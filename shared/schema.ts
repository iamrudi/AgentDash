import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, numeric, integer, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PROFILES (Master table for all users)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // 'Admin', 'Client', 'Staff'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// USERS (Auth table)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CLIENTS (Company-level information)
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PROJECTS
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull(), // 'Active', 'Pending', 'Completed'
  description: text("description"),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TASKS
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  status: text("status").notNull(), // 'Pending', 'In Progress', 'Completed'
  dueDate: date("due_date"),
  priority: text("priority").default("Medium"), // 'High', 'Medium', 'Low'
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// STAFF ASSIGNMENTS (Links staff to tasks)
export const staffAssignments = pgTable("staff_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  staffProfileId: uuid("staff_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// INVOICES
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: numeric("amount").notNull(),
  status: text("status").notNull(), // 'Paid', 'Pending', 'Overdue'
  dueDate: date("due_date").notNull(),
  pdfUrl: text("pdf_url"),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RECOMMENDATIONS (For the AI Engine)
export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  observation: text("observation").notNull(),
  proposedAction: text("proposed_action").notNull(),
  status: text("status").notNull(), // 'Draft', 'Sent', 'Approved', 'Rejected', 'Discussing', 'Implemented'
  cost: numeric("cost"),
  impact: text("impact"), // 'High', 'Medium', 'Low'
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  sentToClient: text("sent_to_client").default("false"), // Whether sent to client
  clientResponse: text("client_response"), // 'pending', 'approved', 'rejected', 'discussing'
  clientFeedback: text("client_feedback"), // Client's comments/feedback
  responseViewedByAdmin: text("response_viewed_by_admin").default("false"), // Whether admin has viewed client response
  lastEditedAt: timestamp("last_edited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DAILY METRICS (12-month rolling data for AI & dashboards)
export const dailyMetrics = pgTable("daily_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'Google Ads', 'Facebook', 'Organic', etc.
  sessions: integer("sessions").default(0),
  conversions: integer("conversions").default(0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  spend: numeric("spend").default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CLIENT INTEGRATIONS (OAuth tokens for external services)
export const clientIntegrations = pgTable("client_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceName: text("service_name").notNull(), // 'GA4', 'Google Ads', etc.
  accessToken: text("access_token"), // Encrypted before storage
  refreshToken: text("refresh_token"), // Encrypted before storage
  accessTokenIv: text("access_token_iv"), // IV for access token encryption
  refreshTokenIv: text("refresh_token_iv"), // IV for refresh token encryption
  accessTokenAuthTag: text("access_token_auth_tag"), // Auth tag for access token
  refreshTokenAuthTag: text("refresh_token_auth_tag"), // Auth tag for refresh token
  expiresAt: timestamp("expires_at"),
  ga4PropertyId: text("ga4_property_id"), // The specific GA4 property ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueClientService: uniqueIndex("client_integrations_client_service_idx").on(table.clientId, table.serviceName),
}));

// CLIENT OBJECTIVES (Client goals for AI recommendations)
export const clientObjectives = pgTable("client_objectives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  description: text("description").notNull(), // e.g., 'Increase qualified organic leads by 20% in Q4'
  targetMetric: text("target_metric").notNull(), // e.g., 'conversions', 'sessions', 'revenue'
  isActive: text("is_active").default("true"), // Using text for boolean compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// CLIENT MESSAGES (Chat messages between clients and account managers)
export const clientMessages = pgTable("client_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  senderRole: text("sender_role").notNull(), // 'Client' or 'Admin'
  isRead: text("is_read").default("false"), // Using text for boolean compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertStaffAssignmentSchema = createInsertSchema(staffAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
});

export const insertDailyMetricSchema = createInsertSchema(dailyMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertClientIntegrationSchema = createInsertSchema(clientIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientObjectiveSchema = createInsertSchema(clientObjectives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientMessageSchema = createInsertSchema(clientMessages).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type StaffAssignment = typeof staffAssignments.$inferSelect;
export type InsertStaffAssignment = z.infer<typeof insertStaffAssignmentSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type InsertDailyMetric = z.infer<typeof insertDailyMetricSchema>;

export type ClientIntegration = typeof clientIntegrations.$inferSelect;
export type InsertClientIntegration = z.infer<typeof insertClientIntegrationSchema>;

export type ClientObjective = typeof clientObjectives.$inferSelect;
export type InsertClientObjective = z.infer<typeof insertClientObjectiveSchema>;

export type ClientMessage = typeof clientMessages.$inferSelect;
export type InsertClientMessage = z.infer<typeof insertClientMessageSchema>;

// Extended types for frontend use
export type ProjectWithClient = Project & { client?: Client };
export type TaskWithProject = Task & { project?: Project };
export type InvoiceWithClient = Invoice & { client?: Client };
export type RecommendationWithClient = Recommendation & { client?: Client };
export type TaskWithAssignments = Task & { assignments?: StaffAssignment[] };
