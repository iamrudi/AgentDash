import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, numeric, integer, date, uniqueIndex, index, jsonb, boolean } from "drizzle-orm/pg-core";
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
  embeddingMaxTokens: integer("embedding_max_tokens").default(8192),
  // Branding / White-labeling logos
  agencyLogo: text("agency_logo"), // URL/path for internal agency portal header
  clientLogo: text("client_logo"), // URL/path for external client portal header
  staffLogo: text("staff_logo"), // URL/path for staff/talent portal header
  // HubSpot CRM Integration (agency-wide)
  hubspotAccessToken: text("hubspot_access_token"), // Encrypted before storage
  hubspotAccessTokenIv: text("hubspot_access_token_iv"), // IV for encryption
  hubspotAccessTokenAuthTag: text("hubspot_access_token_auth_tag"), // Auth tag for encryption
  hubspotPortalId: text("hubspot_portal_id"), // HubSpot portal/account ID for webhook routing
  hubspotWebhookSecret: text("hubspot_webhook_secret"), // Encrypted webhook secret for signature validation
  hubspotWebhookSecretIv: text("hubspot_webhook_secret_iv"),
  hubspotWebhookSecretAuthTag: text("hubspot_webhook_secret_auth_tag"),
  hubspotConnectedAt: timestamp("hubspot_connected_at"),
  // LinkedIn Integration (agency-wide)
  linkedinAccessToken: text("linkedin_access_token"), // Encrypted before storage
  linkedinAccessTokenIv: text("linkedin_access_token_iv"), // IV for encryption
  linkedinAccessTokenAuthTag: text("linkedin_access_token_auth_tag"), // Auth tag for encryption
  linkedinOrganizationId: text("linkedin_organization_id"), // LinkedIn organization/company page ID
  linkedinConnectedAt: timestamp("linkedin_connected_at"),
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
  email: text("email").notNull(), // Mirrored from Supabase Auth for query performance
  role: text("role").notNull(), // 'Admin', 'Client', 'Staff', 'SuperAdmin'
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(), // Platform-wide super admin flag
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }), // For Admin/Staff only, null for Client/SuperAdmin users
  skills: text("skills").array(), // Array of skills for Staff (e.g., ['React', 'SEO', 'Copywriting'])
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("profiles_agency_id_idx").on(table.agencyId),
}));

// AUDIT LOGS (Track Super Admin actions)
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'user.create', 'user.delete', 'user.update_role', 'agency.delete', 'client.delete', etc.
  resourceType: text("resource_type").notNull(), // 'user', 'agency', 'client'
  resourceId: uuid("resource_id"), // ID of the affected resource
  details: jsonb("details"), // Additional context (e.g., old/new values)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  actionIdx: index("audit_logs_action_idx").on(table.action),
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
  workflowExecutionId: uuid("workflow_execution_id"), // Lineage: workflow that created this project
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("projects_client_id_idx").on(table.clientId),
  workflowExecutionIdIdx: index("projects_workflow_execution_id_idx").on(table.workflowExecutionId),
}));

// TASK LISTS (Projects > Task Lists > Tasks hierarchy)
export const taskLists = pgTable("task_lists", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }), // For RLS tenant isolation
  workflowExecutionId: uuid("workflow_execution_id"), // Lineage: workflow that created this list
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("task_lists_project_id_idx").on(table.projectId),
  agencyIdIdx: index("task_lists_agency_id_idx").on(table.agencyId),
  workflowExecutionIdIdx: index("task_lists_workflow_execution_id_idx").on(table.workflowExecutionId),
}));

// TASKS (Now supports: Lists, Subtasks, Start Dates, Time Tracking)
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  status: text("status").notNull(), // 'To Do', 'In Progress', 'Completed', 'Blocked'
  startDate: date("start_date"), // Start date for calendar view (ISO date string)
  dueDate: date("due_date"), // Due date (ISO date string)
  priority: text("priority").default("Medium"), // 'Low', 'Medium', 'High', 'Urgent'
  timeEstimate: numeric("time_estimate").default(sql`0`), // Estimated time in hours (decimal: 2.5 = 2h 30m)
  timeTracked: numeric("time_tracked").default(sql`0`), // Actual time tracked in hours (decimal: 2.5 = 2h 30m)
  listId: uuid("list_id").references(() => taskLists.id, { onDelete: "cascade" }), // NULLABLE TEMPORARILY: Will be enforced after backfill migration
  parentId: uuid("parent_id").references((): any => tasks.id, { onDelete: "cascade" }), // Self-reference for subtasks
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }), // Derived from listId -> project (kept for query performance)
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }), // Link to strategic initiative
  workflowExecutionId: uuid("workflow_execution_id"), // Lineage: workflow that created this task
  idempotencyKey: text("idempotency_key"), // Unique key for workflow-safe upsert (prevents duplicates on retry)
  contentHash: text("content_hash"), // SHA-256 hash of task content for deduplication
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index("tasks_list_id_idx").on(table.listId),
  parentIdIdx: index("tasks_parent_id_idx").on(table.parentId),
  projectIdIdx: index("tasks_project_id_idx").on(table.projectId),
  workflowExecutionIdIdx: index("tasks_workflow_execution_id_idx").on(table.workflowExecutionId),
  idempotencyKeyIdx: index("tasks_idempotency_key_idx").on(table.idempotencyKey),
  contentHashIdx: index("tasks_content_hash_idx").on(table.contentHash),
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

// TASK ACTIVITIES (Track all changes to tasks for audit trail)
export const taskActivities = pgTable("task_activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'created', 'status_changed', 'priority_changed', 'date_changed', 'assignee_added', 'assignee_removed', 'description_changed', 'subtask_created'
  fieldName: text("field_name"), // Name of the field that changed (e.g., 'status', 'priority', 'dueDate')
  oldValue: text("old_value"), // Previous value (stored as string)
  newValue: text("new_value"), // New value (stored as string)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdIdx: index("task_activities_task_id_idx").on(table.taskId),
  userIdIdx: index("task_activities_user_id_idx").on(table.userId),
  createdAtIdx: index("task_activities_created_at_idx").on(table.createdAt),
}));

// TASK RELATIONSHIPS (Links tasks to related tasks)
export const taskRelationships = pgTable("task_relationships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  relatedTaskId: uuid("related_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(), // 'blocks', 'blocked_by', 'relates_to', 'duplicates'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdIdx: index("task_relationships_task_id_idx").on(table.taskId),
  relatedTaskIdIdx: index("task_relationships_related_task_id_idx").on(table.relatedTaskId),
  uniqueRelationship: uniqueIndex("task_relationships_unique").on(table.taskId, table.relatedTaskId, table.relationshipType),
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
  opportunityArtifactId: uuid("opportunity_artifact_id"),
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

// CLIENT ANOMALY THRESHOLDS (per-client anomaly detection configuration)
export const clientAnomalyThresholds = pgTable("client_anomaly_thresholds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(), // 'sessions', 'conversions', 'clicks', etc.
  zScoreThreshold: numeric("z_score_threshold").default("2.5"),
  percentChangeThreshold: numeric("percent_change_threshold").default("30"),
  minDataPoints: integer("min_data_points").default(14),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  clientIdMetricIdx: index("client_anomaly_thresholds_client_metric_idx").on(table.clientId, table.metricType),
}));

export type ClientAnomalyThreshold = typeof clientAnomalyThresholds.$inferSelect;
export type InsertClientAnomalyThreshold = typeof clientAnomalyThresholds.$inferInsert;

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

// TASK MESSAGES (Communication between staff and account managers on specific tasks)
export const taskMessages = pgTable("task_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isRead: text("is_read").default("false"), // Using text for boolean compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdIdx: index("task_messages_task_id_idx").on(table.taskId),
  senderIdIdx: index("task_messages_sender_id_idx").on(table.senderId),
  createdAtIdx: index("task_messages_created_at_idx").on(table.createdAt),
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
  aiProvider: z.enum(aiProviderEnum).optional(),
  agencyLogo: z.string().nullable().optional(),
  clientLogo: z.string().nullable().optional(),
  staffLogo: z.string().nullable().optional(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true, // id is required (Supabase Auth user ID)
});

// Schema for updating user's own profile (Staff Settings page)
export const updateUserProfileSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100).optional(),
  skills: z.array(z.string().max(50)).max(20).optional(), // Max 20 skills, each max 50 chars
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
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

export const insertTaskListSchema = createInsertSchema(taskLists).omit({
  id: true,
  createdAt: true,
});

// Task status and priority enums for validation and type safety
export const taskStatusEnum = ['To Do', 'In Progress', 'Completed', 'Blocked'] as const;
export const taskPriorityEnum = ['Low', 'Medium', 'High', 'Urgent'] as const;

// Base task schema without refinements (for partial updates)
const baseTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(taskStatusEnum),
  priority: z.enum(taskPriorityEnum).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  timeEstimate: z.coerce.number().optional().nullable(),
  timeTracked: z.coerce.number().optional().nullable(),
});

// Complete insert schema with date validation
export const insertTaskSchema = baseTaskSchema.refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.dueDate) >= new Date(data.startDate);
    }
    return true;
  },
  {
    message: "Due date must be after or equal to start date",
    path: ["dueDate"],
  }
);

// Schema for updating tasks (partial updates with same validation)
export const updateTaskSchema = baseTaskSchema.partial().refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.dueDate) >= new Date(data.startDate);
    }
    return true;
  },
  {
    message: "Due date must be after or equal to start date",
    path: ["dueDate"],
  }
);

export const insertStaffAssignmentSchema = createInsertSchema(staffAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertTaskActivitySchema = createInsertSchema(taskActivities).omit({
  id: true,
  createdAt: true,
});

export const insertTaskRelationshipSchema = createInsertSchema(taskRelationships).omit({
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

export const insertTaskMessageSchema = createInsertSchema(taskMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
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

// ==========================================
// WORKFLOW ENGINE TABLES
// ==========================================

// Workflow step types
export const workflowStepTypeEnum = ["signal", "rule", "ai", "action", "branch", "parallel", "agent"] as const;
export const workflowStatusEnum = ["draft", "active", "paused", "archived"] as const;
export const workflowExecutionStatusEnum = ["pending", "running", "completed", "failed", "cancelled"] as const;
export const workflowEventTypeEnum = ["started", "completed", "failed", "skipped", "retrying"] as const;

// WORKFLOWS (Workflow definitions)
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, active, paused, archived
  triggerType: text("trigger_type").notNull(), // 'manual', 'signal', 'schedule', 'webhook'
  triggerConfig: jsonb("trigger_config"), // Configuration for the trigger (e.g., cron expression, signal type)
  steps: jsonb("steps").notNull(), // Array of WorkflowStep definitions
  timeout: integer("timeout").default(300), // Timeout in seconds (default 5 minutes)
  retryPolicy: jsonb("retry_policy"), // { maxRetries: number, backoffMs: number }
  version: integer("version").default(1).notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("workflows_agency_id_idx").on(table.agencyId),
  statusIdx: index("workflows_status_idx").on(table.status),
}));

// WORKFLOW EXECUTIONS (Individual workflow runs)
export const workflowExecutions = pgTable("workflow_executions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, cancelled
  triggerId: text("trigger_id"), // Signal ID or manual trigger reference
  triggerType: text("trigger_type"), // What triggered this execution
  triggerPayload: jsonb("trigger_payload"), // The input data that triggered execution
  inputHash: text("input_hash"), // Hash of inputs for idempotency checking
  outputHash: text("output_hash"), // Hash of outputs for verification
  result: jsonb("result"), // Final output/result of the workflow
  error: text("error"), // Error message if failed
  currentStep: text("current_step"), // ID of currently executing step
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workflowIdIdx: index("workflow_executions_workflow_id_idx").on(table.workflowId),
  agencyIdIdx: index("workflow_executions_agency_id_idx").on(table.agencyId),
  statusIdx: index("workflow_executions_status_idx").on(table.status),
  inputHashIdx: index("workflow_executions_input_hash_idx").on(table.inputHash),
  idempotencyIdx: uniqueIndex("workflow_executions_idempotency_idx").on(table.workflowId, table.inputHash),
}));

// WORKFLOW EVENTS (Step-by-step execution log)
export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: uuid("execution_id").notNull().references(() => workflowExecutions.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  stepId: text("step_id").notNull(), // Reference to step in workflow definition
  stepType: text("step_type").notNull(), // signal, rule, ai, action, branch, parallel
  eventType: text("event_type").notNull(), // started, completed, failed, skipped, retrying
  input: jsonb("input"), // Input data for this step
  output: jsonb("output"), // Output data from this step
  error: text("error"), // Error message if step failed
  durationMs: integer("duration_ms"), // How long the step took
  retryCount: integer("retry_count").default(0),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  executionIdIdx: index("workflow_events_execution_id_idx").on(table.executionId),
  agencyIdIdx: index("workflow_events_agency_id_idx").on(table.agencyId),
  stepIdIdx: index("workflow_events_step_id_idx").on(table.stepId),
  timestampIdx: index("workflow_events_timestamp_idx").on(table.timestamp),
}));

// ==================== RULE ENGINE ====================

