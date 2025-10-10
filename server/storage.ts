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
  type Recommendation,
  type InsertRecommendation,
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
  recommendations,
  dailyMetrics,
  clientIntegrations,
  clientObjectives,
  clientMessages,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encryptToken, decryptToken } from "./lib/encryption";

export interface IStorage {
  // Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Profiles
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  
  // Clients
  getClientById(id: string): Promise<Client | undefined>;
  getClientByProfileId(profileId: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  
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
  
  // Recommendations
  getRecommendationById(id: string): Promise<Recommendation | undefined>;
  getRecommendationsByClientId(clientId: string): Promise<Recommendation[]>;
  getAllRecommendations(): Promise<Recommendation[]>;
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  
  // Daily Metrics
  getMetricsByClientId(clientId: string, limit?: number): Promise<DailyMetric[]>;
  getAllMetrics(limit?: number): Promise<DailyMetric[]>;
  createMetric(metric: InsertDailyMetric): Promise<DailyMetric>;
  
  // Client Integrations
  getIntegrationByClientId(clientId: string, serviceName: string): Promise<ClientIntegration | undefined>;
  getAllIntegrationsByClientId(clientId: string): Promise<ClientIntegration[]>;
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

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
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

  // Recommendations
  async getRecommendationById(id: string): Promise<Recommendation | undefined> {
    const result = await db.select().from(recommendations).where(eq(recommendations.id, id)).limit(1);
    return result[0];
  }

  async getRecommendationsByClientId(clientId: string): Promise<Recommendation[]> {
    return await db.select().from(recommendations).where(eq(recommendations.clientId, clientId)).orderBy(desc(recommendations.createdAt));
  }

  async getAllRecommendations(): Promise<Recommendation[]> {
    return await db.select().from(recommendations).orderBy(desc(recommendations.createdAt));
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const result = await db.insert(recommendations).values(rec).returning();
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
}

export const storage = new DbStorage();
