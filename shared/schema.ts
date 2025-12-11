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
  // Branding / White-labeling logos
  agencyLogo: text("agency_logo"), // URL/path for internal agency portal header
  clientLogo: text("client_logo"), // URL/path for external client portal header
  staffLogo: text("staff_logo"), // URL/path for staff/talent portal header
  // HubSpot CRM Integration (agency-wide)
  hubspotAccessToken: text("hubspot_access_token"), // Encrypted before storage
  hubspotAccessTokenIv: text("hubspot_access_token_iv"), // IV for encryption
  hubspotAccessTokenAuthTag: text("hubspot_access_token_auth_tag"), // Auth tag for encryption
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("projects_client_id_idx").on(table.clientId),
}));

// TASK LISTS (Projects > Task Lists > Tasks hierarchy)
export const taskLists = pgTable("task_lists", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }), // For RLS tenant isolation
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("task_lists_project_id_idx").on(table.projectId),
  agencyIdIdx: index("task_lists_agency_id_idx").on(table.agencyId),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index("tasks_list_id_idx").on(table.listId),
  parentIdIdx: index("tasks_parent_id_idx").on(table.parentId),
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
export const workflowStepTypeEnum = ["signal", "rule", "ai", "action", "branch", "parallel"] as const;
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
}));

// WORKFLOW EVENTS (Step-by-step execution log)
export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: uuid("execution_id").notNull().references(() => workflowExecutions.id, { onDelete: "cascade" }),
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
  stepIdIdx: index("workflow_events_step_id_idx").on(table.stepId),
  timestampIdx: index("workflow_events_timestamp_idx").on(table.timestamp),
}));

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

// Workflow step definition types (used in workflow.steps JSON field)
export interface WorkflowStepConfig {
  signal?: { type: string; filter?: Record<string, unknown> };
  rule?: { conditions: RuleCondition[]; logic: 'all' | 'any' };
  ai?: { provider?: string; prompt: string; schema?: Record<string, unknown> };
  action?: { type: string; config: Record<string, unknown> };
  branch?: { conditions: BranchCondition[]; default?: string };
  parallel?: { steps: string[] };
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