// Rule categories for organization
export const ruleCategoryEnum = ["threshold", "anomaly", "lifecycle", "integration", "custom"] as const;

// Rule operator types for conditions
export const ruleOperatorEnum = [
  "gt", "gte", "lt", "lte", "eq", "neq",  // Basic comparison
  "contains", "not_contains", "matches",   // String operations
  "in", "not_in",                          // Array membership
  "percent_change_gt", "percent_change_lt", // Threshold detection
  "anomaly_zscore_gt",                     // Anomaly detection (z-score)
  "inactivity_days_gt",                    // Lifecycle triggers
  "changed_to", "changed_from"             // State transitions
] as const;

// Rule version status
export const ruleVersionStatusEnum = ["draft", "published", "deprecated"] as const;

// WORKFLOW RULES (Rule definitions with tenant isolation)
export const workflowRules = pgTable("workflow_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // threshold, anomaly, lifecycle, integration, custom
  enabled: boolean("enabled").notNull().default(true),
  defaultVersionId: uuid("default_version_id"), // Reference to active version (set after version created)
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("workflow_rules_agency_id_idx").on(table.agencyId),
  categoryIdx: index("workflow_rules_category_idx").on(table.category),
  enabledIdx: index("workflow_rules_enabled_idx").on(table.enabled),
}));

// WORKFLOW RULE VERSIONS (Versioned rule configurations for auditability)
export const workflowRuleVersions = pgTable("workflow_rule_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: uuid("rule_id").notNull().references(() => workflowRules.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"), // draft, published, deprecated
  conditionLogic: text("condition_logic").notNull().default("all"), // all (AND), any (OR)
  thresholdConfig: jsonb("threshold_config"), // { windowDays: number, baselineType: 'average' | 'previous' }
  lifecycleConfig: jsonb("lifecycle_config"), // { inactivityField: string, triggerDays: number }
  anomalyConfig: jsonb("anomaly_config"), // { zScoreThreshold: number, windowDays: number }
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
}, (table) => ({
  ruleIdIdx: index("workflow_rule_versions_rule_id_idx").on(table.ruleId),
  statusIdx: index("workflow_rule_versions_status_idx").on(table.status),
  versionIdx: uniqueIndex("workflow_rule_versions_unique_idx").on(table.ruleId, table.version),
}));

// WORKFLOW RULE CONDITIONS (Individual conditions within a rule version)
export const workflowRuleConditions = pgTable("workflow_rule_conditions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleVersionId: uuid("rule_version_id").notNull().references(() => workflowRuleVersions.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0), // Evaluation order
  fieldPath: text("field_path").notNull(), // JSONPath or dot notation (e.g., "metrics.sessions", "lead.status")
  operator: text("operator").notNull(), // gt, gte, lt, lte, eq, neq, contains, matches, in, percent_change_gt, anomaly_zscore_gt, etc.
  comparisonValue: jsonb("comparison_value").notNull(), // The value to compare against (can be number, string, array)
  windowConfig: jsonb("window_config"), // { days: number, aggregation: 'sum' | 'avg' | 'min' | 'max' }
  scope: text("scope").default("signal"), // signal, context, client, project
}, (table) => ({
  ruleVersionIdIdx: index("workflow_rule_conditions_rule_version_id_idx").on(table.ruleVersionId),
  orderIdx: index("workflow_rule_conditions_order_idx").on(table.order),
}));

// WORKFLOW RULE ACTIONS (Actions to take when rule matches)
export const workflowRuleActions = pgTable("workflow_rule_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleVersionId: uuid("rule_version_id").notNull().references(() => workflowRuleVersions.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0), // Execution order
  actionType: text("action_type").notNull(), // Same as workflow action types
  actionConfig: jsonb("action_config").notNull(), // Configuration for the action
}, (table) => ({
  ruleVersionIdIdx: index("workflow_rule_actions_rule_version_id_idx").on(table.ruleVersionId),
  orderIdx: index("workflow_rule_actions_order_idx").on(table.order),
}));

// WORKFLOW RULE AUDITS (Change history for compliance)
export const workflowRuleAudits = pgTable("workflow_rule_audits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: uuid("rule_id").notNull().references(() => workflowRules.id, { onDelete: "cascade" }),
  ruleVersionId: uuid("rule_version_id").references(() => workflowRuleVersions.id, { onDelete: "set null" }),
  actorId: uuid("actor_id").references(() => profiles.id),
  changeType: text("change_type").notNull(), // created, updated, published, deprecated, deleted
  changeSummary: text("change_summary"),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ruleIdIdx: index("workflow_rule_audits_rule_id_idx").on(table.ruleId),
  actorIdIdx: index("workflow_rule_audits_actor_id_idx").on(table.actorId),
  createdAtIdx: index("workflow_rule_audits_created_at_idx").on(table.createdAt),
}));

// Signal enums
export const signalStatusEnum = ["pending", "processing", "completed", "failed", "duplicate"] as const;
export const signalSourceEnum = ["ga4", "gsc", "hubspot", "linkedin", "internal", "webhook"] as const;
export const signalUrgencyEnum = ["low", "normal", "high", "critical"] as const;

// WORKFLOW SIGNALS (Persisted signals for rule evaluation and audit trail)
export const workflowSignals = pgTable("workflow_signals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // ga4, gsc, hubspot, linkedin, internal, webhook
  type: text("type").notNull(), // metrics, lead_update, ranking_change, engagement, etc.
  payload: jsonb("payload").notNull(), // The full signal data
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  urgency: text("urgency").default("normal"), // low, normal, high, critical
  dedupHash: text("dedup_hash"), // SHA256 hash for deduplication
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, duplicate
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  lastError: text("last_error"), // Error message if processing failed
  retryCount: integer("retry_count").notNull().default(0),
  executionId: uuid("execution_id").references(() => workflowExecutions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("workflow_signals_agency_id_idx").on(table.agencyId),
  sourceIdx: index("workflow_signals_source_idx").on(table.source),
  typeIdx: index("workflow_signals_type_idx").on(table.type),
  statusIdx: index("workflow_signals_status_idx").on(table.status),
  processedIdx: index("workflow_signals_processed_idx").on(table.processed),
  createdAtIdx: index("workflow_signals_created_at_idx").on(table.createdAt),
  dedupHashIdx: index("workflow_signals_dedup_hash_idx").on(table.agencyId, table.dedupHash),
}));

// SIGNAL ROUTES - Maps signal types/sources to workflows
export const workflowSignalRoutes = pgTable("workflow_signal_routes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source"), // null = match all sources
  type: text("type"), // null = match all types
  urgencyFilter: text("urgency_filter").array(), // optional: only route specific urgencies
  payloadFilter: jsonb("payload_filter"), // optional: JSON path conditions
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0), // higher = evaluated first
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("workflow_signal_routes_agency_id_idx").on(table.agencyId),
  workflowIdIdx: index("workflow_signal_routes_workflow_id_idx").on(table.workflowId),
  sourceTypeIdx: index("workflow_signal_routes_source_type_idx").on(table.source, table.type),
  enabledIdx: index("workflow_signal_routes_enabled_idx").on(table.enabled),
}));

// WORKFLOW RULE EVALUATIONS (Log of rule evaluations for debugging and audit)
export const workflowRuleEvaluations = pgTable("workflow_rule_evaluations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: uuid("rule_id").notNull().references(() => workflowRules.id, { onDelete: "cascade" }),
  ruleVersionId: uuid("rule_version_id").notNull().references(() => workflowRuleVersions.id, { onDelete: "cascade" }),
  signalId: uuid("signal_id").references(() => workflowSignals.id, { onDelete: "set null" }),
  executionId: uuid("execution_id").references(() => workflowExecutions.id, { onDelete: "set null" }),
  matched: boolean("matched").notNull(),
  conditionResults: jsonb("condition_results").notNull(), // Array of { conditionId, passed, actualValue, expectedValue }
  evaluationContext: jsonb("evaluation_context"), // Context data used in evaluation
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ruleIdIdx: index("workflow_rule_evaluations_rule_id_idx").on(table.ruleId),
  signalIdIdx: index("workflow_rule_evaluations_signal_id_idx").on(table.signalId),
  executionIdIdx: index("workflow_rule_evaluations_execution_id_idx").on(table.executionId),
  matchedIdx: index("workflow_rule_evaluations_matched_idx").on(table.matched),
  createdAtIdx: index("workflow_rule_evaluations_created_at_idx").on(table.createdAt),
}));

// AI EXECUTION LOGGING (Track AI calls with lineage, caching, and validation)
export const aiExecutions = pgTable("ai_executions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  workflowExecutionId: uuid("workflow_execution_id").references(() => workflowExecutions.id, { onDelete: "set null" }),
  stepId: text("step_id"), // Workflow step that triggered the AI call
  provider: text("provider").notNull(), // 'gemini', 'openai', etc.
  model: text("model").notNull(), // 'gemini-1.5-flash', 'gpt-4', etc.
  operation: text("operation").notNull(), // 'generateText', 'analyzeMetrics', etc.
  requestType: text("request_type").notNull().default("text"), // 'text' | 'embedding'
  inputHash: text("input_hash").notNull(), // SHA-256 of normalized input for caching
  outputHash: text("output_hash"), // SHA-256 of output for verification
  prompt: text("prompt").notNull(),
  input: jsonb("input"), // Full input payload
  output: jsonb("output"), // Full output payload
  outputValidated: boolean("output_validated").default(false), // Did output pass schema validation?
  validationErrors: jsonb("validation_errors"), // Schema validation errors if any
  cached: boolean("cached").default(false), // Was result served from cache?
  cacheKey: text("cache_key"), // Cache key used
  status: text("status").notNull().default("pending"), // pending, success, failed, cached
  error: text("error"), // Error message if failed
  promptTokens: integer("prompt_tokens"), // Input tokens used
  completionTokens: integer("completion_tokens"), // Output tokens used
  totalTokens: integer("total_tokens"), // Total tokens used
  durationMs: integer("duration_ms"), // Execution time in milliseconds
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  agencyIdIdx: index("ai_executions_agency_id_idx").on(table.agencyId),
  workflowExecutionIdIdx: index("ai_executions_workflow_execution_id_idx").on(table.workflowExecutionId),
  inputHashIdx: index("ai_executions_input_hash_idx").on(table.inputHash),
  statusIdx: index("ai_executions_status_idx").on(table.status),
  createdAtIdx: index("ai_executions_created_at_idx").on(table.createdAt),
  providerIdx: index("ai_executions_provider_idx").on(table.provider),
}));

// AI USAGE TRACKING (Aggregate token usage per agency for billing/quotas)
export const aiUsageTracking = pgTable("ai_usage_tracking", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(), // Start of tracking period (daily/monthly)
  periodEnd: timestamp("period_end").notNull(), // End of tracking period
  provider: text("provider").notNull(), // 'gemini', 'openai', etc.
  model: text("model"), // Optional: track per model
  requestType: text("request_type").notNull().default("text"), // 'text' | 'embedding'
  totalRequests: integer("total_requests").notNull().default(0),
  successfulRequests: integer("successful_requests").notNull().default(0),
  failedRequests: integer("failed_requests").notNull().default(0),
  cachedRequests: integer("cached_requests").notNull().default(0),
  totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
  totalCompletionTokens: integer("total_completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostUsd: text("estimated_cost_usd"), // String to avoid floating point issues
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyPeriodIdx: index("ai_usage_tracking_agency_period_idx").on(table.agencyId, table.periodStart),
  providerIdx: index("ai_usage_tracking_provider_idx").on(table.provider),
  periodStartIdx: index("ai_usage_tracking_period_start_idx").on(table.periodStart),
  uniqueAgencyPeriodProvider: index("ai_usage_tracking_unique_idx").on(table.agencyId, table.periodStart, table.provider, table.model, table.requestType),
}));

// AI execution types
export type AIExecution = typeof aiExecutions.$inferSelect;
export type InsertAIExecution = typeof aiExecutions.$inferInsert;
export type AIUsageTracking = typeof aiUsageTracking.$inferSelect;
export type InsertAIUsageTracking = typeof aiUsageTracking.$inferInsert;

// ==================== SUPERADMIN GOVERNANCE (Priority 14) ====================

// AGENCY QUOTAS (Per-agency resource limits and usage tracking)
export const agencyQuotas = pgTable("agency_quotas", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }).unique(),
  aiTokenLimit: integer("ai_token_limit").notNull().default(1000000),
  aiTokenUsed: integer("ai_token_used").notNull().default(0),
  aiRequestLimit: integer("ai_request_limit").notNull().default(10000),
  aiRequestUsed: integer("ai_request_used").notNull().default(0),
  embeddingTokenLimit: integer("embedding_token_limit").notNull().default(2000000),
  embeddingTokenUsed: integer("embedding_token_used").notNull().default(0),
  embeddingRequestLimit: integer("embedding_request_limit").notNull().default(50000),
  embeddingRequestUsed: integer("embedding_request_used").notNull().default(0),
  storageLimit: integer("storage_limit").notNull().default(5368709120),
  storageUsed: integer("storage_used").notNull().default(0),
  seatLimit: integer("seat_limit").notNull().default(10),
  seatsUsed: integer("seats_used").notNull().default(0),
  clientLimit: integer("client_limit").notNull().default(50),
  clientsUsed: integer("clients_used").notNull().default(0),
  projectLimit: integer("project_limit").notNull().default(200),
  projectsUsed: integer("projects_used").notNull().default(0),
  billingPlan: text("billing_plan").notNull().default("starter"),
  monthlyPriceUsd: text("monthly_price_usd").default("0"),
  resetDay: integer("reset_day").notNull().default(1),
  lastResetAt: timestamp("last_reset_at"),
  quotaExceededAt: timestamp("quota_exceeded_at"),
  quotaWarningAt: timestamp("quota_warning_at"),
  warningThreshold: integer("warning_threshold").notNull().default(80),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("agency_quotas_agency_id_idx").on(table.agencyId),
  billingPlanIdx: index("agency_quotas_billing_plan_idx").on(table.billingPlan),
}));

