import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, numeric, integer, date, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
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
  profileId: uuid("profile_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),
  retainerAmount: numeric("retainer_amount"), // Monthly retainer amount for auto-invoicing
  billingDay: integer("billing_day"), // Day of month for auto-invoicing (e.g., 25 for 25th)
  monthlyRetainerHours: numeric("monthly_retainer_hours"), // Total hours included in monthly retainer (e.g., 40)
  usedRetainerHours: numeric("used_retainer_hours").default("0"), // Hours used in current billing cycle
  retainerHoursResetDate: date("retainer_hours_reset_date"), // When hours last reset (typically matches billing day)
  leadValue: numeric("lead_value"), // Value per lead for pipeline calculation (e.g., 500 = $500 per lead)
  leadToOpportunityRate: numeric("lead_to_opportunity_rate"), // DEPRECATED: e.g., 0.30 = 30% of leads become opportunities
  opportunityToCloseRate: numeric("opportunity_to_close_rate"), // DEPRECATED: e.g., 0.25 = 25% of opportunities close
  averageDealSize: numeric("average_deal_size"), // DEPRECATED: e.g., 5000 = $5,000 per deal
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
}, (table) => ({
  clientIdIdx: index("projects_client_id_idx").on(table.clientId),
}));

// TASKS
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  status: text("status").notNull(), // 'Pending', 'In Progress', 'Completed'
  dueDate: date("due_date"),
  priority: text("priority").default("Medium"), // 'High', 'Medium', 'Low'
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }), // Link to strategic initiative
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("tasks_project_id_idx").on(table.projectId),
}));

// STAFF ASSIGNMENTS (Links staff to tasks)
export const staffAssignments = pgTable("staff_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  staffProfileId: uuid("staff_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdIdx: index("staff_assignments_task_id_idx").on(table.taskId),
  staffProfileIdIdx: index("staff_assignments_staff_profile_id_idx").on(table.staffProfileId),
}));

// INVOICES
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  totalAmount: numeric("total_amount").notNull(),
  status: text("status").notNull(), // 'Draft', 'Due', 'Paid', 'Overdue'
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  pdfUrl: text("pdf_url"),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("invoices_client_id_idx").on(table.clientId),
}));

// INVOICE LINE ITEMS
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price").notNull(),
  lineTotal: numeric("line_total").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  invoiceIdIdx: index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
}));

// Type definitions for jsonb fields
export type ObservationInsight = {
  label: string;
  value: string;
  context?: string;
};

// INITIATIVES (Strategic AI-powered recommendations with task breakdown)
export const initiatives = pgTable("initiatives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  observation: text("observation").notNull(),
  observationInsights: jsonb("observation_insights").$type<ObservationInsight[]>(), // Structured data: [{label, value, context}]
  proposedAction: text("proposed_action").notNull(),
  actionTasks: jsonb("action_tasks").$type<string[]>(), // Array of task strings
  status: text("status").notNull(), // 'Needs Review', 'Awaiting Approval', 'Approved', 'In Progress', 'Completed', 'Measured'
  cost: numeric("cost"),
  estimatedHours: numeric("estimated_hours"), // Hours needed if using retainer hours
  billingType: text("billing_type"), // 'cost' or 'hours' - indicates payment method
  impact: text("impact"), // 'High', 'Medium', 'Low'
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  objectiveId: uuid("objective_id").references(() => clientObjectives.id, { onDelete: "set null" }), // Link to a strategic objective
  sentToClient: text("sent_to_client").default("false"), // Whether sent to client
  clientResponse: text("client_response"), // 'pending', 'approved', 'rejected', 'discussing'
  clientFeedback: text("client_feedback"), // Client's comments/feedback
  responseViewedByAdmin: text("response_viewed_by_admin").default("false"), // Whether admin has viewed client response
  triggerMetric: text("trigger_metric"), // The metric that triggered this initiative
  baselineValue: numeric("baseline_value"), // Starting value of the metric
  startDate: date("start_date"), // When initiative tracking began
  implementationDate: date("implementation_date"), // When initiative was completed
  measuredImprovement: numeric("measured_improvement"), // Final measured improvement percentage
  lastEditedAt: timestamp("last_edited_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp - items deleted after 30 days
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("initiatives_client_id_idx").on(table.clientId),
}));

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
  organicImpressions: integer("organic_impressions").default(0),
  organicClicks: integer("organic_clicks").default(0),
  avgPosition: numeric("avg_position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdDateIdx: index("daily_metrics_client_id_date_idx").on(table.clientId, table.date),
}));

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
  ga4LeadEventName: text("ga4_lead_event_name"), // The GA4 Key Event name that represents a lead (e.g., 'generate_lead', 'form_submission')
  gscSiteUrl: text("gsc_site_url"), // The specific Search Console site URL
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
}, (table) => ({
  clientIdIdx: index("client_objectives_client_id_idx").on(table.clientId),
}));

// CLIENT MESSAGES (Chat messages between clients and account managers)
export const clientMessages = pgTable("client_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  senderRole: text("sender_role").notNull(), // 'Client' or 'Admin'
  isRead: text("is_read").default("false"), // Using text for boolean compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("client_messages_client_id_idx").on(table.clientId),
}));

// NOTIFICATIONS (Centralized notification system)
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'message', 'initiative_response', 'system', 'task_assigned', etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"), // Optional URL to navigate to when clicked
  isRead: text("is_read").default("false"), // Using text for boolean compatibility
  isArchived: text("is_archived").default("false"), // Using text for boolean compatibility
  metadata: text("metadata"), // JSON stringified metadata for additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("notifications_user_id_idx").on(table.userId),
  isReadIdx: index("notifications_is_read_idx").on(table.isRead),
  isArchivedIdx: index("notifications_is_archived_idx").on(table.isArchived),
}));

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

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertInitiativeSchema = createInsertSchema(initiatives).omit({
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

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Admin user creation schemas
export const createClientUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  companyName: z.string().min(1, "Company name is required"),
});

export const createStaffAdminUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["Staff", "Admin"], {
    errorMap: () => ({ message: "Role must be Staff or Admin" })
  }),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateClientUser = z.infer<typeof createClientUserSchema>;
export type CreateStaffAdminUser = z.infer<typeof createStaffAdminUserSchema>;

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

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

export type Initiative = typeof initiatives.$inferSelect;
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type InsertDailyMetric = z.infer<typeof insertDailyMetricSchema>;

export type ClientIntegration = typeof clientIntegrations.$inferSelect;
export type InsertClientIntegration = z.infer<typeof insertClientIntegrationSchema>;

export type ClientObjective = typeof clientObjectives.$inferSelect;
export type InsertClientObjective = z.infer<typeof insertClientObjectiveSchema>;

export type ClientMessage = typeof clientMessages.$inferSelect;
export type InsertClientMessage = z.infer<typeof insertClientMessageSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Extended types for frontend use
export type ProjectWithClient = Project & { client?: Client };
export type TaskWithProject = Task & { project?: Project };
export type InvoiceWithClient = Invoice & { client?: Client };
export type InvoiceWithLineItems = Invoice & { lineItems?: InvoiceLineItem[] };
export type InvoiceWithClientAndLineItems = Invoice & { client?: Client; lineItems?: InvoiceLineItem[] };
export type InitiativeWithClient = Initiative & { client?: Client };
export type TaskWithAssignments = Task & { assignments?: StaffAssignment[] };
