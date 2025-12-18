import type { DbCtx } from "../db/db";
import type { 
  TaskStorage, 
  TaskActivityWithUser, 
  TaskRelationshipWithTask, 
  TaskMessageWithSender,
  TaskWithAssignments 
} from "../contracts/task";
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
import { 
  tasks, 
  taskLists, 
  staffAssignments, 
  taskActivities, 
  taskRelationships, 
  taskMessages, 
  projects, 
  clients, 
  profiles 
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Task Domain Storage Module
 * 
 * Handles all task-related CRUD operations including task lists, tasks,
 * staff assignments, activities, relationships, and messages.
 * 
 * Multi-tenant isolation is enforced via agencyId parameters where applicable.
 * SuperAdmin access (agencyId undefined) bypasses tenant filtering.
 */
export function taskStorage(db: DbCtx, getProjectById: (id: string) => Promise<Project | undefined>): TaskStorage {
  return {
    // Task Lists
    async getTaskListById(id: string, agencyId?: string): Promise<TaskList | undefined> {
      if (agencyId) {
        const result = await db.select().from(taskLists)
          .where(and(eq(taskLists.id, id), eq(taskLists.agencyId, agencyId)))
          .limit(1);
        return result[0];
      }
      const result = await db.select().from(taskLists).where(eq(taskLists.id, id)).limit(1);
      return result[0];
    },

    async getTaskListsByProjectId(projectId: string, agencyId?: string): Promise<TaskList[]> {
      if (agencyId) {
        return await db.select().from(taskLists)
          .where(and(eq(taskLists.projectId, projectId), eq(taskLists.agencyId, agencyId)))
          .orderBy(desc(taskLists.createdAt));
      }
      return await db.select().from(taskLists)
        .where(eq(taskLists.projectId, projectId))
        .orderBy(desc(taskLists.createdAt));
    },

    async createTaskList(taskList: InsertTaskList): Promise<TaskList> {
      const result = await db.insert(taskLists).values(taskList).returning();
      return result[0];
    },

    async updateTaskList(id: string, data: Partial<TaskList>, agencyId?: string): Promise<TaskList> {
      const { id: _id, agencyId: _agencyId, projectId: _projectId, createdAt: _createdAt, updatedAt: _updatedAt, ...sanitizedData } = data as any;
      
      if (agencyId) {
        const result = await db.update(taskLists)
          .set(sanitizedData)
          .where(and(eq(taskLists.id, id), eq(taskLists.agencyId, agencyId)))
          .returning();
        
        if (!result || result.length === 0) {
          throw new Error(`Task list ${id} not found or access denied`);
        }
        
        return result[0];
      }
      
      const result = await db.update(taskLists)
        .set(sanitizedData)
        .where(eq(taskLists.id, id))
        .returning();
      
      if (!result || result.length === 0) {
        throw new Error(`Task list ${id} not found`);
      }
      
      return result[0];
    },

    async deleteTaskList(id: string, agencyId?: string): Promise<void> {
      if (agencyId) {
        const result = await db.delete(taskLists)
          .where(and(eq(taskLists.id, id), eq(taskLists.agencyId, agencyId)))
          .returning();
        
        if (!result || result.length === 0) {
          throw new Error(`Task list ${id} not found or access denied`);
        }
      } else {
        const result = await db.delete(taskLists)
          .where(eq(taskLists.id, id))
          .returning();
        
        if (!result || result.length === 0) {
          throw new Error(`Task list ${id} not found`);
        }
      }
    },

    // Tasks
    async getTaskById(id: string): Promise<Task | undefined> {
      const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
      return result[0];
    },

    async getTasksByProjectId(projectId: string): Promise<Task[]> {
      return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
    },

    async getTasksByListId(listId: string): Promise<Task[]> {
      return await db.select().from(tasks).where(eq(tasks.listId, listId)).orderBy(desc(tasks.createdAt));
    },

    async getTasksByStaffId(staffProfileId: string): Promise<Task[]> {
      const assignments = await db.select().from(staffAssignments).where(eq(staffAssignments.staffProfileId, staffProfileId));
      const taskIds = assignments.map(a => a.taskId);
      
      if (taskIds.length === 0) return [];
      
      return await db.select().from(tasks).where(eq(tasks.id, taskIds[0])).orderBy(desc(tasks.createdAt));
    },

    async getSubtasksByParentId(parentId: string): Promise<TaskWithAssignments[]> {
      const subtasks = await db.select().from(tasks).where(eq(tasks.parentId, parentId));
      
      const subtasksWithAssignments = await Promise.all(
        subtasks.map(async (subtask) => {
          const assignments = await db
            .select({
              id: staffAssignments.id,
              taskId: staffAssignments.taskId,
              staffProfileId: staffAssignments.staffProfileId,
              createdAt: staffAssignments.createdAt,
              staffProfile: profiles,
            })
            .from(staffAssignments)
            .leftJoin(profiles, eq(staffAssignments.staffProfileId, profiles.id))
            .where(eq(staffAssignments.taskId, subtask.id));

          return {
            ...subtask,
            assignments: assignments
              .filter((a) => a.staffProfile !== null)
              .map((a) => ({
                id: a.id,
                taskId: a.taskId,
                staffProfileId: a.staffProfileId,
                createdAt: a.createdAt,
                staffProfile: a.staffProfile as Profile,
              })),
          };
        })
      );

      return subtasksWithAssignments;
    },

    async getAllTasks(agencyId?: string): Promise<Task[]> {
      if (agencyId) {
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
            startDate: tasks.startDate,
            listId: tasks.listId,
            parentId: tasks.parentId,
            timeEstimate: tasks.timeEstimate,
            timeTracked: tasks.timeTracked,
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .innerJoin(clients, eq(projects.clientId, clients.id))
          .where(eq(clients.agencyId, agencyId))
          .orderBy(desc(tasks.createdAt));
        return results;
      }
      return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    },

    async createTask(task: InsertTask): Promise<Task> {
      const result = await db.insert(tasks).values(task).returning();
      return result[0];
    },

    async updateTask(id: string, data: Partial<Task>): Promise<Task> {
      const result = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
      return result[0];
    },

    async deleteTask(id: string): Promise<void> {
      await db.delete(staffAssignments).where(eq(staffAssignments.taskId, id));
      await db.delete(tasks).where(eq(tasks.id, id));
    },

    // Staff Assignments
    async createStaffAssignment(assignment: InsertStaffAssignment): Promise<StaffAssignment> {
      const result = await db.insert(staffAssignments).values(assignment).returning();
      return result[0];
    },

    async getAssignmentsByTaskId(taskId: string): Promise<StaffAssignment[]> {
      return await db.select().from(staffAssignments).where(eq(staffAssignments.taskId, taskId));
    },

    async getAllTaskAssignments(agencyId?: string): Promise<StaffAssignment[]> {
      if (agencyId) {
        const results = await db
          .select({
            id: staffAssignments.id,
            taskId: staffAssignments.taskId,
            staffProfileId: staffAssignments.staffProfileId,
            createdAt: staffAssignments.createdAt,
          })
          .from(staffAssignments)
          .innerJoin(tasks, eq(staffAssignments.taskId, tasks.id))
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .innerJoin(clients, eq(projects.clientId, clients.id))
          .where(eq(clients.agencyId, agencyId));
        return results;
      }
      return await db.select().from(staffAssignments);
    },

    async deleteStaffAssignment(taskId: string, staffProfileId: string): Promise<void> {
      await db.delete(staffAssignments)
        .where(
          and(
            eq(staffAssignments.taskId, taskId),
            eq(staffAssignments.staffProfileId, staffProfileId)
          )
        );
    },

    // Task Activities
    async createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity> {
      const result = await db.insert(taskActivities).values(activity).returning();
      return result[0];
    },

    async getTaskActivities(taskId: string): Promise<TaskActivityWithUser[]> {
      const activities = await db
        .select()
        .from(taskActivities)
        .leftJoin(profiles, eq(taskActivities.userId, profiles.id))
        .where(eq(taskActivities.taskId, taskId))
        .orderBy(desc(taskActivities.createdAt));

      return activities
        .filter(a => a.profiles !== null)
        .map(a => ({
          ...a.task_activities,
          user: a.profiles as Profile
        }));
    },

    // Task Relationships
    async createTaskRelationship(relationship: InsertTaskRelationship): Promise<TaskRelationship> {
      const result = await db.insert(taskRelationships).values(relationship).returning();
      return result[0];
    },

    async getTaskRelationships(taskId: string): Promise<TaskRelationshipWithTask[]> {
      const relationships = await db
        .select()
        .from(taskRelationships)
        .leftJoin(tasks, eq(taskRelationships.relatedTaskId, tasks.id))
        .where(eq(taskRelationships.taskId, taskId))
        .orderBy(desc(taskRelationships.createdAt));

      return relationships
        .filter(r => r.tasks !== null)
        .map(r => ({
          ...r.task_relationships,
          relatedTask: r.tasks as Task
        }));
    },

    async deleteTaskRelationship(id: string): Promise<void> {
      await db.delete(taskRelationships).where(eq(taskRelationships.id, id));
    },

    // Task Messages
    async getTaskMessagesByTaskId(taskId: string): Promise<TaskMessageWithSender[]> {
      const messages = await db.select({
        id: taskMessages.id,
        taskId: taskMessages.taskId,
        senderId: taskMessages.senderId,
        message: taskMessages.message,
        isRead: taskMessages.isRead,
        createdAt: taskMessages.createdAt,
        sender: profiles,
      })
        .from(taskMessages)
        .leftJoin(profiles, eq(taskMessages.senderId, profiles.id))
        .where(eq(taskMessages.taskId, taskId))
        .orderBy(taskMessages.createdAt);

      return messages.map(row => ({
        id: row.id,
        taskId: row.taskId,
        senderId: row.senderId,
        message: row.message,
        isRead: row.isRead,
        createdAt: row.createdAt,
        sender: row.sender || undefined,
      }));
    },

    async createTaskMessage(message: InsertTaskMessage): Promise<TaskMessage> {
      const result = await db.insert(taskMessages).values(message).returning();
      return result[0];
    },

    async markTaskMessageAsRead(messageId: string): Promise<void> {
      await db.update(taskMessages)
        .set({ isRead: "true" })
        .where(eq(taskMessages.id, messageId));
    },

    // Project with Tasks (composite query)
    async getProjectWithTasks(projectId: string): Promise<{
      project: Project;
      tasks: TaskWithAssignments[];
    } | undefined> {
      const project = await getProjectById(projectId);
      if (!project) return undefined;

      const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

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
    },
  };
}