export type AgencyQuota = typeof agencyQuotas.$inferSelect;
export type InsertAgencyQuota = typeof agencyQuotas.$inferInsert;

export const insertAgencyQuotaSchema = createInsertSchema(agencyQuotas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastResetAt: true,
  quotaExceededAt: true,
  quotaWarningAt: true,
});

export const updateAgencyQuotaSchema = createInsertSchema(agencyQuotas).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// INTEGRATION HEALTH (Monitor integration status and token expiry)
export const integrationHealthStatusEnum = ["healthy", "degraded", "failed", "unknown"] as const;

export const integrationHealth = pgTable("integration_health", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  integration: text("integration").notNull(),
  status: text("status").notNull().default("unknown"),
  lastCheckAt: timestamp("last_check_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  errorCount: integer("error_count").notNull().default(0),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  tokenExpiresAt: timestamp("token_expires_at"),
  tokenRefreshedAt: timestamp("token_refreshed_at"),
  responseTimeMs: integer("response_time_ms"),
  healthScore: integer("health_score").notNull().default(100),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("integration_health_agency_id_idx").on(table.agencyId),
  integrationIdx: index("integration_health_integration_idx").on(table.integration),
  statusIdx: index("integration_health_status_idx").on(table.status),
  uniqueAgencyIntegration: uniqueIndex("integration_health_unique_idx").on(table.agencyId, table.integration),
}));

export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type InsertIntegrationHealth = typeof integrationHealth.$inferInsert;

export const insertIntegrationHealthSchema = createInsertSchema(integrationHealth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCheckAt: true,
  lastSuccessAt: true,
  lastErrorAt: true,
  errorCount: true,
  consecutiveFailures: true,
});

// GOVERNANCE AUDIT LOG (SuperAdmin actions audit trail)
export const governanceAuditLogs = pgTable("governance_audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: uuid("admin_id").notNull().references(() => profiles.id),
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index("governance_audit_logs_admin_id_idx").on(table.adminId),
  agencyIdIdx: index("governance_audit_logs_agency_id_idx").on(table.agencyId),
  actionIdx: index("governance_audit_logs_action_idx").on(table.action),
  createdAtIdx: index("governance_audit_logs_created_at_idx").on(table.createdAt),
}));

export type GovernanceAuditLog = typeof governanceAuditLogs.$inferSelect;
export type InsertGovernanceAuditLog = typeof governanceAuditLogs.$inferInsert;

// RATE LIMIT CONFIG (Per-agency rate limit settings)
export const rateLimitConfigs = pgTable("rate_limit_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  maxRequests: integer("max_requests").notNull().default(100),
  windowSeconds: integer("window_seconds").notNull().default(60),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("rate_limit_configs_agency_id_idx").on(table.agencyId),
  uniqueAgencyEndpoint: uniqueIndex("rate_limit_configs_unique_idx").on(table.agencyId, table.endpoint),
}));

export type RateLimitConfig = typeof rateLimitConfigs.$inferSelect;
export type InsertRateLimitConfig = typeof rateLimitConfigs.$inferInsert;

// WORKFLOW RETENTION POLICIES (Configure data retention per agency)
export const workflowRetentionPolicies = pgTable("workflow_retention_policies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // 'workflow_executions', 'workflow_events', 'signals', 'ai_executions', 'rule_evaluations'
  retentionDays: integer("retention_days").notNull().default(90), // Days to retain data
  archiveBeforeDelete: boolean("archive_before_delete").default(false), // Archive to cold storage before deleting
  enabled: boolean("enabled").notNull().default(true),
  lastCleanupAt: timestamp("last_cleanup_at"), // When cleanup last ran
  recordsDeleted: integer("records_deleted").default(0), // Total records deleted by this policy
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("workflow_retention_policies_agency_id_idx").on(table.agencyId),
  resourceTypeIdx: index("workflow_retention_policies_resource_type_idx").on(table.resourceType),
  uniqueAgencyResource: uniqueIndex("workflow_retention_policies_unique_idx").on(table.agencyId, table.resourceType),
}));

export type WorkflowRetentionPolicy = typeof workflowRetentionPolicies.$inferSelect;
export type InsertWorkflowRetentionPolicy = typeof workflowRetentionPolicies.$inferInsert;

export const insertWorkflowRetentionPolicySchema = createInsertSchema(workflowRetentionPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCleanupAt: true,
  recordsDeleted: true,
});

export const updateWorkflowRetentionPolicySchema = createInsertSchema(workflowRetentionPolicies).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
  lastCleanupAt: true,
  recordsDeleted: true,
}).partial();

// ==================== VECTOR STORAGE (Priority 6) ====================

// Document type enum
export const documentTypeEnum = ["sop", "brand_asset", "analytics", "knowledge_base", "template", "report"] as const;
export const documentStatusEnum = ["pending", "processing", "indexed", "failed", "archived"] as const;
export const embeddingProviderEnum = ["openai", "gemini"] as const;

// KNOWLEDGE BASE DOCUMENTS (Source documents for embeddings)
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }), // Optional client-specific doc
  title: text("title").notNull(),
  description: text("description"),
  documentType: text("document_type").notNull(), // 'sop', 'brand_asset', 'analytics', 'knowledge_base', 'template', 'report'
  sourceUrl: text("source_url"), // Original URL if applicable
  filePath: text("file_path"), // Storage path for uploaded files
  mimeType: text("mime_type"), // e.g., 'application/pdf', 'text/markdown'
  fileSize: integer("file_size"), // File size in bytes
  content: text("content"), // Extracted text content
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Additional metadata (author, tags, etc.)
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'indexed', 'failed', 'archived'
  errorMessage: text("error_message"), // Error details if processing failed
  chunkCount: integer("chunk_count").default(0), // Number of chunks created
  lastIndexedAt: timestamp("last_indexed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
}, (table) => ({
  agencyIdIdx: index("knowledge_documents_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("knowledge_documents_client_id_idx").on(table.clientId),
  statusIdx: index("knowledge_documents_status_idx").on(table.status),
  documentTypeIdx: index("knowledge_documents_type_idx").on(table.documentType),
}));

// DOCUMENT EMBEDDINGS (Vector chunks for semantic search)
export const documentEmbeddings = pgTable("document_embeddings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Position of chunk in document
  content: text("content").notNull(), // Text content of this chunk
  embedding: jsonb("embedding").$type<number[]>().notNull(), // Vector stored as JSON array (e.g., 1536 dimensions for OpenAI)
  embeddingModel: text("embedding_model").notNull(), // e.g., 'text-embedding-3-small', 'text-embedding-004'
  embeddingProvider: text("embedding_provider").notNull(), // 'openai' or 'gemini'
  tokenCount: integer("token_count"), // Tokens in this chunk
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Chunk-level metadata (headers, page number, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("document_embeddings_agency_id_idx").on(table.agencyId),
  documentIdIdx: index("document_embeddings_document_id_idx").on(table.documentId),
  chunkIdx: index("document_embeddings_chunk_idx").on(table.documentId, table.chunkIndex),
}));

// EMBEDDING INDEX STATS (Track index health and performance)
export const embeddingIndexStats = pgTable("embedding_index_stats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }).unique(),
  totalDocuments: integer("total_documents").default(0),
  totalChunks: integer("total_chunks").default(0),
  totalTokens: integer("total_tokens").default(0),
  lastRebuildAt: timestamp("last_rebuild_at"),
  lastPruneAt: timestamp("last_prune_at"),
  averageQueryTimeMs: numeric("average_query_time_ms"),
  queryCount: integer("query_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SEMANTIC SEARCH LOGS (Track search queries and results)
export const semanticSearchLogs = pgTable("semantic_search_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => profiles.id),
  query: text("query").notNull(),
  queryEmbedding: jsonb("query_embedding").$type<number[]>(), // Store query vector for analysis
  resultCount: integer("result_count").notNull(),
  topResultIds: text("top_result_ids").array(), // IDs of top returned chunks
  topScores: jsonb("top_scores").$type<number[]>(), // Similarity scores
  durationMs: integer("duration_ms"),
  filters: jsonb("filters").$type<Record<string, unknown>>(), // Applied filters (documentType, clientId, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("semantic_search_logs_agency_id_idx").on(table.agencyId),
  createdAtIdx: index("semantic_search_logs_created_at_idx").on(table.createdAt),
}));

// Vector storage types
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;

export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type InsertDocumentEmbedding = typeof documentEmbeddings.$inferInsert;

export type EmbeddingIndexStats = typeof embeddingIndexStats.$inferSelect;
export type SemanticSearchLog = typeof semanticSearchLogs.$inferSelect;

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  chunkCount: true,
  lastIndexedAt: true,
  errorMessage: true,
});

export const updateKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).partial();

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddings).omit({
  id: true,
  createdAt: true,
});

// ==================== SLA & ESCALATION ENGINE (Priority 7) ====================

// SLA breach action types
export const slaBreachActionTypeEnum = ["notify", "reassign", "escalate", "pause_billing", "create_task"] as const;
export const slaPriorityEnum = ["low", "medium", "high", "critical"] as const;
export const slaStatusEnum = ["active", "paused", "archived"] as const;
export const breachStatusEnum = ["detected", "acknowledged", "escalated", "resolved", "auto_resolved"] as const;

// SLA DEFINITIONS (Service Level Agreements per client/project)
export const slaDefinitions = pgTable("sla_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }), // Optional: client-specific SLA
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }), // Optional: project-specific SLA
  name: text("name").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  status: text("status").notNull().default("active"), // 'active', 'paused', 'archived'
  responseTimeHours: numeric("response_time_hours").notNull(), // Time to first response
  resolutionTimeHours: numeric("resolution_time_hours").notNull(), // Time to resolution
  businessHoursOnly: boolean("business_hours_only").default(true), // Only count business hours
  businessHoursStart: integer("business_hours_start").default(9), // Start hour (0-23)
  businessHoursEnd: integer("business_hours_end").default(17), // End hour (0-23)
  businessDays: text("business_days").array().default(["Mon", "Tue", "Wed", "Thu", "Fri"]), // Working days
  timezone: text("timezone").default("UTC"),
  appliesTo: text("applies_to").array().default(["task"]), // 'task', 'message', 'project', 'initiative'
  taskPriorities: text("task_priorities").array(), // Apply only to specific task priorities
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("sla_definitions_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("sla_definitions_client_id_idx").on(table.clientId),
  projectIdIdx: index("sla_definitions_project_id_idx").on(table.projectId),
  statusIdx: index("sla_definitions_status_idx").on(table.status),
}));

// ESCALATION CHAINS (Ordered list of escalation recipients)
export const escalationChains = pgTable("escalation_chains", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  slaId: uuid("sla_id").notNull().references(() => slaDefinitions.id, { onDelete: "cascade" }),
  level: integer("level").notNull(), // Escalation level (1 = first, 2 = second, etc.)
  escalateAfterMinutes: integer("escalate_after_minutes").notNull(), // Minutes after breach before escalating to this level
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }), // Who to escalate to
  notifyEmail: text("notify_email"), // Alternative email if no profile
  notifyInApp: boolean("notify_in_app").default(true),
  notifyEmail2: boolean("notify_email_flag").default(true), // Send email notification
  reassignTask: boolean("reassign_task").default(false), // Reassign the task to this person
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("escalation_chains_agency_id_idx").on(table.agencyId),
  slaIdIdx: index("escalation_chains_sla_id_idx").on(table.slaId),
  levelIdx: index("escalation_chains_level_idx").on(table.slaId, table.level),
}));

// SLA BREACH ACTIONS (Configurable actions when SLA is breached)
export const slaBreachActions = pgTable("sla_breach_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slaId: uuid("sla_id").notNull().references(() => slaDefinitions.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // 'notify', 'reassign', 'escalate', 'pause_billing', 'create_task'
  triggerAt: text("trigger_at").notNull().default("breach"), // 'warning' (50%), 'breach', 'escalation_1', 'escalation_2', etc.
  config: jsonb("config").$type<Record<string, unknown>>(), // Action-specific configuration
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slaIdIdx: index("sla_breach_actions_sla_id_idx").on(table.slaId),
}));

