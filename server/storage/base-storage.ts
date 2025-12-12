import type { 
  User, InsertUser,
  Profile, InsertProfile,
  Client, InsertClient,
  Project, InsertProject,
  TaskList, InsertTaskList,
  Task, InsertTask,
  Invoice, InsertInvoice,
  InvoiceLineItem, InsertInvoiceLineItem,
  Initiative,
  DailyMetrics,
  Company, Contact, Deal,
  Form, FormField,
  WorkflowRule, WorkflowRuleVersion, WorkflowRuleCondition, WorkflowRuleAction,
  WorkflowSignal, WorkflowSignalRoute,
  KnowledgeDocument, KnowledgeCategory
} from '@shared/schema';

export interface IUserStorage {
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsersWithProfiles(agencyId?: string): Promise<Array<User & { profile: Profile | null; client?: Client | null }>>;
  updateUserRole(userId: string, role: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export interface IProfileStorage {
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  getStaffProfileById(id: string): Promise<Profile | undefined>;
  getAllStaff(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateUserProfile(userId: string, data: { fullName?: string; skills?: string[] }): Promise<Profile | undefined>;
}

export interface IClientStorage {
  getClientById(id: string): Promise<Client | undefined>;
  getClientByProfileId(profileId: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  getAllClientsWithDetails(agencyId?: string): Promise<Array<Client & { 
    primaryContact: string | null; 
    activeProjectsCount: number;
    overdueInvoicesCount: number;
    hasGA4: boolean;
    hasGSC: boolean;
  }>>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<Client>): Promise<Client>;
  deductRetainerHours(clientId: string, hours: number): Promise<Client>;
  resetRetainerHours(clientId: string, hours: number): Promise<Client>;
}

export interface IProjectStorage {
  getProjectById(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByClientId(clientId: string): Promise<Project[]>;
  getProjectsByAgencyId(agencyId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
}

export interface ITaskStorage {
  getTaskListsByProjectId(projectId: string, agencyId?: string): Promise<TaskList[]>;
  createTaskList(data: InsertTaskList, agencyId?: string): Promise<TaskList>;
  updateTaskList(id: string, data: Partial<TaskList>, agencyId?: string): Promise<TaskList>;
  deleteTaskList(id: string, agencyId?: string): Promise<void>;
  
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByListId(listId: string): Promise<Task[]>;
  getSubtasks(parentTaskId: string): Promise<Task[]>;
  getTaskActivities(taskId: string): Promise<any[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<Task>, agencyId?: string): Promise<Task>;
  deleteTask(id: string, agencyId?: string): Promise<void>;
  
  assignStaff(taskId: string, staffProfileId: string, agencyId?: string): Promise<void>;
  unassignStaff(taskId: string, staffProfileId: string, agencyId?: string): Promise<void>;
  getStaffAssignments(agencyId?: string): Promise<any[]>;
}

export interface IInvoiceStorage {
  getInvoiceById(id: string): Promise<Invoice | undefined>;
  getInvoicesByClientId(clientId: string): Promise<Invoice[]>;
  getInvoicesByAgencyId(agencyId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice>;
  
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
}

export interface ICRMStorage {
  getCompaniesByAgencyId(agencyId: string): Promise<Company[]>;
  createCompany(company: any): Promise<Company>;
  updateCompany(id: string, data: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  getContactsByAgencyId(agencyId: string): Promise<Contact[]>;
  createContact(contact: any): Promise<Contact>;
  updateContact(id: string, data: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  
  getDealsByAgencyId(agencyId: string): Promise<Deal[]>;
  createDeal(deal: any): Promise<Deal>;
  updateDeal(id: string, data: Partial<Deal>): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;
}

export interface IWorkflowStorage {
  getWorkflowRuleById(id: string): Promise<WorkflowRule | undefined>;
  getWorkflowRulesByAgencyId(agencyId: string): Promise<WorkflowRule[]>;
  createWorkflowRule(rule: any): Promise<WorkflowRule>;
  updateWorkflowRule(id: string, data: Partial<WorkflowRule>): Promise<WorkflowRule>;
  deleteWorkflowRule(id: string): Promise<void>;
  
  getWorkflowSignalsByAgencyId(agencyId: string): Promise<WorkflowSignal[]>;
  createWorkflowSignal(signal: any): Promise<WorkflowSignal>;
  
  getWorkflowSignalRoutesByAgencyId(agencyId: string): Promise<WorkflowSignalRoute[]>;
  createWorkflowSignalRoute(route: any): Promise<WorkflowSignalRoute>;
}

export interface IKnowledgeStorage {
  getKnowledgeCategories(): Promise<KnowledgeCategory[]>;
  createKnowledgeCategory(category: any): Promise<KnowledgeCategory>;
  
  getKnowledgeDocumentsByClientId(clientId: string): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(doc: any): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: string, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument>;
  deleteKnowledgeDocument(id: string): Promise<void>;
}

export interface IStorage extends 
  IUserStorage, 
  IProfileStorage, 
  IClientStorage, 
  IProjectStorage, 
  ITaskStorage, 
  IInvoiceStorage,
  ICRMStorage,
  IWorkflowStorage,
  IKnowledgeStorage {
  getDefaultAgency(): Promise<any>;
  getAgencyById(id: string): Promise<any>;
  getAgencyByClientId(clientId: string): Promise<any>;
}
