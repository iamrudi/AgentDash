import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, numeric, integer, date, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Constants
export const aiProviderEnum = ["gemini", "openai"] as const;

// AGENCIES (Tenant isolation - each agency is a separate tenant)
export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AGENCY SETTINGS (Agency-level configuration and preferences)
export const agencySettings = pgTable("agency_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }).unique(),
  aiProvider: text("ai_provider").notNull().default("gemini"), // 'gemini' or 'openai'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("agency_settings_agency_id_idx").on(table.agencyId),
}));

// NOTE: Users are now managed by Supabase Auth (auth.users table)
// We keep this table definition for backward compatibility but it's not actively used
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PROFILES (Master table for all users - ID matches Supabase Auth user ID)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // This IS the Supabase Auth user ID (no default, set explicitly)
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // 'Admin', 'Client', 'Staff'
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }), // For Admin/Staff only, null for Client users
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("profiles_agency_id_idx").on(table.agencyId),
}));

// CLIENTS (Company-level information)
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }), // Every client belongs to an agency
  businessContext: text("business_context"), // Strategic business context for AI recommendations
  retainerAmount: numeric("retainer_amount"), // Monthly retainer amount for auto-invoicing
  billingDay: integer("billing_day"), // Day of month for auto-invoicing (e.g., 25 for 25th)
  monthlyRetainerHours: numeric("monthly_retainer_hours"), // Total hours included in monthly retainer (e.g., 40)
  usedRetainerHours: numeric("used_retainer_hours").default("0"), // Hours used in current billing cycle
  retainerHoursResetDate: date("retainer_hours_reset_date"), // When hours last reset (typically matches billing day)
  leadValue: numeric("lead_value"), // Value per lead for pipeline calculation (e.g., 500 = $500 per lead)
  leadToOpportunityRate: numeric("lead_to_opportunity_rate"), // DEPRECATED: e.g., 0.30 = 30% of leads become opportunities
  opportunityToCloseRate: numeric("opportunity_to_close_rate"), // DEPRECATED: e.g., 0.25 = 25% of opportunities close
  averageDealSize: numeric("average_deal_size"), // DEPRECATED: e.g., 5000 = $5,000 per deal
  leadEvents: text("lead_events").array(), // Selected GA4 key events to track as leads (e.g., ['generate_lead', 'form_submit'])
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("clients_agency_id_idx").on(table.agencyId),
}));

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

// =================================================================
// CRM SCHEMA - Customer Relationship Management
// =================================================================

// COMPANIES
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  website: text("website"),
  phone: text("phone"),
  address: text("address"),
  type: text("type").default("lead"), // 'customer', 'supplier', 'partner', 'lead'
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("companies_agency_id_idx").on(table.agencyId),
}));

// CONTACTS
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("contacts_agency_id_idx").on(table.agencyId),
  companyIdIdx: index("contacts_company_id_idx").on(table.companyId),
}));

// DEALS
export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  stage: text("stage").default("lead").notNull(), // 'lead', 'qualified', 'proposal', 'closed-won', 'closed-lost'
  value: integer("value"), // Store in cents
  closeDate: date("close_date"),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("deals_agency_id_idx").on(table.agencyId),
  contactIdIdx: index("deals_contact_id_idx").on(table.contactId),
  companyIdIdx: index("deals_company_id_idx").on(table.companyId),
}));

// =================================================================
// PROPOSALS - AI-Powered Proposal Builder
// =================================================================

// PROPOSAL TEMPLATES (Reusable content blocks for proposals)
export const proposalTemplates = pgTable("proposal_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").default("Core").notNull(), // 'Core', 'Services', 'Pricing', 'Case Studies', 'Custom'
  content: text("content").notNull(), // Store as Markdown
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("proposal_templates_agency_id_idx").on(table.agencyId),
  categoryIdx: index("proposal_templates_category_idx").on(table.category),
}));

// PROPOSALS (Custom proposals linked to deals)
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").default("draft").notNull(), // 'draft', 'sent', 'accepted', 'rejected'
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  dealIdIdx: index("proposals_deal_id_idx").on(table.dealId),
  agencyIdIdx: index("proposals_agency_id_idx").on(table.agencyId),
}));

// PROPOSAL SECTIONS (Individual sections within a proposal)
export const proposalSections = pgTable("proposal_sections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Section title
  content: text("content").notNull(), // Final Markdown content
  order: integer("order").notNull(), // Display order
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  proposalIdIdx: index("proposal_sections_proposal_id_idx").on(table.proposalId),
  orderIdx: index("proposal_sections_order_idx").on(table.proposalId, table.order),
}));

// =================================================================
// FORMS - Lead Capture Form Builder
// =================================================================

// FORMS (Custom lead capture forms for agencies)
export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  publicId: uuid("public_id").defaultRandom().notNull().unique(), // For public access without exposing internal ID
  name: text("name").notNull(),
  description: text("description"),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  isDeleted: integer("is_deleted").default(0).notNull(), // Soft delete: 0 = active, 1 = deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("forms_agency_id_idx").on(table.agencyId),
  publicIdIdx: uniqueIndex("forms_public_id_idx").on(table.publicId),
  agencyNameIdx: uniqueIndex("forms_agency_name_idx").on(table.agencyId, table.name), // Unique form name per agency
}));