// SLA BREACHES (Track actual breaches)
export const slaBreaches = pgTable("sla_breaches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  slaId: uuid("sla_id").notNull().references(() => slaDefinitions.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // 'task', 'message', 'project', 'initiative'
  resourceId: uuid("resource_id").notNull(), // ID of the breached resource
  breachType: text("breach_type").notNull(), // 'response_time', 'resolution_time'
  status: text("status").notNull().default("detected"), // 'detected', 'acknowledged', 'escalated', 'resolved', 'auto_resolved'
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: uuid("acknowledged_by").references(() => profiles.id),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: uuid("resolved_by").references(() => profiles.id),
  deadlineAt: timestamp("deadline_at").notNull(), // When the SLA was supposed to be met
  actualResponseAt: timestamp("actual_response_at"), // When first response happened
  actualResolutionAt: timestamp("actual_resolution_at"), // When resolved
  breachDurationMinutes: integer("breach_duration_minutes"), // How long past deadline
  currentEscalationLevel: integer("current_escalation_level").default(0),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
}, (table) => ({
  agencyIdIdx: index("sla_breaches_agency_id_idx").on(table.agencyId),
  slaIdIdx: index("sla_breaches_sla_id_idx").on(table.slaId),
  resourceIdx: index("sla_breaches_resource_idx").on(table.resourceType, table.resourceId),
  statusIdx: index("sla_breaches_status_idx").on(table.status),
  detectedAtIdx: index("sla_breaches_detected_at_idx").on(table.detectedAt),
}));

// SLA BREACH EVENTS (Audit trail for breach lifecycle)
export const slaBreachEvents = pgTable("sla_breach_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  breachId: uuid("breach_id").notNull().references(() => slaBreaches.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'detected', 'warning_sent', 'escalated', 'acknowledged', 'resolved', 'notification_sent', 'task_reassigned'
  eventData: jsonb("event_data").$type<Record<string, unknown>>(),
  triggeredBy: text("triggered_by").notNull().default("system"), // 'system', 'user', 'automation'
  userId: uuid("user_id").references(() => profiles.id), // If triggered by user
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  breachIdIdx: index("sla_breach_events_breach_id_idx").on(table.breachId),
  eventTypeIdx: index("sla_breach_events_event_type_idx").on(table.eventType),
  createdAtIdx: index("sla_breach_events_created_at_idx").on(table.createdAt),
}));

// SLA METRICS (Aggregated metrics for reporting)
export const slaMetrics = pgTable("sla_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  slaId: uuid("sla_id").references(() => slaDefinitions.id, { onDelete: "cascade" }), // Optional: per-SLA metrics
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }), // Optional: per-client metrics
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: text("period_type").notNull(), // 'daily', 'weekly', 'monthly'
  totalItems: integer("total_items").default(0), // Total items tracked
  itemsWithinSla: integer("items_within_sla").default(0),
  itemsBreached: integer("items_breached").default(0),
  slaComplianceRate: numeric("sla_compliance_rate"), // Percentage (0-100)
  averageResponseTimeMinutes: numeric("average_response_time_minutes"),
  averageResolutionTimeMinutes: numeric("average_resolution_time_minutes"),
  breachesByPriority: jsonb("breaches_by_priority").$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("sla_metrics_agency_id_idx").on(table.agencyId),
  slaIdIdx: index("sla_metrics_sla_id_idx").on(table.slaId),
  clientIdIdx: index("sla_metrics_client_id_idx").on(table.clientId),
  periodIdx: index("sla_metrics_period_idx").on(table.periodStart, table.periodEnd),
  periodTypeIdx: index("sla_metrics_period_type_idx").on(table.periodType),
}));

// SLA Types
export type SlaDefinition = typeof slaDefinitions.$inferSelect;
export type InsertSlaDefinition = typeof slaDefinitions.$inferInsert;

export type EscalationChain = typeof escalationChains.$inferSelect;
export type InsertEscalationChain = typeof escalationChains.$inferInsert;

export type SlaBreachAction = typeof slaBreachActions.$inferSelect;
export type InsertSlaBreachAction = typeof slaBreachActions.$inferInsert;

export type SlaBreach = typeof slaBreaches.$inferSelect;
export type InsertSlaBreach = typeof slaBreaches.$inferInsert;

export type SlaBreachEvent = typeof slaBreachEvents.$inferSelect;
export type InsertSlaBreachEvent = typeof slaBreachEvents.$inferInsert;

export type SlaMetrics = typeof slaMetrics.$inferSelect;
export type InsertSlaMetrics = typeof slaMetrics.$inferInsert;

// ============================================
// MULTI-AGENT ARCHITECTURE (Priority 8)
// ============================================

// Agent domain types
export const agentDomainEnum = ["seo", "ppc", "crm", "reporting", "general"] as const;
export const agentStatusEnum = ["active", "inactive", "deprecated"] as const;
export const agentExecutionStatusEnum = ["pending", "running", "completed", "failed"] as const;

// AGENTS (Specialized AI agents per domain)
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  domain: text("domain").notNull(), // 'seo', 'ppc', 'crm', 'reporting', 'general'
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'deprecated'
  aiProvider: text("ai_provider").notNull().default("gemini"), // 'gemini', 'openai'
  aiModel: text("ai_model"), // Specific model override
  systemPrompt: text("system_prompt"), // Custom system prompt for the agent
  temperature: numeric("temperature").default("0.7"),
  maxTokens: integer("max_tokens").default(4096),
  capabilities: text("capabilities").array().notNull().default(sql`ARRAY[]::text[]`),
  config: jsonb("config").$type<Record<string, unknown>>(), // Domain-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
}, (table) => ({
  agencyIdIdx: index("agents_agency_id_idx").on(table.agencyId),
  domainIdx: index("agents_domain_idx").on(table.domain),
  statusIdx: index("agents_status_idx").on(table.status),
}));

// AGENT CAPABILITIES (Fine-grained capability definitions)
export const agentCapabilities = pgTable("agent_capabilities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., 'analyze_rankings', 'generate_content', 'score_leads'
  description: text("description"),
  inputSchema: jsonb("input_schema").$type<Record<string, unknown>>(), // Expected input format
  outputSchema: jsonb("output_schema").$type<Record<string, unknown>>(), // Expected output format
  promptTemplate: text("prompt_template"), // Template for this capability
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agentIdIdx: index("agent_capabilities_agent_id_idx").on(table.agentId),
  nameIdx: index("agent_capabilities_name_idx").on(table.name),
}));

// AGENT EXECUTIONS (Track every agent invocation)
export const agentExecutions = pgTable("agent_executions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  capabilityId: uuid("capability_id").references(() => agentCapabilities.id),
  workflowExecutionId: uuid("workflow_execution_id").references(() => workflowExecutions.id),
  signalId: uuid("signal_id").references(() => workflowSignals.id),
  operation: text("operation").notNull(), // 'analyze', 'recommend', 'execute'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  input: jsonb("input").$type<Record<string, unknown>>(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  inputHash: text("input_hash"), // For idempotency
  outputHash: text("output_hash"), // For reproducibility verification
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("agent_executions_agency_id_idx").on(table.agencyId),
  agentIdIdx: index("agent_executions_agent_id_idx").on(table.agentId),
  statusIdx: index("agent_executions_status_idx").on(table.status),
  workflowExecutionIdIdx: index("agent_executions_workflow_execution_id_idx").on(table.workflowExecutionId),
  inputHashIdx: index("agent_executions_input_hash_idx").on(table.inputHash),
  createdAtIdx: index("agent_executions_created_at_idx").on(table.createdAt),
}));

// AGENT ROUTING RULES (Route signals to appropriate agents)
export const agentRoutingRules = pgTable("agent_routing_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priority: integer("priority").default(100), // Lower = higher priority
  signalSource: text("signal_source"), // Filter by source (null = any)
  signalType: text("signal_type"), // Filter by type (null = any)
  payloadFilter: jsonb("payload_filter").$type<Record<string, unknown>>(), // JSONPath-style filters
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("agent_routing_rules_agency_id_idx").on(table.agencyId),
  agentIdIdx: index("agent_routing_rules_agent_id_idx").on(table.agentId),
  priorityIdx: index("agent_routing_rules_priority_idx").on(table.priority),
  signalSourceIdx: index("agent_routing_rules_signal_source_idx").on(table.signalSource),
  signalTypeIdx: index("agent_routing_rules_signal_type_idx").on(table.signalType),
}));

// Agent Types
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

export type AgentCapability = typeof agentCapabilities.$inferSelect;
export type InsertAgentCapability = typeof agentCapabilities.$inferInsert;

export type AgentExecution = typeof agentExecutions.$inferSelect;
export type InsertAgentExecution = typeof agentExecutions.$inferInsert;

export type AgentRoutingRule = typeof agentRoutingRules.$inferSelect;
export type InsertAgentRoutingRule = typeof agentRoutingRules.$inferInsert;

export type AgentDomain = typeof agentDomainEnum[number];
export type AgentStatus = typeof agentStatusEnum[number];
export type AgentExecutionStatus = typeof agentExecutionStatusEnum[number];

// SLA Insert Schemas
export const insertSlaDefinitionSchema = createInsertSchema(slaDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSlaDefinitionSchema = createInsertSchema(slaDefinitions).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).partial();

export const insertEscalationChainSchema = createInsertSchema(escalationChains).omit({
  id: true,
  createdAt: true,
});

export const insertSlaBreachActionSchema = createInsertSchema(slaBreachActions).omit({
  id: true,
  createdAt: true,
});

export const insertSlaBreachSchema = createInsertSchema(slaBreaches).omit({
  id: true,
  detectedAt: true,
});

export const insertSlaBreachEventSchema = createInsertSchema(slaBreachEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSlaMetricsSchema = createInsertSchema(slaMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Workflow schemas
export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});

export const updateWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  createdBy: true,
}).partial();

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowEventSchema = createInsertSchema(workflowEvents).omit({
  id: true,
  timestamp: true,
});

// Rule engine schemas
export const insertWorkflowRuleSchema = createInsertSchema(workflowRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  defaultVersionId: true,
});

export const updateWorkflowRuleSchema = createInsertSchema(workflowRules).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  createdBy: true,
}).partial();

export const insertWorkflowRuleVersionSchema = createInsertSchema(workflowRuleVersions).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export const insertWorkflowRuleConditionSchema = createInsertSchema(workflowRuleConditions).omit({
  id: true,
});

export const insertWorkflowRuleActionSchema = createInsertSchema(workflowRuleActions).omit({
  id: true,
});

export const insertWorkflowRuleAuditSchema = createInsertSchema(workflowRuleAudits).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowSignalSchema = createInsertSchema(workflowSignals).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  executionId: true,
});

export const insertWorkflowSignalRouteSchema = createInsertSchema(workflowSignalRoutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWorkflowSignalRouteSchema = createInsertSchema(workflowSignalRoutes).omit({
  id: true,
  agencyId: true,
  createdAt: true,
}).partial();

export const insertWorkflowRuleEvaluationSchema = createInsertSchema(workflowRuleEvaluations).omit({
  id: true,
  createdAt: true,
});

// AI execution schemas
export const insertAIExecutionSchema = createInsertSchema(aiExecutions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertAIUsageTrackingSchema = createInsertSchema(aiUsageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Agent schemas
export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAgentSchema = createInsertSchema(agents).omit({
  id: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).partial();

export const insertAgentCapabilitySchema = createInsertSchema(agentCapabilities).omit({
  id: true,
  createdAt: true,
});

export const insertAgentExecutionSchema = createInsertSchema(agentExecutions).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertAgentRoutingRuleSchema = createInsertSchema(agentRoutingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAgentRoutingRuleSchema = createInsertSchema(agentRoutingRules).omit({
  id: true,
  agencyId: true,
  createdAt: true,
}).partial();

// Admin user creation schemas
export const createClientUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  companyName: z.string().min(1, "Company name is required"),
  agencyId: z.string().optional(), // Optional for regular Admin, required for SuperAdmin (validated in backend)
});

export const createStaffAdminUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["Staff", "Admin"], {
    errorMap: () => ({ message: "Role must be Staff or Admin" })
  }),
  agencyId: z.string().optional(), // Optional for regular Admin, required for SuperAdmin (validated in backend)
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

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type TaskList = typeof taskLists.$inferSelect;
export type InsertTaskList = z.infer<typeof insertTaskListSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskStatus = typeof taskStatusEnum[number];
export type TaskPriority = typeof taskPriorityEnum[number];

export type StaffAssignment = typeof staffAssignments.$inferSelect;
export type InsertStaffAssignment = z.infer<typeof insertStaffAssignmentSchema>;

export type TaskActivity = typeof taskActivities.$inferSelect;
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type TaskActivityWithUser = TaskActivity & { user: Profile };

export type TaskRelationship = typeof taskRelationships.$inferSelect;
export type InsertTaskRelationship = z.infer<typeof insertTaskRelationshipSchema>;
export type TaskRelationshipWithTask = TaskRelationship & { relatedTask: Task };

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
export type TaskMessage = typeof taskMessages.$inferSelect;
export type InsertTaskMessage = z.infer<typeof insertTaskMessageSchema>;

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

// SuperAdmin credential update schemas
export const updateUserEmailSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
});

