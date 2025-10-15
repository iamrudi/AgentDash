import {
  type User,
  type InsertUser,
  type Profile,
  type InsertProfile,
  type Client,
  type InsertClient,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type StaffAssignment,
  type InsertStaffAssignment,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type Initiative,
  type InsertInitiative,
  type DailyMetric,
  type InsertDailyMetric,
  type ClientIntegration,
  type InsertClientIntegration,
  type AgencyIntegration,
  type InsertAgencyIntegration,
  type AgencyIntegrationClientAccess,
  type InsertAgencyIntegrationClientAccess,
  type ClientObjective,
  type InsertClientObjective,
  type ClientMessage,
  type InsertClientMessage,
  type Notification,
  type InsertNotification,
  type Agency,
  users,
  profiles,
  clients,
  projects,
  tasks,
  staffAssignments,
  invoices,
  invoiceLineItems,
  initiatives,
  dailyMetrics,
  clientIntegrations,
  agencyIntegrations,
  agencyIntegrationClientAccess,
  clientObjectives,
  clientMessages,
  notifications,
  agencies,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encryptToken, decryptToken } from "./lib/encryption";

export interface IStorage {
  // Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsersWithProfiles(agencyId?: string): Promise<Array<User & { profile: Profile | null; client?: Client | null }>>;
  updateUserRole(userId: string, role: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  // Profiles
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  getAllStaff(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  
  // Clients
  getClientById(id: string): Promise<Client | undefined>;
  getClientByProfileId(profileId: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  getAllClientsWithDetails(agencyId?: string): Promise<Array<Client & { 
    primaryContact: string | null; 
    activeProjectsCount: number;
    overdueInvoicesCount: number;
    hasGA4: boolean;
    hasGSC: boolean;
    hasDFS: boolean;
  }>>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<Client>): Promise<Client>;
  deductRetainerHours(clientId: string, hours: number): Promise<Client>;
  resetRetainerHours(clientId: string): Promise<Client>;
  checkRetainerHours(clientId: string): Promise<{ available: number; used: number; total: number }>;
  
  // Projects
  getProjectById(id: string): Promise<Project | undefined>;
  getProjectsByClientId(clientId: string): Promise<Project[]>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  
  // Tasks
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getTasksByStaffId(staffProfileId: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  
  // Staff Assignments
  createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment>;
  getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]>;
  deleteStaffAssignment(taskId: string, staffProfileId: string): Promise<void>;
  
  // Project with Tasks
  getProjectWithTasks(projectId: string): Promise<{
    project: Project;
    tasks: Array<Task & { assignments: Array<StaffAssignment & { staffProfile: Profile }> }>;
  } | undefined>;
  
  // Invoices
  getInvoiceById(id: string): Promise<Invoice | undefined>;
  getInvoicesByClientId(clientId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoiceStatus(invoiceId: string, status: string): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice>;
  
  // Invoice Line Items
  getInvoiceLineItemsByInvoiceId(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  createInvoiceLineItems(lineItems: InsertInvoiceLineItem[]): Promise<InvoiceLineItem[]>;
  deleteInvoiceLineItem(id: string): Promise<void>;
  
  // Initiatives
  getInitiativeById(id: string): Promise<Initiative | undefined>;
  getInitiativesByClientId(clientId: string): Promise<Initiative[]>;
  getAllInitiatives(): Promise<Initiative[]>;
  getDeletedInitiatives(): Promise<Initiative[]>;
  createInitiative(rec: InsertInitiative): Promise<Initiative>;
  updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative>;
  sendInitiativeToClient(id: string): Promise<Initiative>;
  updateInitiativeClientResponse(id: string, response: string, feedback?: string): Promise<Initiative>;
  softDeleteInitiative(id: string): Promise<Initiative>;
  restoreInitiative(id: string): Promise<Initiative>;
  permanentlyDeleteInitiative(id: string): Promise<void>;
  
  // Daily Metrics
  getMetricsByClientId(clientId: string, limit?: number): Promise<DailyMetric[]>;
  getAllMetrics(limit?: number, agencyId?: string): Promise<DailyMetric[]>;
  createMetric(metric: InsertDailyMetric): Promise<DailyMetric>;
  deleteMetricsByClientIdAndDateRange(clientId: string, startDate: string, endDate: string): Promise<void>;
  
  // Client Integrations
  getIntegrationByClientId(clientId: string, serviceName: string): Promise<ClientIntegration | undefined>;
  getAllIntegrationsByClientId(clientId: string): Promise<ClientIntegration[]>;
  getAllIntegrations(agencyId?: string): Promise<ClientIntegration[]>;
  createIntegration(integration: InsertClientIntegration): Promise<ClientIntegration>;
  updateIntegration(id: string, data: Partial<ClientIntegration>): Promise<ClientIntegration>;
  deleteIntegration(id: string): Promise<void>;
  
  // Agency Integrations
  getAgencyIntegration(agencyId: string, serviceName: string): Promise<AgencyIntegration | undefined>;
  createAgencyIntegration(integration: InsertAgencyIntegration): Promise<AgencyIntegration>;
  updateAgencyIntegration(id: string, data: Partial<AgencyIntegration>): Promise<AgencyIntegration>;
  getClientAccessList(agencyIntegrationId: string): Promise<string[]>;
  setClientAccess(agencyIntegrationId: string, clientIds: string[]): Promise<void>;
  hasClientAccess(agencyIntegrationId: string, clientId: string): Promise<boolean>;
  
  // Client Objectives
  getObjectivesByClientId(clientId: string): Promise<ClientObjective[]>;
  getActiveObjectivesByClientId(clientId: string): Promise<ClientObjective[]>;
  createObjective(objective: InsertClientObjective): Promise<ClientObjective>;
  updateObjective(id: string, data: Partial<ClientObjective>): Promise<ClientObjective>;
  deleteObjective(id: string): Promise<void>;
  
  // Client Messages
  getMessagesByClientId(clientId: string): Promise<ClientMessage[]>;
  createMessage(message: InsertClientMessage): Promise<ClientMessage>;
  getAllMessages(agencyId?: string): Promise<ClientMessage[]>;
  markMessageAsRead(id: string): Promise<void>;
  
  // Notifications (Legacy counts for badges)
  getNotificationCounts(agencyId?: string): Promise<{ unreadMessages: number; unviewedResponses: number }>;
  markInitiativeResponsesViewed(): Promise<void>;
  getClientNotificationCounts(clientId: string): Promise<{ unreadMessages: number; newRecommendations: number }>;
  getStaffNotificationCounts(staffProfileId: string): Promise<{ newTasks: number; highPriorityTasks: number }>;
  
  // Notification Center
  getNotificationsByUserId(userId: string, isArchived?: boolean): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  archiveNotification(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class DbStorage implements IStorage {
  // Users
  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getAllUsersWithProfiles(agencyId?: string): Promise<Array<User & { profile: Profile | null; client?: Client | null }>> {
    if (agencyId) {
      // Get all profiles and clients for this agency
      const [agencyProfiles, agencyClients] = await Promise.all([
        db.select().from(profiles).where(eq(profiles.agencyId, agencyId)),
        db.select().from(clients).where(eq(clients.agencyId, agencyId))
      ]);
      
      // Build client map for efficiency
      const clientMap = new Map(agencyClients.map(c => [c.profileId, c]));
      
      // Build user objects from profiles (profile.id IS the Supabase Auth user ID)
      const usersWithProfiles = agencyProfiles.map((profile) => {
        let client = null;
        if (profile.role === "Client") {
          client = clientMap.get(profile.id) || null;
        }
        // Create a compatible User object from profile data
        return {
          id: profile.id, // Supabase Auth user ID
          email: '', // Will be fetched from Supabase Auth if needed
          password: '', // Not stored locally anymore
          createdAt: profile.createdAt,
          profile,
          client,
        };
      });
      
      return usersWithProfiles.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    
    // Original implementation without agency filtering
    const allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    
    const usersWithProfiles = await Promise.all(
      allProfiles.map(async (profile) => {
        let client = null;
        if (profile.role === "Client") {
          client = await this.getClientByProfileId(profile.id);
        }
        return {
          id: profile.id, // Supabase Auth user ID
          email: '', // Will be fetched from Supabase Auth if needed
          password: '', // Not stored locally anymore
          createdAt: profile.createdAt,
          profile,
          client: client || null,
        };
      })
    );
    
    return usersWithProfiles;
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    const profile = await this.getProfileByUserId(userId);
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    await db.update(profiles)
      .set({ role })
      .where(eq(profiles.id, userId)); // profile.id IS the user ID
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete user will cascade to related records (profile, client, etc.) due to foreign key constraints
    await db.delete(users).where(eq(users.id, userId));
  }

  // Profiles
  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    // With Supabase Auth, profile.id IS the user ID
    const result = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    return result[0];
  }

  async getProfileById(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return result[0];
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const result = await db.insert(profiles).values(profile).returning();
    return result[0];
  }

  // Agencies
  async getDefaultAgency(): Promise<Agency | undefined> {
    const result = await db.select().from(agencies).orderBy(agencies.createdAt).limit(1);
    return result[0];
  }

  async getAllStaff(agencyId?: string): Promise<Profile[]> {
    if (agencyId) {
      return await db.select().from(profiles)
        .where(and(eq(profiles.role, "Staff"), eq(profiles.agencyId, agencyId)))
        .orderBy(desc(profiles.createdAt));
    }
    return await db.select().from(profiles).where(eq(profiles.role, "Staff")).orderBy(desc(profiles.createdAt));
  }

  // Clients
  async getClientById(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async getClientByProfileId(profileId: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.profileId, profileId)).limit(1);
    return result[0];
  }

  async getAllClients(agencyId?: string): Promise<Client[]> {
    if (agencyId) {
      return await db.select().from(clients)
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(clients.createdAt));
    }
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getAllClientsWithDetails(agencyId?: string): Promise<Array<Client & { 
    primaryContact: string | null; 
    activeProjectsCount: number;
    overdueInvoicesCount: number;
    hasGA4: boolean;
    hasGSC: boolean;
    hasDFS: boolean;
  }>> {
    const allClients = agencyId 
      ? await db.select().from(clients).where(eq(clients.agencyId, agencyId)).orderBy(desc(clients.createdAt))
      : await db.select().from(clients).orderBy(desc(clients.createdAt));
    
    // Fetch all related data in bulk to avoid N+1 queries
    const [allProfiles, allProjects, allInvoices, allIntegrations, allAgencyIntegrations, allClientAccess] = await Promise.all([
      db.select().from(profiles),
      db.select().from(projects),
      db.select().from(invoices),
      db.select().from(clientIntegrations),
      agencyId ? db.select().from(agencyIntegrations).where(eq(agencyIntegrations.agencyId, agencyId)) : Promise.resolve([]),
      agencyId ? db.select().from(agencyIntegrationClientAccess) : Promise.resolve([]),
    ]);
    
    // Create lookup maps for efficient access
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    const projectsByClient = new Map<string, typeof allProjects>();
    const invoicesByClient = new Map<string, typeof allInvoices>();
    const integrationsByClient = new Map<string, typeof allIntegrations>();
    
    allProjects.forEach(project => {
      const existing = projectsByClient.get(project.clientId) || [];
      projectsByClient.set(project.clientId, [...existing, project]);
    });
    
    allInvoices.forEach(invoice => {
      const existing = invoicesByClient.get(invoice.clientId) || [];
      invoicesByClient.set(invoice.clientId, [...existing, invoice]);
    });
    
    allIntegrations.forEach(integration => {
      const existing = integrationsByClient.get(integration.clientId) || [];
      integrationsByClient.set(integration.clientId, [...existing, integration]);
    });
    
    // Create DFS agency integration access map
    const agencyDFSIntegration = allAgencyIntegrations.find(i => i.serviceName === 'DataForSEO');
    const dfsAccessSet = new Set<string>();
    if (agencyDFSIntegration) {
      allClientAccess
        .filter(access => access.agencyIntegrationId === agencyDFSIntegration.id)
        .forEach(access => dfsAccessSet.add(access.clientId));
    }
    
    const now = new Date();
    
    // Enrich clients with data from lookup maps
    const enrichedClients = allClients.map((client) => {
      const profile = profileMap.get(client.profileId);
      const primaryContact = profile?.fullName || null;
      
      const clientProjects = projectsByClient.get(client.id) || [];
      const activeProjectsCount = clientProjects.filter(p => p.status === 'Active').length;
      
      const clientInvoices = invoicesByClient.get(client.id) || [];
      const overdueInvoicesCount = clientInvoices.filter(inv => {
        if (inv.status !== 'Paid' && inv.dueDate) {
          return new Date(inv.dueDate) < now;
        }
        return false;
      }).length;
      
      const clientIntegrationsList = integrationsByClient.get(client.id) || [];
      const ga4Integration = clientIntegrationsList.find(i => i.serviceName === 'GA4');
      const gscIntegration = clientIntegrationsList.find(i => i.serviceName === 'GSC');
      const dfsIntegration = clientIntegrationsList.find(i => i.serviceName === 'DataForSEO');
      
      const hasGA4 = !!ga4Integration && ga4Integration.accessToken !== null;
      const hasGSC = !!gscIntegration && gscIntegration.accessToken !== null;
      const hasDFS = (!!dfsIntegration && dfsIntegration.dataForSeoLogin !== null) || dfsAccessSet.has(client.id);
      
      return {
        ...client,
        primaryContact,
        activeProjectsCount,
        overdueInvoicesCount,
        hasGA4,
        hasGSC,
        hasDFS,
      };
    });
    
    return enrichedClients;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    const result = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return result[0];
  }

  async deductRetainerHours(clientId: string, hours: number): Promise<Client> {
    const client = await this.getClientById(clientId);
    if (!client) throw new Error("Client not found");
    
    const usedHours = parseFloat(client.usedRetainerHours || "0");
    const newUsedHours = usedHours + hours;
    
    const result = await db
      .update(clients)
      .set({ usedRetainerHours: newUsedHours.toString() })
      .where(eq(clients.id, clientId))
      .returning();
    
    return result[0];
  }

  async resetRetainerHours(clientId: string): Promise<Client> {
    const result = await db
      .update(clients)
      .set({ 
        usedRetainerHours: "0",
        retainerHoursResetDate: new Date().toISOString().split('T')[0]
      })
      .where(eq(clients.id, clientId))
      .returning();
    
    return result[0];
  }

  async checkRetainerHours(clientId: string): Promise<{ available: number; used: number; total: number }> {
    const client = await this.getClientById(clientId);
    if (!client) throw new Error("Client not found");
    
    const total = parseFloat(client.monthlyRetainerHours || "0");
    const used = parseFloat(client.usedRetainerHours || "0");
    const available = Math.max(0, total - used);
    
    return { available, used, total };
  }

  // Projects
  async getProjectById(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getProjectsByClientId(clientId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.clientId, clientId)).orderBy(desc(projects.createdAt));
  }

  async getAllProjects(agencyId?: string): Promise<Project[]> {
    if (agencyId) {
      // Join with clients table to filter by agencyId
      const results = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          description: projects.description,
          clientId: projects.clientId,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(projects.createdAt));
      return results;
    }
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const result = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return result[0];
  }

  // Tasks
  async getTaskById(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksByStaffId(staffProfileId: string): Promise<Task[]> {
    const assignments = await db.select().from(staffAssignments).where(eq(staffAssignments.staffProfileId, staffProfileId));
    const taskIds = assignments.map(a => a.taskId);
    
    if (taskIds.length === 0) return [];
    
    return await db.select().from(tasks).where(eq(tasks.id, taskIds[0])).orderBy(desc(tasks.createdAt));
  }

  async getAllTasks(agencyId?: string): Promise<Task[]> {
    if (agencyId) {
      // Join through projects -> clients to filter by agencyId
      const results = await db
        .select({
          id: tasks.id,
          description: tasks.description,
          status: tasks.status,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          projectId: tasks.projectId,
          initiativeId: tasks.initiativeId,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(tasks.createdAt));
      return results;
    }
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const result = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<void> {
    // First delete all staff assignments for this task
    await db.delete(staffAssignments).where(eq(staffAssignments.taskId, id));
    // Then delete the task
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Staff Assignments
  async createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment> {
    const result = await db.insert(staffAssignments).values(assignment).returning();
    return result[0];
  }

  async getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]> {
    return await db.select().from(staffAssignments).where(eq(staffAssignments.taskId, taskId));
  }

  async deleteStaffAssignment(taskId: string, staffProfileId: string): Promise<void> {
    await db.delete(staffAssignments)
      .where(
        and(
          eq(staffAssignments.taskId, taskId),
          eq(staffAssignments.staffProfileId, staffProfileId)
        )
      );
  }

  // Project with Tasks
  async getProjectWithTasks(projectId: string): Promise<{
    project: Project;
    tasks: Array<Task & { assignments: Array<StaffAssignment & { staffProfile: Profile }> }>;
  } | undefined> {
    // Get the project
    const project = await this.getProjectById(projectId);
    if (!project) return undefined;

    // Get all tasks for this project
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

    // For each task, get staff assignments with profile details
    const tasksWithAssignments = await Promise.all(
      projectTasks.map(async (task) => {
        const assignments = await db
          .select()
          .from(staffAssignments)
          .leftJoin(profiles, eq(staffAssignments.staffProfileId, profiles.id))
          .where(eq(staffAssignments.taskId, task.id));

        return {
          ...task,
          assignments: assignments.map(a => ({
            ...a.staff_assignments,
            staffProfile: a.profiles!
          }))
        };
      })
    );

    return {
      project,
      tasks: tasksWithAssignments
    };
  }

  // Invoices
  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return result[0];
  }

  async getInvoicesByClientId(clientId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(agencyId?: string): Promise<Invoice[]> {
    if (agencyId) {
      // Join with clients to filter by agencyId
      const results = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          totalAmount: invoices.totalAmount,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          pdfUrl: invoices.pdfUrl,
          clientId: invoices.clientId,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(invoices.createdAt));
      return results;
    }
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values(invoice).returning();
    return result[0];
  }

  async updateInvoiceStatus(invoiceId: string, status: string): Promise<Invoice> {
    const result = await db.update(invoices)
      .set({ status })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return result[0];
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const result = await db.update(invoices)
      .set(data)
      .where(eq(invoices.id, id))
      .returning();
    return result[0];
  }

  // Invoice Line Items
  async getInvoiceLineItemsByInvoiceId(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const result = await db.insert(invoiceLineItems).values(lineItem).returning();
    return result[0];
  }

  async createInvoiceLineItems(lineItems: InsertInvoiceLineItem[]): Promise<InvoiceLineItem[]> {
    if (lineItems.length === 0) return [];
    const result = await db.insert(invoiceLineItems).values(lineItems).returning();
    return result;
  }

  async deleteInvoiceLineItem(id: string): Promise<void> {
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id));
  }

  // Initiatives
  async getInitiativeById(id: string): Promise<Initiative | undefined> {
    const result = await db.select().from(initiatives).where(eq(initiatives.id, id)).limit(1);
    return result[0];
  }

  async getInitiativesByClientId(clientId: string): Promise<Initiative[]> {
    return await db.select().from(initiatives)
      .where(and(
        eq(initiatives.clientId, clientId),
        sql`${initiatives.deletedAt} IS NULL`
      ))
      .orderBy(desc(initiatives.createdAt));
  }

  async getAllInitiatives(agencyId?: string): Promise<Initiative[]> {
    if (agencyId) {
      // Join with clients to filter by agencyId
      const results = await db
        .select({
          id: initiatives.id,
          title: initiatives.title,
          observation: initiatives.observation,
          observationInsights: initiatives.observationInsights,
          proposedAction: initiatives.proposedAction,
          actionTasks: initiatives.actionTasks,
          status: initiatives.status,
          cost: initiatives.cost,
          estimatedHours: initiatives.estimatedHours,
          billingType: initiatives.billingType,
          impact: initiatives.impact,
          clientId: initiatives.clientId,
          objectiveId: initiatives.objectiveId,
          sentToClient: initiatives.sentToClient,
          clientResponse: initiatives.clientResponse,
          clientFeedback: initiatives.clientFeedback,
          responseViewedByAdmin: initiatives.responseViewedByAdmin,
          triggerMetric: initiatives.triggerMetric,
          baselineValue: initiatives.baselineValue,
          startDate: initiatives.startDate,
          implementationDate: initiatives.implementationDate,
          measuredImprovement: initiatives.measuredImprovement,
          lastEditedAt: initiatives.lastEditedAt,
          deletedAt: initiatives.deletedAt,
          createdAt: initiatives.createdAt,
        })
        .from(initiatives)
        .innerJoin(clients, eq(initiatives.clientId, clients.id))
        .where(and(
          sql`${initiatives.deletedAt} IS NULL`,
          eq(clients.agencyId, agencyId)
        ))
        .orderBy(desc(initiatives.createdAt));
      return results;
    }
    return await db.select().from(initiatives)
      .where(sql`${initiatives.deletedAt} IS NULL`)
      .orderBy(desc(initiatives.createdAt));
  }

  async createInitiative(rec: InsertInitiative): Promise<Initiative> {
    const result = await db.insert(initiatives).values(rec as any).returning();
    return result[0];
  }

  async updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative> {
    const result = await db
      .update(initiatives)
      .set({ ...updates, lastEditedAt: new Date() } as any)
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  }

  async sendInitiativeToClient(id: string): Promise<Initiative> {
    const result = await db
      .update(initiatives)
      .set({ 
        sentToClient: "true", 
        status: "Awaiting Approval", 
        clientResponse: "pending",
        lastEditedAt: new Date() 
      })
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  }

  async updateInitiativeClientResponse(id: string, response: string, feedback?: string): Promise<Initiative> {
    const statusMap: Record<string, string> = {
      "approved": "Approved",
      "rejected": "Rejected",
      "discussing": "Discussing"
    };
    
    const result = await db
      .update(initiatives)
      .set({ 
        clientResponse: response,
        clientFeedback: feedback || null,
        status: statusMap[response] || "Awaiting Approval",
        responseViewedByAdmin: "false", // Reset so admin gets notified
        lastEditedAt: new Date()
      })
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  }

  async getDeletedInitiatives(): Promise<Initiative[]> {
    return await db.select().from(initiatives)
      .where(sql`${initiatives.deletedAt} IS NOT NULL`)
      .orderBy(desc(initiatives.deletedAt));
  }

  async softDeleteInitiative(id: string): Promise<Initiative> {
    const result = await db
      .update(initiatives)
      .set({ deletedAt: new Date() })
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  }

  async restoreInitiative(id: string): Promise<Initiative> {
    const result = await db
      .update(initiatives)
      .set({ deletedAt: null })
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  }

  async permanentlyDeleteInitiative(id: string): Promise<void> {
    await db.delete(initiatives).where(eq(initiatives.id, id));
  }

  // Daily Metrics
  async getMetricsByClientId(clientId: string, limit: number = 365): Promise<DailyMetric[]> {
    return await db.select().from(dailyMetrics)
      .where(eq(dailyMetrics.clientId, clientId))
      .orderBy(desc(dailyMetrics.date))
      .limit(limit);
  }

  async getAllMetrics(limit: number = 365, agencyId?: string): Promise<DailyMetric[]> {
    if (agencyId) {
      // Join with clients to filter by agencyId
      const results = await db
        .select({
          id: dailyMetrics.id,
          date: dailyMetrics.date,
          clientId: dailyMetrics.clientId,
          source: dailyMetrics.source,
          sessions: dailyMetrics.sessions,
          conversions: dailyMetrics.conversions,
          impressions: dailyMetrics.impressions,
          clicks: dailyMetrics.clicks,
          spend: dailyMetrics.spend,
          organicImpressions: dailyMetrics.organicImpressions,
          organicClicks: dailyMetrics.organicClicks,
          avgPosition: dailyMetrics.avgPosition,
          createdAt: dailyMetrics.createdAt,
        })
        .from(dailyMetrics)
        .innerJoin(clients, eq(dailyMetrics.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(dailyMetrics.date))
        .limit(limit);
      return results;
    }
    return await db.select().from(dailyMetrics)
      .orderBy(desc(dailyMetrics.date))
      .limit(limit);
  }

  async createMetric(metric: InsertDailyMetric): Promise<DailyMetric> {
    const result = await db.insert(dailyMetrics).values(metric).returning();
    return result[0];
  }

  async deleteMetricsByClientIdAndDateRange(clientId: string, startDate: string, endDate: string): Promise<void> {
    await db.delete(dailyMetrics)
      .where(and(
        eq(dailyMetrics.clientId, clientId),
        gte(dailyMetrics.date, startDate),
        lte(dailyMetrics.date, endDate)
      ));
  }

  // Client Integrations
  async getIntegrationByClientId(clientId: string, serviceName: string): Promise<ClientIntegration | undefined> {
    const result = await db.select().from(clientIntegrations)
      .where(and(
        eq(clientIntegrations.clientId, clientId),
        eq(clientIntegrations.serviceName, serviceName)
      ))
      .limit(1);
    
    console.error('[Storage] getIntegrationByClientId:', { 
      clientId, 
      serviceName, 
      found: !!result[0],
      gscSiteUrl: result[0]?.gscSiteUrl,
      hasAccessToken: !!result[0]?.accessToken
    });
    
    // Decrypt tokens before returning
    if (result[0] && result[0].accessToken) {
      const integration = result[0];
      if (integration.accessToken && integration.accessTokenIv && integration.accessTokenAuthTag) {
        integration.accessToken = decryptToken(
          integration.accessToken,
          integration.accessTokenIv,
          integration.accessTokenAuthTag
        );
      }
      if (integration.refreshToken && integration.refreshTokenIv && integration.refreshTokenAuthTag) {
        integration.refreshToken = decryptToken(
          integration.refreshToken,
          integration.refreshTokenIv,
          integration.refreshTokenAuthTag
        );
      }
    }
    
    return result[0];
  }

  async getAllIntegrationsByClientId(clientId: string): Promise<ClientIntegration[]> {
    const results = await db.select().from(clientIntegrations)
      .where(eq(clientIntegrations.clientId, clientId))
      .orderBy(desc(clientIntegrations.createdAt));
    
    // Decrypt tokens before returning
    return results.map(integration => {
      if (integration.accessToken && integration.accessTokenIv && integration.accessTokenAuthTag) {
        integration.accessToken = decryptToken(
          integration.accessToken,
          integration.accessTokenIv,
          integration.accessTokenAuthTag
        );
      }
      if (integration.refreshToken && integration.refreshTokenIv && integration.refreshTokenAuthTag) {
        integration.refreshToken = decryptToken(
          integration.refreshToken,
          integration.refreshTokenIv,
          integration.refreshTokenAuthTag
        );
      }
      return integration;
    });
  }

  async getAllIntegrations(agencyId?: string): Promise<ClientIntegration[]> {
    if (agencyId) {
      // Join with clients to filter by agency
      const results = await db
        .select({
          id: clientIntegrations.id,
          clientId: clientIntegrations.clientId,
          serviceName: clientIntegrations.serviceName,
          accessToken: clientIntegrations.accessToken,
          refreshToken: clientIntegrations.refreshToken,
          accessTokenIv: clientIntegrations.accessTokenIv,
          refreshTokenIv: clientIntegrations.refreshTokenIv,
          accessTokenAuthTag: clientIntegrations.accessTokenAuthTag,
          refreshTokenAuthTag: clientIntegrations.refreshTokenAuthTag,
          expiresAt: clientIntegrations.expiresAt,
          ga4PropertyId: clientIntegrations.ga4PropertyId,
          ga4LeadEventName: clientIntegrations.ga4LeadEventName,
          gscSiteUrl: clientIntegrations.gscSiteUrl,
          createdAt: clientIntegrations.createdAt,
          updatedAt: clientIntegrations.updatedAt,
        })
        .from(clientIntegrations)
        .innerJoin(clients, eq(clientIntegrations.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(clientIntegrations.createdAt));
      
      // Note: We don't decrypt tokens for the admin list view for security
      // Remove sensitive fields
      return results.map(({ accessToken, refreshToken, accessTokenIv, refreshTokenIv, accessTokenAuthTag, refreshTokenAuthTag, ...integration }) => ({
        ...integration,
        accessToken: null,
        refreshToken: null,
        accessTokenIv: null,
        refreshTokenIv: null,
        accessTokenAuthTag: null,
        refreshTokenAuthTag: null,
      }));
    }
    
    const results = await db.select().from(clientIntegrations)
      .orderBy(desc(clientIntegrations.createdAt));
    
    // Note: We don't decrypt tokens for the admin list view for security
    // Remove sensitive fields
    return results.map(({ accessToken, refreshToken, accessTokenIv, refreshTokenIv, accessTokenAuthTag, refreshTokenAuthTag, ...integration }) => ({
      ...integration,
      accessToken: null,
      refreshToken: null,
      accessTokenIv: null,
      refreshTokenIv: null,
      accessTokenAuthTag: null,
      refreshTokenAuthTag: null,
    }));
  }

  async createIntegration(integration: InsertClientIntegration): Promise<ClientIntegration> {
    // Encrypt tokens before storage
    let encryptedData: any = { ...integration };
    
    if (integration.accessToken) {
      const encrypted = encryptToken(integration.accessToken);
      encryptedData.accessToken = encrypted.encrypted;
      encryptedData.accessTokenIv = encrypted.iv;
      encryptedData.accessTokenAuthTag = encrypted.authTag;
    }
    
    if (integration.refreshToken) {
      const encrypted = encryptToken(integration.refreshToken);
      encryptedData.refreshToken = encrypted.encrypted;
      encryptedData.refreshTokenIv = encrypted.iv;
      encryptedData.refreshTokenAuthTag = encrypted.authTag;
    }
    
    const result = await db.insert(clientIntegrations).values(encryptedData).returning();
    
    // Return with decrypted tokens
    const created = result[0];
    if (created.accessToken && created.accessTokenIv && created.accessTokenAuthTag) {
      created.accessToken = decryptToken(created.accessToken, created.accessTokenIv, created.accessTokenAuthTag);
    }
    if (created.refreshToken && created.refreshTokenIv && created.refreshTokenAuthTag) {
      created.refreshToken = decryptToken(created.refreshToken, created.refreshTokenIv, created.refreshTokenAuthTag);
    }
    
    return created;
  }

  async updateIntegration(id: string, data: Partial<ClientIntegration>): Promise<ClientIntegration> {
    // Encrypt tokens before storage if provided
    let encryptedData: any = { ...data };
    
    if (data.accessToken) {
      const encrypted = encryptToken(data.accessToken);
      encryptedData.accessToken = encrypted.encrypted;
      encryptedData.accessTokenIv = encrypted.iv;
      encryptedData.accessTokenAuthTag = encrypted.authTag;
    }
    
    if (data.refreshToken) {
      const encrypted = encryptToken(data.refreshToken);
      encryptedData.refreshToken = encrypted.encrypted;
      encryptedData.refreshTokenIv = encrypted.iv;
      encryptedData.refreshTokenAuthTag = encrypted.authTag;
    }
    
    const result = await db.update(clientIntegrations)
      .set({ ...encryptedData, updatedAt: new Date() })
      .where(eq(clientIntegrations.id, id))
      .returning();
    
    // Return with decrypted tokens
    const updated = result[0];
    if (updated.accessToken && updated.accessTokenIv && updated.accessTokenAuthTag) {
      updated.accessToken = decryptToken(updated.accessToken, updated.accessTokenIv, updated.accessTokenAuthTag);
    }
    if (updated.refreshToken && updated.refreshTokenIv && updated.refreshTokenAuthTag) {
      updated.refreshToken = decryptToken(updated.refreshToken, updated.refreshTokenIv, updated.refreshTokenAuthTag);
    }
    
    return updated;
  }

  async deleteIntegration(id: string): Promise<void> {
    await db.delete(clientIntegrations).where(eq(clientIntegrations.id, id));
  }

  // Agency Integrations
  async getAgencyIntegration(agencyId: string, serviceName: string): Promise<AgencyIntegration | undefined> {
    const result = await db.select().from(agencyIntegrations)
      .where(and(
        eq(agencyIntegrations.agencyId, agencyId),
        eq(agencyIntegrations.serviceName, serviceName)
      ))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    const integration = result[0];
    
    // Decrypt credentials if they exist
    if (integration.dataForSeoLogin && integration.dataForSeoLoginIv && integration.dataForSeoLoginAuthTag) {
      integration.dataForSeoLogin = decryptToken(
        integration.dataForSeoLogin,
        integration.dataForSeoLoginIv,
        integration.dataForSeoLoginAuthTag
      );
    }
    
    if (integration.dataForSeoPassword && integration.dataForSeoPasswordIv && integration.dataForSeoPasswordAuthTag) {
      integration.dataForSeoPassword = decryptToken(
        integration.dataForSeoPassword,
        integration.dataForSeoPasswordIv,
        integration.dataForSeoPasswordAuthTag
      );
    }
    
    return integration;
  }

  async createAgencyIntegration(integration: InsertAgencyIntegration): Promise<AgencyIntegration> {
    let encryptedData: any = { ...integration };
    
    // Encrypt Data for SEO credentials if provided
    if (integration.dataForSeoLogin) {
      const encrypted = encryptToken(integration.dataForSeoLogin);
      encryptedData.dataForSeoLogin = encrypted.encrypted;
      encryptedData.dataForSeoLoginIv = encrypted.iv;
      encryptedData.dataForSeoLoginAuthTag = encrypted.authTag;
    }
    
    if (integration.dataForSeoPassword) {
      const encrypted = encryptToken(integration.dataForSeoPassword);
      encryptedData.dataForSeoPassword = encrypted.encrypted;
      encryptedData.dataForSeoPasswordIv = encrypted.iv;
      encryptedData.dataForSeoPasswordAuthTag = encrypted.authTag;
    }
    
    const result = await db.insert(agencyIntegrations).values(encryptedData).returning();
    const created = result[0];
    
    // Return with decrypted credentials
    if (created.dataForSeoLogin && created.dataForSeoLoginIv && created.dataForSeoLoginAuthTag) {
      created.dataForSeoLogin = decryptToken(
        created.dataForSeoLogin,
        created.dataForSeoLoginIv,
        created.dataForSeoLoginAuthTag
      );
    }
    
    if (created.dataForSeoPassword && created.dataForSeoPasswordIv && created.dataForSeoPasswordAuthTag) {
      created.dataForSeoPassword = decryptToken(
        created.dataForSeoPassword,
        created.dataForSeoPasswordIv,
        created.dataForSeoPasswordAuthTag
      );
    }
    
    return created;
  }

  async updateAgencyIntegration(id: string, data: Partial<AgencyIntegration>): Promise<AgencyIntegration> {
    let encryptedData: any = { ...data };
    
    // Encrypt Data for SEO credentials if provided
    if (data.dataForSeoLogin) {
      const encrypted = encryptToken(data.dataForSeoLogin);
      encryptedData.dataForSeoLogin = encrypted.encrypted;
      encryptedData.dataForSeoLoginIv = encrypted.iv;
      encryptedData.dataForSeoLoginAuthTag = encrypted.authTag;
    }
    
    if (data.dataForSeoPassword) {
      const encrypted = encryptToken(data.dataForSeoPassword);
      encryptedData.dataForSeoPassword = encrypted.encrypted;
      encryptedData.dataForSeoPasswordIv = encrypted.iv;
      encryptedData.dataForSeoPasswordAuthTag = encrypted.authTag;
    }
    
    const result = await db.update(agencyIntegrations)
      .set({ ...encryptedData, updatedAt: new Date() })
      .where(eq(agencyIntegrations.id, id))
      .returning();
    
    const updated = result[0];
    
    // Return with decrypted credentials
    if (updated.dataForSeoLogin && updated.dataForSeoLoginIv && updated.dataForSeoLoginAuthTag) {
      updated.dataForSeoLogin = decryptToken(
        updated.dataForSeoLogin,
        updated.dataForSeoLoginIv,
        updated.dataForSeoLoginAuthTag
      );
    }
    
    if (updated.dataForSeoPassword && updated.dataForSeoPasswordIv && updated.dataForSeoPasswordAuthTag) {
      updated.dataForSeoPassword = decryptToken(
        updated.dataForSeoPassword,
        updated.dataForSeoPasswordIv,
        updated.dataForSeoPasswordAuthTag
      );
    }
    
    return updated;
  }

  async getClientAccessList(agencyIntegrationId: string): Promise<string[]> {
    const results = await db.select({ clientId: agencyIntegrationClientAccess.clientId })
      .from(agencyIntegrationClientAccess)
      .where(eq(agencyIntegrationClientAccess.agencyIntegrationId, agencyIntegrationId));
    
    return results.map(r => r.clientId);
  }

  async setClientAccess(agencyIntegrationId: string, clientIds: string[]): Promise<void> {
    // Delete existing access entries
    await db.delete(agencyIntegrationClientAccess)
      .where(eq(agencyIntegrationClientAccess.agencyIntegrationId, agencyIntegrationId));
    
    // Insert new access entries
    if (clientIds.length > 0) {
      await db.insert(agencyIntegrationClientAccess)
        .values(clientIds.map(clientId => ({
          agencyIntegrationId,
          clientId,
        })));
    }
  }

  async hasClientAccess(agencyIntegrationId: string, clientId: string): Promise<boolean> {
    const result = await db.select()
      .from(agencyIntegrationClientAccess)
      .where(and(
        eq(agencyIntegrationClientAccess.agencyIntegrationId, agencyIntegrationId),
        eq(agencyIntegrationClientAccess.clientId, clientId)
      ))
      .limit(1);
    
    return result.length > 0;
  }

  // Client Objectives
  async getObjectivesByClientId(clientId: string): Promise<ClientObjective[]> {
    return await db.select().from(clientObjectives)
      .where(eq(clientObjectives.clientId, clientId))
      .orderBy(desc(clientObjectives.createdAt));
  }

  async getActiveObjectivesByClientId(clientId: string): Promise<ClientObjective[]> {
    return await db.select().from(clientObjectives)
      .where(and(
        eq(clientObjectives.clientId, clientId),
        eq(clientObjectives.isActive, "true")
      ))
      .orderBy(desc(clientObjectives.createdAt));
  }

  async createObjective(objective: InsertClientObjective): Promise<ClientObjective> {
    const result = await db.insert(clientObjectives).values(objective).returning();
    return result[0];
  }

  async updateObjective(id: string, data: Partial<ClientObjective>): Promise<ClientObjective> {
    const result = await db.update(clientObjectives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientObjectives.id, id))
      .returning();
    return result[0];
  }

  async deleteObjective(id: string): Promise<void> {
    await db.delete(clientObjectives).where(eq(clientObjectives.id, id));
  }

  // Client Messages
  async getMessagesByClientId(clientId: string): Promise<ClientMessage[]> {
    return await db.select().from(clientMessages)
      .where(eq(clientMessages.clientId, clientId))
      .orderBy(clientMessages.createdAt);
  }

  async createMessage(message: InsertClientMessage): Promise<ClientMessage> {
    const result = await db.insert(clientMessages).values(message).returning();
    return result[0];
  }

  async getAllMessages(agencyId?: string): Promise<ClientMessage[]> {
    if (agencyId) {
      // Join with clients to filter by agencyId
      const results = await db
        .select({
          id: clientMessages.id,
          clientId: clientMessages.clientId,
          message: clientMessages.message,
          senderRole: clientMessages.senderRole,
          isRead: clientMessages.isRead,
          createdAt: clientMessages.createdAt,
        })
        .from(clientMessages)
        .innerJoin(clients, eq(clientMessages.clientId, clients.id))
        .where(eq(clients.agencyId, agencyId))
        .orderBy(desc(clientMessages.createdAt));
      return results;
    }
    return await db.select().from(clientMessages)
      .orderBy(desc(clientMessages.createdAt));
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.update(clientMessages)
      .set({ isRead: "true" })
      .where(eq(clientMessages.id, id));
  }

  // Notifications
  async getNotificationCounts(agencyId?: string): Promise<{ unreadMessages: number; unviewedResponses: number }> {
    if (agencyId) {
      // Count unread messages from clients in this agency
      const unreadMessagesResult = await db
        .select({ id: clientMessages.id })
        .from(clientMessages)
        .innerJoin(clients, eq(clientMessages.clientId, clients.id))
        .where(and(
          eq(clientMessages.senderRole, "Client"),
          eq(clientMessages.isRead, "false"),
          eq(clients.agencyId, agencyId)
        ));
      
      // Count initiatives with client responses not yet viewed by admin in this agency
      const unviewedResponsesResult = await db
        .select({ id: initiatives.id, clientResponse: initiatives.clientResponse })
        .from(initiatives)
        .innerJoin(clients, eq(initiatives.clientId, clients.id))
        .where(and(
          eq(initiatives.sentToClient, "true"),
          eq(initiatives.responseViewedByAdmin, "false"),
          eq(clients.agencyId, agencyId)
        ));
      
      const unviewedResponses = unviewedResponsesResult.filter(
        rec => rec.clientResponse && rec.clientResponse !== "pending"
      );
      
      return {
        unreadMessages: unreadMessagesResult.length,
        unviewedResponses: unviewedResponses.length
      };
    }
    
    // Original implementation without agency filtering (for backward compatibility)
    const unreadMessagesResult = await db.select().from(clientMessages)
      .where(and(
        eq(clientMessages.senderRole, "Client"),
        eq(clientMessages.isRead, "false")
      ));
    
    const unviewedResponsesResult = await db.select().from(initiatives)
      .where(and(
        eq(initiatives.sentToClient, "true"),
        eq(initiatives.responseViewedByAdmin, "false")
      ));
    
    // Only count those where clientResponse is NOT 'pending' (meaning client has responded)
    const unviewedResponses = unviewedResponsesResult.filter(
      rec => rec.clientResponse && rec.clientResponse !== "pending"
    );
    
    return {
      unreadMessages: unreadMessagesResult.length,
      unviewedResponses: unviewedResponses.length
    };
  }

  async markInitiativeResponsesViewed(): Promise<void> {
    await db.update(initiatives)
      .set({ responseViewedByAdmin: "true" })
      .where(and(
        eq(initiatives.sentToClient, "true"),
        eq(initiatives.responseViewedByAdmin, "false")
      ));
  }

  async getClientNotificationCounts(clientId: string): Promise<{ unreadMessages: number; newRecommendations: number }> {
    // Count unread messages from Admin
    const unreadMessagesResult = await db.select().from(clientMessages)
      .where(and(
        eq(clientMessages.clientId, clientId),
        eq(clientMessages.senderRole, "Admin"),
        eq(clientMessages.isRead, "false")
      ));
    
    // Count new initiatives sent to client with status 'Awaiting Approval' (not yet acted upon)
    const newInitiativesResult = await db.select().from(initiatives)
      .where(and(
        eq(initiatives.clientId, clientId),
        eq(initiatives.sentToClient, "true"),
        eq(initiatives.status, "Awaiting Approval")
      ));
    
    return {
      unreadMessages: unreadMessagesResult.length,
      newRecommendations: newInitiativesResult.length
    };
  }

  async getStaffNotificationCounts(staffProfileId: string): Promise<{ newTasks: number; highPriorityTasks: number }> {
    // Get all tasks assigned to this staff member
    const assignments = await db.select().from(staffAssignments)
      .where(eq(staffAssignments.staffProfileId, staffProfileId));
    
    const taskIds = assignments.map(a => a.taskId);
    
    if (taskIds.length === 0) {
      return { newTasks: 0, highPriorityTasks: 0 };
    }
    
    // Count new tasks (status = 'Pending')
    const allTasks = await db.select().from(tasks);
    const assignedTasks = allTasks.filter(t => taskIds.includes(t.id));
    
    const newTasks = assignedTasks.filter(t => t.status === "Pending");
    const highPriorityTasks = assignedTasks.filter(t => 
      t.priority === "High" && (t.status === "Pending" || t.status === "In Progress")
    );
    
    return {
      newTasks: newTasks.length,
      highPriorityTasks: highPriorityTasks.length
    };
  }

  // Notification Center Implementation
  async getNotificationsByUserId(userId: string, isArchived: boolean = false): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isArchived, isArchived ? "true" : "false")
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: "true" })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ));
  }

  async archiveNotification(id: string, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isArchived: "true" })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: "true" })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, "false")
      ));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, "false"),
        eq(notifications.isArchived, "false")
      ));
    return result.length;
  }
}

export const storage = new DbStorage();