// FORM FIELDS (Configurable fields for each form)
export const formFields = pgTable("form_fields", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(), // 'text', 'email', 'textarea', 'phone'
  placeholder: text("placeholder"),
  required: integer("required").default(0).notNull(), // 0 = false, 1 = true
  sortOrder: integer("sort_order").notNull(), // For ordering fields in the form
  metadata: jsonb("metadata"), // Future: store additional field configurations
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  formIdIdx: index("form_fields_form_id_idx").on(table.formId),
  sortOrderIdx: index("form_fields_sort_order_idx").on(table.formId, table.sortOrder),
}));

// FORM SUBMISSIONS (Captured lead data from public form submissions)
export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  submission: jsonb("submission").notNull(), // Complete form data as JSON
  ipAddress: text("ip_address"), // Track IP for rate limiting and analytics
  userAgent: text("user_agent"), // Track user agent for analytics
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  formIdIdx: index("form_submissions_form_id_idx").on(table.formId),
  agencyIdIdx: index("form_submissions_agency_id_idx").on(table.agencyId),
  submittedAtIdx: index("form_submissions_submitted_at_idx").on(table.submittedAt),
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
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // Project created when approved
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }), // Invoice generated when approved
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

// AGENCY INTEGRATIONS (Agency-level integrations that can be shared across clients)
export const agencyIntegrations = pgTable("agency_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  serviceName: text("service_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAgencyService: uniqueIndex("agency_integrations_agency_service_idx").on(table.agencyId, table.serviceName),
}));

// AGENCY INTEGRATION CLIENT ACCESS (Controls which clients can use agency integrations)
export const agencyIntegrationClientAccess = pgTable("agency_integration_client_access", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyIntegrationId: uuid("agency_integration_id").notNull().references(() => agencyIntegrations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueIntegrationClient: uniqueIndex("agency_integration_client_access_idx").on(table.agencyIntegrationId, table.clientId),
  agencyIntegrationIdIdx: index("access_agency_integration_id_idx").on(table.agencyIntegrationId),
  clientIdIdx: index("access_client_id_idx").on(table.clientId),
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

// SYSTEM SETTINGS (Global configuration)
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // 'cors_allowed_origins', 'api_rate_limit', etc.
  value: jsonb("value").notNull(), // JSON value for flexible storage
  description: text("description"), // Human-readable description
  updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }), // Who last updated this setting
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAgencySchema = createInsertSchema(agencies).omit({
  id: true,
  createdAt: true,
});

export const insertAgencySettingSchema = createInsertSchema(agencySettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    aiProvider: z.enum(aiProviderEnum),
  });

export const updateAgencySettingSchema = z.object({
  aiProvider: z.enum(aiProviderEnum),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true, // id is required (Supabase Auth user ID)
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

export const insertAgencyIntegrationSchema = createInsertSchema(agencyIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyIntegrationClientAccessSchema = createInsertSchema(agencyIntegrationClientAccess).omit({
  id: true,
  createdAt: true,
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

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// CRM Insert Schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Proposal Insert Schemas
export const insertProposalTemplateSchema = createInsertSchema(proposalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSectionSchema = createInsertSchema(proposalSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Form Insert Schemas
export const insertFormSchema = createInsertSchema(forms).omit({
  id: true,
  publicId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormFieldSchema = createInsertSchema(formFields).omit({
  id: true,
  createdAt: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  submittedAt: true,
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

export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;

export type AgencySetting = typeof agencySettings.$inferSelect;
export type InsertAgencySetting = z.infer<typeof insertAgencySettingSchema>;
export type UpdateAgencySetting = z.infer<typeof updateAgencySettingSchema>;

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

export type AgencyIntegration = typeof agencyIntegrations.$inferSelect;
export type InsertAgencyIntegration = z.infer<typeof insertAgencyIntegrationSchema>;

export type AgencyIntegrationClientAccess = typeof agencyIntegrationClientAccess.$inferSelect;
export type InsertAgencyIntegrationClientAccess = z.infer<typeof insertAgencyIntegrationClientAccessSchema>;

export type ClientObjective = typeof clientObjectives.$inferSelect;
export type InsertClientObjective = z.infer<typeof insertClientObjectiveSchema>;

export type ClientMessage = typeof clientMessages.$inferSelect;
export type InsertClientMessage = z.infer<typeof insertClientMessageSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

// CRM Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

// Proposal Types
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type InsertProposalTemplate = z.infer<typeof insertProposalTemplateSchema>;

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;

export type ProposalSection = typeof proposalSections.$inferSelect;
export type InsertProposalSection = z.infer<typeof insertProposalSectionSchema>;

// Form Types
export type Form = typeof forms.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;

export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;

export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;

// Extended form types
export type FormWithFields = Form & { fields?: FormField[] };

// Extended types for frontend use
export type ProjectWithClient = Project & { client?: Client };
export type TaskWithProject = Task & { project?: Project };
export type InvoiceWithClient = Invoice & { client?: Client };
export type InvoiceWithLineItems = Invoice & { lineItems?: InvoiceLineItem[] };
export type InvoiceWithClientAndLineItems = Invoice & { client?: Client; lineItems?: InvoiceLineItem[] };
export type InitiativeWithClient = Initiative & { client?: Client };
export type TaskWithAssignments = Task & { assignments?: StaffAssignment[] };
export type CompanyWithContacts = Company & { contacts?: Contact[] };
export type DealWithContact = Deal & { contact?: Contact };
export type DealWithCompany = Deal & { company?: Company };
export type ProposalWithSections = Proposal & { sections?: ProposalSection[] };