export const updateUserPasswordSchema = z.object({
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
    .refine(val => !/\s/.test(val), "Password must not contain whitespace"),
});

export type UpdateUserEmail = z.infer<typeof updateUserEmailSchema>;
export type UpdateUserPassword = z.infer<typeof updateUserPasswordSchema>;

// Extended types for frontend use
export type ProjectWithClient = Project & { client?: Client };
export type ProjectWithLists = Project & { taskLists?: TaskList[] };
export type TaskListWithTasks = TaskList & { tasks?: Task[] };
export type TaskWithProject = Task & { project?: Project };
export type TaskWithList = Task & { taskList?: TaskList };
export type TaskWithSubtasks = Task & { subtasks?: Task[] };
export type TaskWithAssignments = Task & { assignments?: StaffAssignment[] };
export type TaskWithDetails = Task & { 
  taskList?: TaskList; 
  project?: Project; 
  assignments?: StaffAssignment[];
  subtasks?: Task[];
};
export type InvoiceWithClient = Invoice & { client?: Client };
export type InvoiceWithLineItems = Invoice & { lineItems?: InvoiceLineItem[] };
export type InvoiceWithClientAndLineItems = Invoice & { client?: Client; lineItems?: InvoiceLineItem[] };
export type InitiativeWithClient = Initiative & { client?: Client };
export type CompanyWithContacts = Company & { contacts?: Contact[] };
export type DealWithContact = Deal & { contact?: Contact };
export type DealWithCompany = Deal & { company?: Company };
export type ProposalWithSections = Proposal & { sections?: ProposalSection[] };
export type TaskMessageWithSender = TaskMessage & { sender?: Profile };

// Workflow Types
export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>;
export type WorkflowStatus = typeof workflowStatusEnum[number];
export type WorkflowStepType = typeof workflowStepTypeEnum[number];

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecutionStatus = typeof workflowExecutionStatusEnum[number];

export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type InsertWorkflowEvent = z.infer<typeof insertWorkflowEventSchema>;
export type WorkflowEventType = typeof workflowEventTypeEnum[number];

// Rule Engine Types
export type WorkflowRule = typeof workflowRules.$inferSelect;
export type InsertWorkflowRule = z.infer<typeof insertWorkflowRuleSchema>;
export type UpdateWorkflowRule = z.infer<typeof updateWorkflowRuleSchema>;
export type RuleCategory = typeof ruleCategoryEnum[number];

export type WorkflowRuleVersion = typeof workflowRuleVersions.$inferSelect;
export type InsertWorkflowRuleVersion = z.infer<typeof insertWorkflowRuleVersionSchema>;
export type RuleVersionStatus = typeof ruleVersionStatusEnum[number];

export type WorkflowRuleCondition = typeof workflowRuleConditions.$inferSelect;
export type InsertWorkflowRuleCondition = z.infer<typeof insertWorkflowRuleConditionSchema>;
export type RuleOperator = typeof ruleOperatorEnum[number];

export type WorkflowRuleAction = typeof workflowRuleActions.$inferSelect;
export type InsertWorkflowRuleAction = z.infer<typeof insertWorkflowRuleActionSchema>;

export type WorkflowRuleAudit = typeof workflowRuleAudits.$inferSelect;
export type InsertWorkflowRuleAudit = z.infer<typeof insertWorkflowRuleAuditSchema>;

export type WorkflowSignal = typeof workflowSignals.$inferSelect;
export type InsertWorkflowSignal = z.infer<typeof insertWorkflowSignalSchema>;
export type SignalStatus = typeof signalStatusEnum[number];
export type SignalSource = typeof signalSourceEnum[number];
export type SignalUrgency = typeof signalUrgencyEnum[number];

export type WorkflowSignalRoute = typeof workflowSignalRoutes.$inferSelect;
export type InsertWorkflowSignalRoute = z.infer<typeof insertWorkflowSignalRouteSchema>;
export type UpdateWorkflowSignalRoute = z.infer<typeof updateWorkflowSignalRouteSchema>;

export type WorkflowRuleEvaluation = typeof workflowRuleEvaluations.$inferSelect;
export type InsertWorkflowRuleEvaluation = z.infer<typeof insertWorkflowRuleEvaluationSchema>;

// Extended rule types
export type WorkflowRuleWithVersion = WorkflowRule & { activeVersion?: WorkflowRuleVersion };
export type WorkflowRuleVersionWithConditions = WorkflowRuleVersion & { 
  conditions?: WorkflowRuleCondition[];
  actions?: WorkflowRuleAction[];
};

// Workflow step definition types (used in workflow.steps JSON field)
export interface WorkflowStepConfig {
  signal?: { type: string; filter?: Record<string, unknown> };
  rule?: { conditions: RuleCondition[]; logic: 'all' | 'any' };
  ai?: { provider?: string; prompt: string; schema?: Record<string, unknown>; useCache?: boolean };
  action?: { type: string; config: Record<string, unknown> };
  branch?: { conditions: BranchCondition[]; default?: string };
  parallel?: { steps: string[] };
  agent?: {
    domain?: string;
    operation?: 'analyze' | 'recommend' | 'execute';
    agentId?: string;
    capability?: string;
    input?: Record<string, unknown>;
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  config: WorkflowStepConfig;
  next?: string | null;
  onError?: 'fail' | 'skip' | 'retry';
  retryConfig?: { maxRetries: number; backoffMs: number };
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex' | 'exists';
  value: unknown;
}

export interface BranchCondition {
  condition: RuleCondition[];
  logic: 'all' | 'any';
  next: string;
}

export interface WorkflowRetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier?: number;
}

export interface WorkflowTriggerConfig {
  signalType?: string;
  schedule?: string; // cron expression
  webhookPath?: string;
}

// Extended workflow types
export type WorkflowWithExecutions = Workflow & { executions?: WorkflowExecution[] };
export type WorkflowExecutionWithEvents = WorkflowExecution & { events?: WorkflowEvent[] };

// ===========================================
// TEMPLATE SYSTEM TABLES (Priority 12)
// ===========================================

// TEMPLATES - Reusable templates for projects, task lists, workflows, and prompts
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }), // Null for system templates
  type: text("type").notNull(), // 'project' | 'task_list' | 'workflow' | 'prompt'
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(), // System templates available to all agencies
  isPublic: boolean("is_public").default(false).notNull(), // Public templates can be cloned by other agencies
  category: text("category"), // Optional categorization
  tags: text("tags").array(), // Searchable tags
  content: jsonb("content").notNull(), // Template structure
  variables: jsonb("variables").default('[]').notNull(), // TemplateVariable[]
  currentVersionId: uuid("current_version_id"),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("templates_agency_id_idx").on(table.agencyId),
  typeIdx: index("templates_type_idx").on(table.type),
  isSystemIdx: index("templates_is_system_idx").on(table.isSystem),
}));

// TEMPLATE VERSIONS - Version history for templates
export const templateVersions = pgTable("template_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: jsonb("content").notNull(),
  variables: jsonb("variables").default('[]').notNull(),
  changelog: text("changelog"),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  templateIdIdx: index("template_versions_template_id_idx").on(table.templateId),
  versionIdx: index("template_versions_version_idx").on(table.version),
}));

// TEMPLATE INSTANTIATIONS - Track when templates are used
export const templateInstantiations = pgTable("template_instantiations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  templateVersionId: uuid("template_version_id").references(() => templateVersions.id, { onDelete: "set null" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  variableValues: jsonb("variable_values").default('{}').notNull(), // Substituted values
  outputType: text("output_type").notNull(), // What was created: 'project' | 'task_list' | 'workflow'
  outputId: uuid("output_id"), // ID of created entity
  workflowExecutionId: uuid("workflow_execution_id"), // If created via workflow
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  templateIdIdx: index("template_instantiations_template_id_idx").on(table.templateId),
  agencyIdIdx: index("template_instantiations_agency_id_idx").on(table.agencyId),
  outputIdIdx: index("template_instantiations_output_id_idx").on(table.outputId),
}));

// Template types
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type InsertTemplateVersion = typeof templateVersions.$inferInsert;
export type TemplateInstantiation = typeof templateInstantiations.$inferSelect;
export type InsertTemplateInstantiation = typeof templateInstantiations.$inferInsert;

// Template variable interface
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'array';
  required: boolean;
  description?: string;
  default?: unknown;
  options?: string[]; // For select type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

// Template content structures
export interface ProjectTemplateContent {
  name: string; // Can include {{variables}}
  description?: string;
  taskLists: TaskListTemplateContent[];
}

export interface TaskListTemplateContent {
  name: string;
  tasks: TaskTemplateContent[];
}

export interface TaskTemplateContent {
  description: string;
  status?: string;
  priority?: string;
  dueDaysFromStart?: number; // Days offset from project start
  timeEstimate?: string;
  subtasks?: TaskTemplateContent[];
}

export interface WorkflowTemplateContent {
  name: string;
  description?: string;
  triggerConfig?: WorkflowTriggerConfig;
  steps: WorkflowStep[];
}

export interface PromptTemplateContent {
  prompt: string; // Template with {{variables}}
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ===========================================
// CANONICAL INTELLIGENCE LAYER (Priority 16)
// ===========================================

// Enums for intelligence layer
export const intelligenceSignalCategoryEnum = ["anomaly", "threshold", "event"] as const;
export const intelligenceSignalSeverityEnum = ["info", "low", "medium", "high", "critical"] as const;
export const intelligenceInsightStatusEnum = ["open", "prioritised", "actioned", "ignored", "invalid"] as const;
export const intelligencePriorityStatusEnum = ["pending", "in_progress", "done", "dismissed"] as const;
export const intelligenceRankingBucketEnum = ["now", "next", "later", "backlog"] as const;

// INTELLIGENCE SIGNALS - Raw, typed events from analytics, CRM, workflows, humans
export const intelligenceSignals = pgTable("intelligence_signals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(), // 'GA4', 'GSC', 'HUBSPOT', 'CRM', 'WORKFLOW', 'MANUAL'
  signalType: text("signal_type").notNull(), // 'pageview_drop', 'pipeline_spike', 'deal_stage_changed', 'sla_breach'
  category: text("category").notNull(), // 'anomaly', 'threshold', 'event'
  severity: text("severity"), // 'info', 'low', 'medium', 'high', 'critical'
  occurredAt: timestamp("occurred_at").notNull(),
  ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
  
  // Linkage
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  
  // Payload
  payload: jsonb("payload").notNull(), // Raw event data in normalized shape
  metricsSnapshot: jsonb("metrics_snapshot"), // { "sessions": 120, "goal_completions": 5 }
  dimensions: jsonb("dimensions"), // { "channel": "organic", "page_path": "/pricing" }
  
  // Classification & metadata
  detector: text("detector"), // Which job/workflow produced this signal
  version: text("version"), // Version of detector/prompt
  correlationKey: text("correlation_key"), // "client:123|site:main"
  parentSignalId: uuid("parent_signal_id"), // If derived from another signal
  tags: text("tags").array().default(sql`'{}'::text[]`),
  
  // Status flags
  processedToInsight: boolean("processed_to_insight").default(false),
  discarded: boolean("discarded").default(false),
  discardReason: text("discard_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("intelligence_signals_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("intelligence_signals_client_id_idx").on(table.clientId),
  sourceSystemIdx: index("intelligence_signals_source_system_idx").on(table.sourceSystem),
  signalTypeIdx: index("intelligence_signals_signal_type_idx").on(table.signalType),
  categoryIdx: index("intelligence_signals_category_idx").on(table.category),
  occurredAtIdx: index("intelligence_signals_occurred_at_idx").on(table.occurredAt),
  correlationKeyIdx: index("intelligence_signals_correlation_key_idx").on(table.correlationKey),
  processedIdx: index("intelligence_signals_processed_idx").on(table.processedToInsight),
}));

// INTELLIGENCE INSIGHTS - Aggregated, interpreted metrics & findings
export const intelligenceInsights = pgTable("intelligence_insights", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  insightType: text("insight_type").notNull(), // 'traffic_drop', 'conversion_rate_issue', 'pipeline_shortfall'
  title: text("title").notNull(), // Short human-readable title
  description: text("description"), // Explanation (can be AI-generated)
  
  // Scope
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  metricKey: text("metric_key"), // 'sessions', 'mql_to_sql_conversion_rate', 'pipeline_value'
  timeRangeStart: timestamp("time_range_start"),
  timeRangeEnd: timestamp("time_range_end"),
  
  // Values
  currentValue: numeric("current_value"),
  baselineValue: numeric("baseline_value"),
  deltaAbsolute: numeric("delta_absolute"),
  deltaPercent: numeric("delta_percent"),
  
  // Quality & lineage
  confidenceScore: numeric("confidence_score"), // 0–1
  severity: text("severity"), // 'low', 'medium', 'high', 'critical'
  sourceSignalIds: uuid("source_signal_ids").array(), // Array of contributing signals
  sourceSystems: text("source_systems").array(), // ['GA4', 'HUBSPOT']
  
  // Suggested next step (optional, AI-generated)
  suggestedAction: text("suggested_action"),
  suggestedActionType: text("suggested_action_type"), // 'campaign_adjustment', 'new_initiative', 'task_update'
  
  // Lifecycle
  status: text("status").notNull().default("open"), // 'open', 'prioritised', 'actioned', 'ignored', 'invalid'
  createdByAgent: text("created_by_agent"), // 'anomaly_detector_v1', 'insight_aggregator_v2'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("intelligence_insights_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("intelligence_insights_client_id_idx").on(table.clientId),
  insightTypeIdx: index("intelligence_insights_insight_type_idx").on(table.insightType),
  statusIdx: index("intelligence_insights_status_idx").on(table.status),
  severityIdx: index("intelligence_insights_severity_idx").on(table.severity),
  createdAtIdx: index("intelligence_insights_created_at_idx").on(table.createdAt),
}));

