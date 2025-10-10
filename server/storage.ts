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
  users,
  profiles,
  clients,
  projects,
  tasks,
  staffAssignments,
  invoices,
  recommendations,
  dailyMetrics,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
}

export const storage = new DbStorage();
