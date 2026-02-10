import type {
  Task,
  InsertTask,
  TaskList,
  InsertTaskList,
  StaffAssignment,
  InsertStaffAssignment,
  TaskActivity,
  InsertTaskActivity,
  TaskRelationship,
  InsertTaskRelationship,
  TaskMessage,
  InsertTaskMessage,
  Project,
  Profile,
} from "@shared/schema";

/**
 * Complex return type: TaskActivity with joined user profile
 */
export type TaskActivityWithUser = TaskActivity & { user: Profile };

/**
 * Complex return type: TaskRelationship with joined related task
 */
export type TaskRelationshipWithTask = TaskRelationship & { relatedTask: Task };

/**
 * Complex return type: TaskMessage with joined sender profile
 */
export type TaskMessageWithSender = Omit<TaskMessage, 'sender'> & { sender?: Profile };

/**
 * Complex return type: Task with staff assignments and profiles
 */
export type TaskWithAssignments = Task & { 
  assignments: Array<StaffAssignment & { staffProfile: Profile }> 
};

/**
 * Task Domain Storage Interface
 * 
 * Handles all task-related CRUD operations including:
 * - Task lists (grouped containers for tasks)
 * - Tasks (individual work items)
 * - Staff assignments (who is assigned to tasks)
 * - Task activities (audit log of task changes)
 * - Task relationships (dependencies between tasks)
 * - Task messages (communication on tasks)
 * 
 * Multi-tenant isolation is enforced via agencyId parameters where applicable.
 */
export interface TaskStorage {
  // Task Lists
  getTaskListById(id: string, agencyId?: string): Promise<TaskList | undefined>;
  getTaskListsByProjectId(projectId: string, agencyId?: string): Promise<TaskList[]>;
  createTaskList(taskList: InsertTaskList): Promise<TaskList>;
  updateTaskList(id: string, data: Partial<TaskList>, agencyId?: string): Promise<TaskList>;
  deleteTaskList(id: string, agencyId?: string): Promise<void>;

  // Tasks
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getTasksByListId(listId: string): Promise<Task[]>;
  getTasksByStaffId(staffProfileId: string): Promise<Task[]>;
  getSubtasksByParentId(parentId: string): Promise<TaskWithAssignments[]>;
  getAllTasks(agencyId?: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Staff Assignments
  createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment>;
  getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]>;
  getAllTaskAssignments(agencyId?: string): Promise<StaffAssignment[]>;
  deleteStaffAssignment(taskId: string, staffProfileId: string): Promise<void>;

  // Task Activities
  createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity>;
  getTaskActivities(taskId: string): Promise<TaskActivityWithUser[]>;

  // Task Relationships
  createTaskRelationship(relationship: InsertTaskRelationship): Promise<TaskRelationship>;
  getTaskRelationships(taskId: string): Promise<TaskRelationshipWithTask[]>;
  deleteTaskRelationship(id: string): Promise<void>;

  // Task Messages
  getTaskMessagesByTaskId(taskId: string): Promise<TaskMessageWithSender[]>;
  createTaskMessage(message: InsertTaskMessage): Promise<TaskMessage>;
  markTaskMessageAsRead(messageId: string): Promise<void>;

  // Project with Tasks (composite query)
  getProjectWithTasks(projectId: string): Promise<{
    project: Project;
    tasks: TaskWithAssignments[];
  } | undefined>;
}