// INTELLIGENCE PRIORITY CONFIG - Per-agency weight tuning
export const intelligencePriorityConfig = pgTable("intelligence_priority_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }).unique(),
  wImpact: numeric("w_impact").default("0.4").notNull(), // Weight for commercial impact
  wUrgency: numeric("w_urgency").default("0.3").notNull(), // Weight for urgency
  wConfidence: numeric("w_confidence").default("0.2").notNull(), // Weight for confidence
  wResource: numeric("w_resource").default("0.1").notNull(), // Weight for resource feasibility
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("intelligence_priority_config_agency_id_idx").on(table.agencyId),
}));

// INTELLIGENCE PRIORITIES - Ranked queue of work the system believes should happen
export const intelligencePriorities = pgTable("intelligence_priorities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  insightId: uuid("insight_id").notNull().references(() => intelligenceInsights.id, { onDelete: "cascade" }),
  
  // Scoring dimensions (0–1)
  commercialImpactScore: numeric("commercial_impact_score").notNull(),
  urgencyScore: numeric("urgency_score").notNull(),
  confidenceScore: numeric("confidence_score").notNull(), // Mirrored from insight
  resourceFeasibilityScore: numeric("resource_feasibility_score").notNull(),
  
  // Final outcome
  priorityScore: numeric("priority_score").notNull(), // Weighted composite score
  
  // Derived metadata
  rankingBucket: text("ranking_bucket"), // 'now', 'next', 'later', 'backlog'
  recommendedDueDate: timestamp("recommended_due_date"),
  
  // Resource context snapshot
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  resourceContext: jsonb("resource_context"), // Snapshot of capacity/skills considered
  
  // Workflow linkage
  createdWorkflowRunId: uuid("created_workflow_run_id"),
  status: text("status").default("pending").notNull(), // 'pending', 'in_progress', 'done', 'dismissed'
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("intelligence_priorities_agency_id_idx").on(table.agencyId),
  insightIdIdx: index("intelligence_priorities_insight_id_idx").on(table.insightId),
  priorityScoreIdx: index("intelligence_priorities_priority_score_idx").on(table.priorityScore),
  rankingBucketIdx: index("intelligence_priorities_ranking_bucket_idx").on(table.rankingBucket),
  statusIdx: index("intelligence_priorities_status_idx").on(table.status),
}));

// INTELLIGENCE FEEDBACK - Tracks outcomes and connects back to original signals/insights
export const intelligenceFeedback = pgTable("intelligence_feedback", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Linkage
  insightId: uuid("insight_id").references(() => intelligenceInsights.id, { onDelete: "set null" }),
  priorityId: uuid("priority_id").references(() => intelligencePriorities.id, { onDelete: "set null" }),
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  
  // What happened?
  recommendationFollowed: boolean("recommendation_followed").notNull(),
  followReason: text("follow_reason"), // Why they followed
  notFollowedReason: text("not_followed_reason"), // Why they ignored/changed
  
  // Outcomes (quantitative)
  outcomeType: text("outcome_type"), // 'metric_change', 'client_feedback', 'qa_evaluation'
  outcomeWindowStart: timestamp("outcome_window_start"),
  outcomeWindowEnd: timestamp("outcome_window_end"),
  outcomeMetricKey: text("outcome_metric_key"), // 'sessions', 'pipeline_value'
  outcomeBeforeValue: numeric("outcome_before_value"),
  outcomeAfterValue: numeric("outcome_after_value"),
  outcomeDeltaAbsolute: numeric("outcome_delta_absolute"),
  outcomeDeltaPercent: numeric("outcome_delta_percent"),
  
  // Evaluation
  outcomeScore: numeric("outcome_score"), // 0–1; how "good" was this outcome?
  humanRating: integer("human_rating"), // 1–5 rating from strategist/AM
  notes: text("notes"),
  
  // Lineage
  sourceSignals: uuid("source_signals").array(), // Signals used in evaluation
  createdByUserId: uuid("created_by_user_id").references(() => profiles.id, { onDelete: "set null" }),
  createdByAgent: text("created_by_agent"), // Which agent/workflow produced it
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("intelligence_feedback_agency_id_idx").on(table.agencyId),
  insightIdIdx: index("intelligence_feedback_insight_id_idx").on(table.insightId),
  priorityIdIdx: index("intelligence_feedback_priority_id_idx").on(table.priorityId),
  outcomeScoreIdx: index("intelligence_feedback_outcome_score_idx").on(table.outcomeScore),
  createdAtIdx: index("intelligence_feedback_created_at_idx").on(table.createdAt),
}));

// Insert schemas for intelligence layer
export const insertIntelligenceSignalSchema = createInsertSchema(intelligenceSignals).omit({
  id: true,
  ingestedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntelligenceInsightSchema = createInsertSchema(intelligenceInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntelligencePriorityConfigSchema = createInsertSchema(intelligencePriorityConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertIntelligencePrioritySchema = createInsertSchema(intelligencePriorities).omit({
  id: true,
  computedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntelligenceFeedbackSchema = createInsertSchema(intelligenceFeedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for intelligence layer
export type IntelligenceSignal = typeof intelligenceSignals.$inferSelect;
export type InsertIntelligenceSignal = z.infer<typeof insertIntelligenceSignalSchema>;

export type IntelligenceInsight = typeof intelligenceInsights.$inferSelect;
export type InsertIntelligenceInsight = z.infer<typeof insertIntelligenceInsightSchema>;

export type IntelligencePriorityConfig = typeof intelligencePriorityConfig.$inferSelect;
export type InsertIntelligencePriorityConfig = z.infer<typeof insertIntelligencePriorityConfigSchema>;

export type IntelligencePriority = typeof intelligencePriorities.$inferSelect;
export type InsertIntelligencePriority = z.infer<typeof insertIntelligencePrioritySchema>;

export type IntelligenceFeedback = typeof intelligenceFeedback.$inferSelect;
export type InsertIntelligenceFeedback = z.infer<typeof insertIntelligenceFeedbackSchema>;

// Enum type exports
export type IntelligenceSignalCategory = typeof intelligenceSignalCategoryEnum[number];
export type IntelligenceSignalSeverity = typeof intelligenceSignalSeverityEnum[number];
export type IntelligenceInsightStatus = typeof intelligenceInsightStatusEnum[number];
export type IntelligencePriorityStatus = typeof intelligencePriorityStatusEnum[number];
export type IntelligenceRankingBucket = typeof intelligenceRankingBucketEnum[number];

// ===========================================
// DURATION INTELLIGENCE (Task Estimation & Optimization)
// ===========================================

// Task channels/domains for categorization
export const taskChannelEnum = ["seo", "ppc", "email", "social", "content", "design", "development", "strategy", "admin", "other"] as const;
export const taskComplexityEnum = ["trivial", "simple", "moderate", "complex", "very_complex"] as const;
export const predictionConfidenceEnum = ["very_low", "low", "medium", "high", "very_high"] as const;
export const allocationStatusEnum = ["draft", "proposed", "approved", "rejected", "executed"] as const;

// TASK EXECUTION HISTORY - Historical task data for training duration models
export const taskExecutionHistory = pgTable("task_execution_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  
  // Core task metadata at completion time
  taskType: text("task_type").notNull(), // From task description categorization
  channel: text("channel"), // 'seo', 'ppc', 'email', 'social', 'content', 'design', 'development', etc.
  complexity: text("complexity").notNull().default("moderate"), // 'trivial', 'simple', 'moderate', 'complex', 'very_complex'
  
  // Extended features for prediction
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  assigneeId: uuid("assignee_id").references(() => profiles.id, { onDelete: "set null" }),
  aiInvolved: boolean("ai_involved").default(false), // Was AI used to assist?
  contextSize: integer("context_size"), // Number of assets/pages/items involved
  urgencyTier: text("urgency_tier"), // 'standard', 'high', 'critical'
  
  // Duration data
  estimatedHours: numeric("estimated_hours"), // Original estimate
  actualHours: numeric("actual_hours").notNull(), // Actual time tracked
  varianceHours: numeric("variance_hours"), // actual - estimated
  variancePercent: numeric("variance_percent"), // (actual - estimated) / estimated * 100
  
  // SLA context
  hadSlaBreached: boolean("had_sla_breached").default(false),
  slaResponseTimeHours: numeric("sla_response_time_hours"),
  slaResolutionTimeHours: numeric("sla_resolution_time_hours"),
  
  // Timeline
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("task_execution_history_agency_id_idx").on(table.agencyId),
  taskIdIdx: index("task_execution_history_task_id_idx").on(table.taskId),
  clientIdIdx: index("task_execution_history_client_id_idx").on(table.clientId),
  assigneeIdIdx: index("task_execution_history_assignee_id_idx").on(table.assigneeId),
  taskTypeIdx: index("task_execution_history_task_type_idx").on(table.taskType),
  channelIdx: index("task_execution_history_channel_idx").on(table.channel),
  complexityIdx: index("task_execution_history_complexity_idx").on(table.complexity),
  completedAtIdx: index("task_execution_history_completed_at_idx").on(table.completedAt),
}));

// TASK DURATION PREDICTIONS - Current predictions per task
export const taskDurationPredictions = pgTable("task_duration_predictions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  
  // Prediction outputs
  predictedHours: numeric("predicted_hours").notNull(),
  confidenceScore: numeric("confidence_score").notNull(), // 0-1
  confidenceLevel: text("confidence_level").notNull().default("medium"), // 'very_low', 'low', 'medium', 'high', 'very_high'
  predictionRange: jsonb("prediction_range"), // { min: number, max: number, p25: number, p75: number }
  
  // Model layering contributions
  baselineHours: numeric("baseline_hours"), // From heuristic (task_type, complexity, role)
  assigneeOffset: numeric("assignee_offset"), // +/- hours for assignee performance
  clientOffset: numeric("client_offset"), // +/- hours for client-specific drag
  contextSizeAdjustment: numeric("context_size_adjustment"), // Scaling for context size
  
  // Cold start handling
  isColdStart: boolean("is_cold_start").default(false),
  coldStartReason: text("cold_start_reason"), // 'new_client', 'new_task_type', 'new_assignee', 'insufficient_data'
  fallbackLevel: text("fallback_level"), // 'global', 'agency', 'channel', 'type'
  
  // Training data context
  sampleCount: integer("sample_count").default(0), // Similar tasks used for prediction
  sampleVariance: numeric("sample_variance"), // Variance in similar task durations
  sampleRecencyDays: integer("sample_recency_days"), // Average age of samples
  
  // Signals emitted
  signalEmittedAt: timestamp("signal_emitted_at"),
  signalId: uuid("signal_id"),
  
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // When to refresh prediction
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("task_duration_predictions_agency_id_idx").on(table.agencyId),
  taskIdIdx: index("task_duration_predictions_task_id_idx").on(table.taskId),
  confidenceScoreIdx: index("task_duration_predictions_confidence_score_idx").on(table.confidenceScore),
  isColdStartIdx: index("task_duration_predictions_is_cold_start_idx").on(table.isColdStart),
  computedAtIdx: index("task_duration_predictions_computed_at_idx").on(table.computedAt),
}));

// RESOURCE CAPACITY PROFILES - Staff capacity by time buckets
export const resourceCapacityProfiles = pgTable("resource_capacity_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  
  // Base capacity
  weeklyCapacityHours: numeric("weekly_capacity_hours").default("40").notNull(),
  dailyCapacityHours: numeric("daily_capacity_hours").default("8").notNull(),
  
  // Daily breakdown (hours available per day of week)
  mondayHours: numeric("monday_hours").default("8"),
  tuesdayHours: numeric("tuesday_hours").default("8"),
  wednesdayHours: numeric("wednesday_hours").default("8"),
  thursdayHours: numeric("thursday_hours").default("8"),
  fridayHours: numeric("friday_hours").default("8"),
  saturdayHours: numeric("saturday_hours").default("0"),
  sundayHours: numeric("sunday_hours").default("0"),
  
  // Focus constraints
  maxTasksPerDay: integer("max_tasks_per_day").default(8), // Context switch limit
  maxProjectsPerDay: integer("max_projects_per_day").default(4),
  preferredTaskDurationMin: numeric("preferred_task_duration_min").default("0.5"), // Hours
  preferredTaskDurationMax: numeric("preferred_task_duration_max").default("4"), // Hours
  
  // Skills for matching
  primarySkills: text("primary_skills").array(), // Core competencies
  secondarySkills: text("secondary_skills").array(), // Can do but not preferred
  channelSpecializations: text("channel_specializations").array(), // 'seo', 'ppc', etc.
  
  // Soft vs hard constraints
  softConstraints: jsonb("soft_constraints"), // { prefer_morning: true, avoid_fridays: false }
  hardConstraints: jsonb("hard_constraints"), // { max_hours_per_client: 20, no_urgent_after_4pm: true }
  
  // Performance modifiers (for prediction adjustments)
  speedModifier: numeric("speed_modifier").default("1.0"), // 1.0 = average, 1.2 = 20% faster
  qualityScore: numeric("quality_score").default("1.0"), // For skill matching weight
  
  // Time off / unavailability
  plannedTimeOff: jsonb("planned_time_off"), // Array of { startDate, endDate, type }
  
  isActive: boolean("is_active").default(true),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("resource_capacity_profiles_agency_id_idx").on(table.agencyId),
  staffIdIdx: index("resource_capacity_profiles_staff_id_idx").on(table.staffId),
  isActiveIdx: index("resource_capacity_profiles_is_active_idx").on(table.isActive),
  uniqueStaffProfile: uniqueIndex("resource_capacity_profiles_staff_unique").on(table.staffId, table.agencyId),
}));

// RESOURCE ALLOCATION PLAN - Assignment plans (previewable, editable, re-runnable)
export const resourceAllocationPlan = pgTable("resource_allocation_plan", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Plan metadata
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // 'draft', 'proposed', 'approved', 'rejected', 'executed'
  
  // Time window
  planStartDate: date("plan_start_date").notNull(),
  planEndDate: date("plan_end_date").notNull(),
  
  // Assignments (array of task->staff mappings)
  assignments: jsonb("assignments").notNull(), // Array of { taskId, staffId, scheduledDate, predictedHours, priority }
  
  // Optimization metrics
  totalPredictedHours: numeric("total_predicted_hours"),
  totalStaffCapacityHours: numeric("total_staff_capacity_hours"),
  utilizationRate: numeric("utilization_rate"), // totalPredicted / totalCapacity
  
  // Objective function scores
  overloadScore: numeric("overload_score"), // Lower is better - hours beyond capacity
  slaRiskScore: numeric("sla_risk_score"), // Lower is better - breach probability
  contextSwitchScore: numeric("context_switch_score"), // Lower is better
  skillFitScore: numeric("skill_fit_score"), // Higher is better
  commercialImpactScore: numeric("commercial_impact_score"), // Higher is better
  compositeScore: numeric("composite_score"), // Final optimization score
  
  // Human override tracking
  humanEdited: boolean("human_edited").default(false),
  editHistory: jsonb("edit_history"), // Array of { changedAt, changedBy, changes }
  
  // Execution
  executedAt: timestamp("executed_at"),
  executedBy: uuid("executed_by").references(() => profiles.id, { onDelete: "set null" }),
  
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("resource_allocation_plan_agency_id_idx").on(table.agencyId),
  statusIdx: index("resource_allocation_plan_status_idx").on(table.status),
  planStartDateIdx: index("resource_allocation_plan_start_date_idx").on(table.planStartDate),
}));

