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
  type ClientObjective,
  type InsertClientObjective,
  type ClientMessage,
  type InsertClientMessage,
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
  clientObjectives,
  clientMessages,
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
  getAllUsersWithProfiles(): Promise<Array<User & { profile: Profile | null; client?: Client | null }>>;
  updateUserRole(userId: string, role: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  // Profiles
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  
  // Clients
  getClientById(id: string): Promise<Client | undefined>;
  getClientByProfileId(profileId: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  getAllClientsWithDetails(): Promise<Array<Client & { 
    primaryContact: string | null; 
    activeProjectsCount: number;
    overdueInvoicesCount: number;
    hasGA4: boolean;
    hasGSC: boolean;
  }>>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<Client>): Promise<Client>;
  
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
  
  // Staff Assignments
  createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment>;
  getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]>;
  
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
  createInitiative(rec: InsertInitiative): Promise<Initiative>;
  updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative>;
  sendInitiativeToClient(id: string): Promise<Initiative>;
  updateInitiativeClientResponse(id: string, response: string, feedback?: string): Promise<Initiative>;
  
  // Daily Metrics
  getMetricsByClientId(clientId: string, limit?: number): Promise<DailyMetric[]>;
  getAllMetrics(limit?: number): Promise<DailyMetric[]>;
  createMetric(metric: InsertDailyMetric): Promise<DailyMetric>;
  deleteMetricsByClientIdAndDateRange(clientId: string, startDate: string, endDate: string): Promise<void>;
  
  // Client Integrations
  getIntegrationByClientId(clientId: string, serviceName: string): Promise<ClientIntegration | undefined>;
  getAllIntegrationsByClientId(clientId: string): Promise<ClientIntegration[]>;
  getAllIntegrations(): Promise<ClientIntegration[]>;
  createIntegration(integration: InsertClientIntegration): Promise<ClientIntegration>;
  updateIntegration(id: string, data: Partial<ClientIntegration>): Promise<ClientIntegration>;
  deleteIntegration(id: string): Promise<void>;
  
  // Client Objectives
  getObjectivesByClientId(clientId: string): Promise<ClientObjective[]>;
  getActiveObjectivesByClientId(clientId: string): Promise<ClientObjective[]>;
  createObjective(objective: InsertClientObjective): Promise<ClientObjective>;
  updateObjective(id: string, data: Partial<ClientObjective>): Promise<ClientObjective>;
  deleteObjective(id: string): Promise<void>;
  
  // Client Messages
  getMessagesByClientId(clientId: string): Promise<ClientMessage[]>;
  createMessage(message: InsertClientMessage): Promise<ClientMessage>;
  getAllMessages(): Promise<ClientMessage[]>;
  markMessageAsRead(id: string): Promise<void>;
  
  // Notifications
  getNotificationCounts(): Promise<{ unreadMessages: number; unviewedResponses: number }>;
  markInitiativeResponsesViewed(): Promise<void>;
  getClientNotificationCounts(clientId: string): Promise<{ unreadMessages: number; newRecommendations: number }>;
  getStaffNotificationCounts(staffProfileId: string): Promise<{ newTasks: number; highPriorityTasks: number }>;
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

  async getAllUsersWithProfiles(): Promise<Array<User & { profile: Profile | null; client?: Client | null }>> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    
    const usersWithProfiles = await Promise.all(
      allUsers.map(async (user) => {
        const profile = await this.getProfileByUserId(user.id);
        let client = null;
        if (profile && profile.role === "Client") {
          client = await this.getClientByProfileId(profile.id);
        }
        return {
          ...user,
          profile: profile || null,
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
      .where(eq(profiles.userId, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete user will cascade to related records (profile, client, etc.) due to foreign key constraints
    await db.delete(users).where(eq(users.id, userId));
  }

  // Profiles
  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
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

  // Clients
  async getClientById(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async getClientByProfileId(profileId: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.profileId, profileId)).limit(1);
    return result[0];
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getAllClientsWithDetails(): Promise<Array<Client & { 
    primaryContact: string | null; 
    activeProjectsCount: number;
    overdueInvoicesCount: number;
    hasGA4: boolean;
    hasGSC: boolean;
  }>> {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
    
    // Fetch all related data in bulk to avoid N+1 queries
    const [allProfiles, allProjects, allInvoices, allIntegrations] = await Promise.all([
      db.select().from(profiles),
      db.select().from(projects),
      db.select().from(invoices),
      db.select().from(clientIntegrations),
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
      
      const hasGA4 = !!ga4Integration && ga4Integration.accessToken !== null;
      const hasGSC = !!gscIntegration && gscIntegration.accessToken !== null;
      
      return {
        ...client,
        primaryContact,
        activeProjectsCount,
        overdueInvoicesCount,
        hasGA4,
        hasGSC,
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

  // Projects
  async getProjectById(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getProjectsByClientId(clientId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.clientId, clientId)).orderBy(desc(projects.createdAt));
  }

  async getAllProjects(): Promise<Project[]> {
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

  async getAllTasks(): Promise<Task[]> {
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

  // Staff Assignments
  async createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment> {
    const result = await db.insert(staffAssignments).values(assignment).returning();
    return result[0];
  }

  async getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]> {
    return await db.select().from(staffAssignments).where(eq(staffAssignments.taskId, taskId));
  }

  // Invoices
  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return result[0];
  }

  async getInvoicesByClientId(clientId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
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
    return await db.select().from(initiatives).where(eq(initiatives.clientId, clientId)).orderBy(desc(initiatives.createdAt));
  }

  async getAllInitiatives(): Promise<Initiative[]> {
    return await db.select().from(initiatives).orderBy(desc(initiatives.createdAt));
  }

  async createInitiative(rec: InsertInitiative): Promise<Initiative> {
    const result = await db.insert(initiatives).values(rec).returning();
    return result[0];
  }

  async updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative> {
    const result = await db
      .update(initiatives)
      .set({ ...updates, lastEditedAt: new Date() })
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

  // Daily Metrics
  async getMetricsByClientId(clientId: string, limit: number = 365): Promise<DailyMetric[]> {
    return await db.select().from(dailyMetrics)
      .where(eq(dailyMetrics.clientId, clientId))
      .orderBy(desc(dailyMetrics.date))
      .limit(limit);
  }

  async getAllMetrics(limit: number = 365): Promise<DailyMetric[]> {
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

  async getAllIntegrations(): Promise<ClientIntegration[]> {
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

  async getAllMessages(): Promise<ClientMessage[]> {
    return await db.select().from(clientMessages)
      .orderBy(desc(clientMessages.createdAt));
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.update(clientMessages)
      .set({ isRead: "true" })
      .where(eq(clientMessages.id, id));
  }

  // Notifications
  async getNotificationCounts(): Promise<{ unreadMessages: number; unviewedResponses: number }> {
    // Count unread messages from clients
    const unreadMessagesResult = await db.select().from(clientMessages)
      .where(and(
        eq(clientMessages.senderRole, "Client"),
        eq(clientMessages.isRead, "false")
      ));
    
    // Count initiatives with client responses not yet viewed by admin
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
}

export const storage = new DbStorage();