// COMMERCIAL IMPACT FACTORS - Per-agency configurable scoring weights and factors
export const commercialImpactFactors = pgTable("commercial_impact_factors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }).unique(),
  
  // Scoring formula weights (sum to 1.0)
  wRevenue: numeric("w_revenue").default("0.25").notNull(),
  wClientTier: numeric("w_client_tier").default("0.25").notNull(),
  wDeadlineRisk: numeric("w_deadline_risk").default("0.20").notNull(),
  wStrategicWeight: numeric("w_strategic_weight").default("0.15").notNull(),
  wLifecycleWeight: numeric("w_lifecycle_weight").default("0.15").notNull(),
  
  // Client tier definitions
  clientTierMapping: jsonb("client_tier_mapping").default('{"platinum": 1.0, "gold": 0.8, "silver": 0.6, "bronze": 0.4, "standard": 0.2}'),
  
  // Revenue impact scaling (how to normalize revenue values)
  revenueScaleMin: numeric("revenue_scale_min").default("0"), // Minimum revenue value
  revenueScaleMax: numeric("revenue_scale_max").default("100000"), // Maximum revenue value for scaling
  
  // Deadline risk curve parameters
  deadlineRiskDays: jsonb("deadline_risk_days").default('{"critical": 1, "high": 3, "medium": 7, "low": 14}'),
  
  // Strategic value for non-revenue work
  strategicValueMapping: jsonb("strategic_value_mapping").default('{"internal_initiative": 0.5, "tech_debt": 0.4, "relationship": 0.6, "retention": 0.7, "expansion": 0.8}'),
  
  // Lifecycle weight (where in client journey)
  lifecycleWeightMapping: jsonb("lifecycle_weight_mapping").default('{"onboarding": 0.9, "growth": 0.7, "mature": 0.5, "at_risk": 0.95, "churning": 0.3}'),
  
  // Decay settings for feedback loop
  feedbackDecayDays: integer("feedback_decay_days").default(90), // How long feedback influences scoring
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("commercial_impact_factors_agency_id_idx").on(table.agencyId),
}));

// COMMERCIAL IMPACT SCORES - Per-task/project commercial impact scores
export const commercialImpactScores = pgTable("commercial_impact_scores", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Reference to scored entity
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  initiativeId: uuid("initiative_id").references(() => initiatives.id, { onDelete: "cascade" }),
  
  // Client context
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientTier: text("client_tier"),
  clientLifecycleStage: text("client_lifecycle_stage"),
  
  // Individual factor scores (0-1)
  revenueScore: numeric("revenue_score").default("0"),
  clientTierScore: numeric("client_tier_score").default("0"),
  deadlineRiskScore: numeric("deadline_risk_score").default("0"),
  strategicScore: numeric("strategic_score").default("0"),
  lifecycleScore: numeric("lifecycle_score").default("0"),
  
  // Computed total
  totalImpactScore: numeric("total_impact_score").notNull(),
  
  // Revenue context
  estimatedRevenueImpact: numeric("estimated_revenue_impact"),
  revenueImpactType: text("revenue_impact_type"), // 'direct', 'retention', 'expansion', 'referral'
  
  // Strategic context
  isNonRevenueWork: boolean("is_non_revenue_work").default(false),
  nonRevenueType: text("non_revenue_type"), // 'internal_initiative', 'tech_debt', 'relationship', 'retention'
  
  // Deadline context
  daysUntilDeadline: integer("days_until_deadline"),
  slaAtRisk: boolean("sla_at_risk").default(false),
  
  // Feedback loop
  predictedVsActual: jsonb("predicted_vs_actual"), // { predicted: number, actual: number, variance: number }
  feedbackApplied: boolean("feedback_applied").default(false),
  
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("commercial_impact_scores_agency_id_idx").on(table.agencyId),
  taskIdIdx: index("commercial_impact_scores_task_id_idx").on(table.taskId),
  projectIdIdx: index("commercial_impact_scores_project_id_idx").on(table.projectId),
  clientIdIdx: index("commercial_impact_scores_client_id_idx").on(table.clientId),
  totalImpactScoreIdx: index("commercial_impact_scores_total_impact_idx").on(table.totalImpactScore),
}));

// ============================================
// CLOSED FEEDBACK LOOP TABLES
// ============================================

// Enum for outcome status
export const outcomeStatusEnum = ["pending", "success", "partial_success", "failure", "cancelled"] as const;
export const recommendationTypeEnum = ["strategic", "operational", "tactical", "analytical", "creative"] as const;
export const knowledgeCategoryTypeEnum = ["brand_voice", "business_constraints", "industry_context", "competitor_info", "historical_decisions", "operational_notes", "preferences"] as const;

// Recommendation outcomes - tracks initiative outcomes for feedback
export const recommendationOutcomes = pgTable("recommendation_outcomes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Link to initiative
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  recommendationSourceId: text("recommendation_source_id"), // Reference to original recommendation signal if applicable
  
  // Context
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  recommendationType: text("recommendation_type").notNull(), // strategic, operational, tactical
  
  // Outcome tracking
  outcomeStatus: text("outcome_status").notNull().default("pending"), // success, partial_success, failure
  
  // Impact comparison
  predictedImpact: jsonb("predicted_impact"), // { metric: string, value: number, unit: string }
  actualImpact: jsonb("actual_impact"), // { metric: string, value: number, unit: string, measuredAt: date }
  varianceScore: numeric("variance_score"), // percentage difference
  varianceDirection: text("variance_direction"), // overperformed, underperformed, on_target
  
  // Timing
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  completedAt: timestamp("completed_at"),
  measuredAt: timestamp("measured_at"),
  
  // Feedback notes
  outcomeNotes: text("outcome_notes"),
  lessonsLearned: text("lessons_learned"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("recommendation_outcomes_agency_id_idx").on(table.agencyId),
  initiativeIdIdx: index("recommendation_outcomes_initiative_id_idx").on(table.initiativeId),
  clientIdIdx: index("recommendation_outcomes_client_id_idx").on(table.clientId),
  outcomeStatusIdx: index("recommendation_outcomes_status_idx").on(table.outcomeStatus),
  recommendationTypeIdx: index("recommendation_outcomes_type_idx").on(table.recommendationType),
}));

// Quality metrics - rolling aggregates for recommendation effectiveness
export const recommendationQualityMetrics = pgTable("recommendation_quality_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Grouping dimensions
  recommendationType: text("recommendation_type").notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Counts
  totalRecommendations: integer("total_recommendations").default(0),
  acceptedCount: integer("accepted_count").default(0),
  rejectedCount: integer("rejected_count").default(0),
  completedCount: integer("completed_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  
  // Rates (0-1)
  acceptanceRate: numeric("acceptance_rate").default("0"),
  successRate: numeric("success_rate").default("0"),
  completionRate: numeric("completion_rate").default("0"),
  
  // Variance tracking
  avgVarianceScore: numeric("avg_variance_score").default("0"),
  varianceStdDev: numeric("variance_std_dev").default("0"),
  overperformCount: integer("overperform_count").default(0),
  underperformCount: integer("underperform_count").default(0),
  
  // Quality score (computed)
  qualityScore: numeric("quality_score").default("0.5"), // 0-1 composite score
  confidenceLevel: text("confidence_level").default("low"), // low, medium, high based on sample size
  
  // Trend indicators
  trendDirection: text("trend_direction"), // improving, stable, declining
  trendMagnitude: numeric("trend_magnitude").default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("recommendation_quality_metrics_agency_id_idx").on(table.agencyId),
  recommendationTypeIdx: index("recommendation_quality_metrics_type_idx").on(table.recommendationType),
  clientIdIdx: index("recommendation_quality_metrics_client_id_idx").on(table.clientId),
  periodIdx: index("recommendation_quality_metrics_period_idx").on(table.periodStart, table.periodEnd),
  qualityScoreIdx: index("recommendation_quality_metrics_quality_score_idx").on(table.qualityScore),
}));

// AI calibration parameters - adjustable settings based on feedback
export const aiCalibrationParameters = pgTable("ai_calibration_parameters", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Parameter identification
  parameterKey: text("parameter_key").notNull(), // e.g., "confidence_threshold_strategic", "client_weight_enterprise"
  parameterCategory: text("parameter_category").notNull(), // confidence, weighting, threshold, prompt
  
  // Current value
  currentValue: numeric("current_value").notNull(),
  defaultValue: numeric("default_value").notNull(),
  minValue: numeric("min_value"),
  maxValue: numeric("max_value"),
  
  // Client-specific override
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  
  // Adjustment history
  adjustmentHistory: jsonb("adjustment_history").default("[]"), // Array of { value, reason, adjustedAt, triggeredBy }
  lastAdjustedAt: timestamp("last_adjusted_at"),
  lastAdjustmentReason: text("last_adjustment_reason"),
  
  // Calibration source
  autoCalibrated: boolean("auto_calibrated").default(false),
  manualOverride: boolean("manual_override").default(false),
  
  // Effectiveness tracking
  effectivenessScore: numeric("effectiveness_score").default("0.5"),
  sampleCount: integer("sample_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("ai_calibration_parameters_agency_id_idx").on(table.agencyId),
  parameterKeyIdx: index("ai_calibration_parameters_key_idx").on(table.parameterKey),
  clientIdIdx: index("ai_calibration_parameters_client_id_idx").on(table.clientId),
  categoryIdx: index("ai_calibration_parameters_category_idx").on(table.parameterCategory),
  agencyKeyUnique: index("ai_calibration_parameters_agency_key_unique").on(table.agencyId, table.parameterKey, table.clientId),
}));

// ============================================
// BRAND KNOWLEDGE LAYER TABLES
// ============================================

// Knowledge categories - defines schema for each knowledge type
export const knowledgeCategories = pgTable("knowledge_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }),
  
  // Category definition
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  categoryType: text("category_type").notNull(), // brand_voice, business_constraints, industry_context, etc.
  
  // Schema definition (JSON Schema format)
  schemaDefinition: jsonb("schema_definition").notNull(), // { fields: [{ name, type, required, options }] }
  requiredFields: text("required_fields").array().default([]),
  
  // Validation rules
  validationRules: jsonb("validation_rules"), // Custom validation beyond schema
  
  // Display settings
  displayOrder: integer("display_order").default(0),
  icon: text("icon"),
  color: text("color"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isSystemCategory: boolean("is_system_category").default(false), // Built-in vs custom
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("knowledge_categories_agency_id_idx").on(table.agencyId),
  categoryTypeIdx: index("knowledge_categories_type_idx").on(table.categoryType),
  nameIdx: index("knowledge_categories_name_idx").on(table.name),
}));

// Client knowledge entries - structured brand/business knowledge
export const clientKnowledge = pgTable("client_knowledge", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Ownership
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  
  // Category reference
  categoryId: uuid("category_id").notNull().references(() => knowledgeCategories.id, { onDelete: "cascade" }),
  
  // Content
  title: text("title").notNull(),
  content: text("content"), // Main text content
  structuredData: jsonb("structured_data"), // Category-specific structured fields
  
  // Metadata
  source: text("source"), // manual, imported, extracted, ai_generated
  sourceUrl: text("source_url"),
  sourceDocumentId: text("source_document_id"),
  
  // Validity
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  isCurrentlyValid: boolean("is_currently_valid").default(true),
  
  // Confidence and quality
  confidenceScore: numeric("confidence_score").default("1"), // 0-1, how reliable is this knowledge
  verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  
  // Versioning
  version: integer("version").default(1),
  previousVersionId: uuid("previous_version_id"),
  
  // Usage tracking
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  lastUsedInContext: text("last_used_in_context"), // recommendation, analysis, chat, etc.
  
  // Status
  status: text("status").default("active"), // active, archived, superseded, draft
  
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("client_knowledge_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("client_knowledge_client_id_idx").on(table.clientId),
  categoryIdIdx: index("client_knowledge_category_id_idx").on(table.categoryId),
  statusIdx: index("client_knowledge_status_idx").on(table.status),
  validityIdx: index("client_knowledge_validity_idx").on(table.isCurrentlyValid, table.validFrom, table.validUntil),
  textSearchIdx: index("client_knowledge_title_idx").on(table.title),
}));

// Knowledge ingestion log - audit trail for knowledge changes
export const knowledgeIngestionLog = pgTable("knowledge_ingestion_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  
  // Reference to client knowledge entry
  knowledgeId: uuid("knowledge_id").references(() => clientKnowledge.id, { onDelete: "set null" }),
  
  // Ingestion details
  action: text("action").notNull(), // created, updated, validated, archived, superseded, conflict_detected
  sourceType: text("source_type").notNull(), // manual, api, import, ai_extraction
  
  // Before/after for updates
  previousData: jsonb("previous_data"),
  newData: jsonb("new_data"),
  changeDescription: text("change_description"),
  
  // Validation
  validationStatus: text("validation_status").notNull().default("pending"), // pending, passed, failed, skipped
  validationErrors: jsonb("validation_errors"), // Array of validation error messages
  
  // Conflict detection
  conflictDetected: boolean("conflict_detected").default(false),
  conflictDetails: jsonb("conflict_details"), // { conflictingDocumentId, field, reason }
  conflictResolution: text("conflict_resolution"), // kept_new, kept_existing, merged, manual
  
  // Actor
  performedBy: uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("knowledge_ingestion_log_agency_id_idx").on(table.agencyId),
  knowledgeIdIdx: index("knowledge_ingestion_log_knowledge_id_idx").on(table.knowledgeId),
  actionIdx: index("knowledge_ingestion_log_action_idx").on(table.action),
  validationStatusIdx: index("knowledge_ingestion_log_validation_status_idx").on(table.validationStatus),
  performedAtIdx: index("knowledge_ingestion_log_performed_at_idx").on(table.performedAt),
}));

// ============================================
// GOVERNED CONTROL-PLANE ARTIFACTS
// ============================================

export const gateTypeEnum = ["opportunity", "initiative", "acceptance", "outcome", "learning"] as const;
export const gateDecisionEnum = ["approve", "reject", "defer"] as const;

export const opportunityArtifacts = pgTable("opportunity_artifacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  opportunityStatement: text("opportunity_statement").notNull(),
  reasoning: text("reasoning"),
  assumptions: jsonb("assumptions"),
  confidence: text("confidence"),
  evidenceRefs: jsonb("evidence_refs"),
  risks: jsonb("risks"),
  suggestedSuccessCriteria: jsonb("suggested_success_criteria"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("opportunity_artifacts_agency_id_idx").on(table.agencyId),
  clientIdIdx: index("opportunity_artifacts_client_id_idx").on(table.clientId),
}));

export const gateDecisions = pgTable("gate_decisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  gateType: text("gate_type").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale"),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  actorId: uuid("actor_id").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("gate_decisions_agency_id_idx").on(table.agencyId),
  targetIdx: index("gate_decisions_target_idx").on(table.targetType, table.targetId),
}));

export const initiativeIntents = pgTable("initiative_intents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  intentStatement: text("intent_statement").notNull(),
  constraints: jsonb("constraints"),
  successCriteria: jsonb("success_criteria"),
  boundaryConditions: jsonb("boundary_conditions"),
  evaluationHorizon: text("evaluation_horizon"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index("initiative_intents_initiative_id_idx").on(table.initiativeId),
}));

export const skuCompositions = pgTable("sku_compositions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  productSku: text("product_sku").notNull(),
  executionSkus: jsonb("execution_skus"),
  frozenAt: timestamp("frozen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index("sku_compositions_initiative_id_idx").on(table.initiativeId),
}));

export const executionOutputs = pgTable("execution_outputs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  output: jsonb("output"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index("execution_outputs_initiative_id_idx").on(table.initiativeId),
}));

export const outcomeReviews = pgTable("outcome_reviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  outcomeSummary: text("outcome_summary"),
  kpiDelta: jsonb("kpi_delta"),
  qualitativeFeedback: jsonb("qualitative_feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index("outcome_reviews_initiative_id_idx").on(table.initiativeId),
}));

export const learningArtifacts = pgTable("learning_artifacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: uuid("initiative_id").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  learning: text("learning").notNull(),
  invalidatedAssumptions: jsonb("invalidated_assumptions"),
  confidence: text("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index("learning_artifacts_initiative_id_idx").on(table.initiativeId),
}));

// POLICY BUNDLES (Control-plane policy bundles and versions)
export const policyBundles = pgTable("policy_bundles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, active, archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agencyIdIdx: index("policy_bundles_agency_id_idx").on(table.agencyId),
}));

export const policyBundleVersions = pgTable("policy_bundle_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleId: uuid("bundle_id").notNull().references(() => policyBundles.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"), // draft, active, archived
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  bundleIdIdx: index("policy_bundle_versions_bundle_id_idx").on(table.bundleId),
  versionIdx: index("policy_bundle_versions_version_idx").on(table.bundleId, table.version),
}));

// Insert schemas for Duration Intelligence
export const insertTaskExecutionHistorySchema = createInsertSchema(taskExecutionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertTaskDurationPredictionSchema = createInsertSchema(taskDurationPredictions).omit({
  id: true,
  computedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResourceCapacityProfileSchema = createInsertSchema(resourceCapacityProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResourceAllocationPlanSchema = createInsertSchema(resourceAllocationPlan).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommercialImpactFactorsSchema = createInsertSchema(commercialImpactFactors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommercialImpactScoreSchema = createInsertSchema(commercialImpactScores).omit({
  id: true,
  computedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for Duration Intelligence
export type TaskExecutionHistory = typeof taskExecutionHistory.$inferSelect;
export type InsertTaskExecutionHistory = z.infer<typeof insertTaskExecutionHistorySchema>;

export type TaskDurationPrediction = typeof taskDurationPredictions.$inferSelect;
export type InsertTaskDurationPrediction = z.infer<typeof insertTaskDurationPredictionSchema>;

export type ResourceCapacityProfile = typeof resourceCapacityProfiles.$inferSelect;
export type InsertResourceCapacityProfile = z.infer<typeof insertResourceCapacityProfileSchema>;

export type ResourceAllocationPlan = typeof resourceAllocationPlan.$inferSelect;
export type InsertResourceAllocationPlan = z.infer<typeof insertResourceAllocationPlanSchema>;

export type CommercialImpactFactors = typeof commercialImpactFactors.$inferSelect;
export type InsertCommercialImpactFactors = z.infer<typeof insertCommercialImpactFactorsSchema>;

export type CommercialImpactScore = typeof commercialImpactScores.$inferSelect;
export type InsertCommercialImpactScore = z.infer<typeof insertCommercialImpactScoreSchema>;

// Enum type exports for Duration Intelligence
export type TaskChannel = typeof taskChannelEnum[number];
export type TaskComplexity = typeof taskComplexityEnum[number];
export type PredictionConfidence = typeof predictionConfidenceEnum[number];
export type AllocationStatus = typeof allocationStatusEnum[number];

// ============================================
// INSERT SCHEMAS FOR CLOSED FEEDBACK LOOP
// ============================================

export const insertOpportunityArtifactSchema = createInsertSchema(opportunityArtifacts).omit({
  id: true,
  createdAt: true,
});

export const insertGateDecisionSchema = createInsertSchema(gateDecisions).omit({
  id: true,
  createdAt: true,
});

export const insertInitiativeIntentSchema = createInsertSchema(initiativeIntents).omit({
  id: true,
  createdAt: true,
});

export const insertSkuCompositionSchema = createInsertSchema(skuCompositions).omit({
  id: true,
  createdAt: true,
});

export const insertExecutionOutputSchema = createInsertSchema(executionOutputs).omit({
  id: true,
  createdAt: true,
});

export const insertOutcomeReviewSchema = createInsertSchema(outcomeReviews).omit({
  id: true,
  createdAt: true,
});

export const insertLearningArtifactSchema = createInsertSchema(learningArtifacts).omit({
  id: true,
  createdAt: true,
});

export const insertRecommendationOutcomeSchema = createInsertSchema(recommendationOutcomes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationQualityMetricSchema = createInsertSchema(recommendationQualityMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiCalibrationParameterSchema = createInsertSchema(aiCalibrationParameters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// INSERT SCHEMAS FOR BRAND KNOWLEDGE LAYER
// ============================================

export const insertKnowledgeCategorySchema = createInsertSchema(knowledgeCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientKnowledgeSchema = createInsertSchema(clientKnowledge).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKnowledgeIngestionLogSchema = createInsertSchema(knowledgeIngestionLog).omit({
  id: true,
  createdAt: true,
});

// ============================================
// TYPE EXPORTS FOR CLOSED FEEDBACK LOOP
// ============================================

export type OpportunityArtifact = typeof opportunityArtifacts.$inferSelect;
export type InsertOpportunityArtifact = z.infer<typeof insertOpportunityArtifactSchema>;

export type GateDecision = typeof gateDecisions.$inferSelect;
export type InsertGateDecision = z.infer<typeof insertGateDecisionSchema>;

export type InitiativeIntent = typeof initiativeIntents.$inferSelect;
export type InsertInitiativeIntent = z.infer<typeof insertInitiativeIntentSchema>;

export type SkuComposition = typeof skuCompositions.$inferSelect;
export type InsertSkuComposition = z.infer<typeof insertSkuCompositionSchema>;

export type ExecutionOutput = typeof executionOutputs.$inferSelect;
export type InsertExecutionOutput = z.infer<typeof insertExecutionOutputSchema>;

export type OutcomeReview = typeof outcomeReviews.$inferSelect;
export type InsertOutcomeReview = z.infer<typeof insertOutcomeReviewSchema>;

export type LearningArtifact = typeof learningArtifacts.$inferSelect;
export type InsertLearningArtifact = z.infer<typeof insertLearningArtifactSchema>;

export type RecommendationOutcome = typeof recommendationOutcomes.$inferSelect;
export type InsertRecommendationOutcome = z.infer<typeof insertRecommendationOutcomeSchema>;

export type RecommendationQualityMetric = typeof recommendationQualityMetrics.$inferSelect;
export type InsertRecommendationQualityMetric = z.infer<typeof insertRecommendationQualityMetricSchema>;

export type AiCalibrationParameter = typeof aiCalibrationParameters.$inferSelect;
export type InsertAiCalibrationParameter = z.infer<typeof insertAiCalibrationParameterSchema>;

// ============================================
// TYPE EXPORTS FOR BRAND KNOWLEDGE LAYER
// ============================================

export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type InsertKnowledgeCategory = z.infer<typeof insertKnowledgeCategorySchema>;

export type ClientKnowledge = typeof clientKnowledge.$inferSelect;
export type InsertClientKnowledge = z.infer<typeof insertClientKnowledgeSchema>;

export type KnowledgeIngestionLog = typeof knowledgeIngestionLog.$inferSelect;
export type InsertKnowledgeIngestionLog = z.infer<typeof insertKnowledgeIngestionLogSchema>;

// Enum type exports for Feedback and Knowledge
export type OutcomeStatus = typeof outcomeStatusEnum[number];
export type RecommendationType = typeof recommendationTypeEnum[number];
export type KnowledgeCategoryType = typeof knowledgeCategoryTypeEnum[number];
