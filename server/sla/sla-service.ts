import { db } from "../db";
import {
  slaDefinitions,
  slaBreaches,
  slaBreachEvents,
  slaBreachActions,
  escalationChains,
  slaMetrics,
  tasks,
  staffAssignments,
  taskLists,
  projects,
  profiles,
  type SlaDefinition,
  type SlaBreach,
  type EscalationChain,
  type InsertSlaBreach,
  type InsertSlaBreachEvent,
} from "@shared/schema";
import { eq, and, or, desc, asc, lte, gte, isNull, inArray, sql } from "drizzle-orm";

interface SlaCheckResult {
  isBreached: boolean;
  breachType: "response_time" | "resolution_time" | null;
  deadlineAt: Date | null;
  elapsedMinutes: number;
  remainingMinutes: number;
}

interface EscalationResult {
  escalated: boolean;
  newLevel: number;
  escalatedTo: string | null;
  actions: string[];
}

export class SlaService {
  async checkSlaForTask(
    taskId: string,
    agencyId: string,
    clientId: string,
    projectId?: string
  ): Promise<SlaCheckResult | null> {
    const task = await db.select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length === 0) return null;

    const taskData = task[0];

    const applicableSla = await this.findApplicableSla(
      agencyId,
      clientId,
      projectId,
      "task",
      taskData.priority
    );

    if (!applicableSla) return null;

    const createdAt = new Date(taskData.createdAt);
    const now = new Date();

    const responseDeadline = this.calculateDeadline(
      createdAt,
      parseFloat(applicableSla.responseTimeHours),
      applicableSla
    );

    const resolutionDeadline = this.calculateDeadline(
      createdAt,
      parseFloat(applicableSla.resolutionTimeHours),
      applicableSla
    );

    const assignments = await db.select()
      .from(staffAssignments)
      .where(eq(staffAssignments.taskId, taskId))
      .limit(1);
    const hasResponse = assignments.length > 0 || taskData.status !== "Pending";
    const isResolved = taskData.status === "Completed" || taskData.status === "Cancelled";

    let breachType: "response_time" | "resolution_time" | null = null;
    let deadlineAt: Date | null = null;

    if (!hasResponse && now > responseDeadline) {
      breachType = "response_time";
      deadlineAt = responseDeadline;
    } else if (!isResolved && now > resolutionDeadline) {
      breachType = "resolution_time";
      deadlineAt = resolutionDeadline;
    }

    const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
    const targetDeadline = !hasResponse ? responseDeadline : resolutionDeadline;
    const remainingMinutes = Math.floor((targetDeadline.getTime() - now.getTime()) / (1000 * 60));

    return {
      isBreached: breachType !== null,
      breachType,
      deadlineAt,
      elapsedMinutes,
      remainingMinutes,
    };
  }

  async findApplicableSla(
    agencyId: string,
    clientId?: string,
    projectId?: string,
    resourceType: string = "task",
    priority?: string | null
  ): Promise<SlaDefinition | null> {
    let conditions = [
      eq(slaDefinitions.agencyId, agencyId),
      eq(slaDefinitions.status, "active"),
    ];

    if (projectId) {
      const projectSla = await db.select()
        .from(slaDefinitions)
        .where(and(...conditions, eq(slaDefinitions.projectId, projectId)))
        .limit(1);
      if (projectSla.length > 0) {
        const sla = projectSla[0];
        if (this.slaAppliesToResource(sla, resourceType, priority)) {
          return sla;
        }
      }
    }

    if (clientId) {
      const clientSla = await db.select()
        .from(slaDefinitions)
        .where(and(
          ...conditions,
          eq(slaDefinitions.clientId, clientId),
          isNull(slaDefinitions.projectId)
        ))
        .limit(1);
      if (clientSla.length > 0) {
        const sla = clientSla[0];
        if (this.slaAppliesToResource(sla, resourceType, priority)) {
          return sla;
        }
      }
    }

    const agencySla = await db.select()
      .from(slaDefinitions)
      .where(and(
        ...conditions,
        isNull(slaDefinitions.clientId),
        isNull(slaDefinitions.projectId)
      ))
      .limit(1);
    
    if (agencySla.length > 0) {
      const sla = agencySla[0];
      if (this.slaAppliesToResource(sla, resourceType, priority)) {
        return sla;
      }
    }

    return null;
  }

  private slaAppliesToResource(
    sla: SlaDefinition,
    resourceType: string,
    priority?: string | null
  ): boolean {
    if (sla.appliesTo && !sla.appliesTo.includes(resourceType)) {
      return false;
    }

    if (sla.taskPriorities && priority && !sla.taskPriorities.includes(priority)) {
      return false;
    }

    return true;
  }

  calculateDeadline(
    startTime: Date,
    hours: number,
    sla: SlaDefinition
  ): Date {
    if (!sla.businessHoursOnly) {
      return new Date(startTime.getTime() + hours * 60 * 60 * 1000);
    }

    const businessStart = sla.businessHoursStart ?? 9;
    const businessEnd = sla.businessHoursEnd ?? 17;
    const businessDays = sla.businessDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const hoursPerDay = businessEnd - businessStart;

    let remainingMinutes = hours * 60;
    let current = new Date(startTime);

    const dayMap: Record<number, string> = {
      0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"
    };

    while (remainingMinutes > 0) {
      const dayName = dayMap[current.getDay()];
      const isBusinessDay = businessDays.includes(dayName);
      const currentHour = current.getHours();
      const currentMinute = current.getMinutes();

      if (!isBusinessDay) {
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      if (currentHour < businessStart) {
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      if (currentHour >= businessEnd) {
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      const minutesLeftToday = (businessEnd - currentHour) * 60 - currentMinute;
      
      if (remainingMinutes <= minutesLeftToday) {
        current.setMinutes(current.getMinutes() + remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesLeftToday;
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
      }
    }

    return current;
  }

  async detectBreaches(agencyId: string): Promise<SlaBreach[]> {
    const activeSlas = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.agencyId, agencyId),
        eq(slaDefinitions.status, "active")
      ));

    if (activeSlas.length === 0) return [];

    const detectedBreaches: SlaBreach[] = [];
    const now = new Date();

    for (const sla of activeSlas) {
      if (!sla.appliesTo?.includes("task")) continue;

      const projectsForAgency = await db.select({ id: projects.id })
        .from(projects)
        .innerJoin(taskLists, eq(taskLists.projectId, projects.id))
        .where(eq(taskLists.agencyId, agencyId));
      
      const projectIds = projectsForAgency.map(p => p.id);
      if (projectIds.length === 0) continue;

      const taskConditions = [
        inArray(tasks.projectId, projectIds),
        or(
          eq(tasks.status, "Pending"),
          eq(tasks.status, "In Progress")
        ),
      ];

      if (sla.projectId) {
        taskConditions.push(eq(tasks.projectId, sla.projectId));
      }

      const pendingTasks = await db.select()
        .from(tasks)
        .where(and(...taskConditions));

      for (const task of pendingTasks) {
        const existingBreach = await db.select()
          .from(slaBreaches)
          .where(and(
            eq(slaBreaches.slaId, sla.id),
            eq(slaBreaches.resourceId, task.id),
            or(
              eq(slaBreaches.status, "detected"),
              eq(slaBreaches.status, "acknowledged"),
              eq(slaBreaches.status, "escalated")
            )
          ))
          .limit(1);

        if (existingBreach.length > 0) continue;

        const createdAt = new Date(task.createdAt);
        const taskAssignments = await db.select()
          .from(staffAssignments)
          .where(eq(staffAssignments.taskId, task.id))
          .limit(1);
        const hasResponse = taskAssignments.length > 0 || task.status !== "Pending";

        if (!hasResponse) {
          const responseDeadline = this.calculateDeadline(
            createdAt,
            parseFloat(sla.responseTimeHours),
            sla
          );

          if (now > responseDeadline) {
            const breach = await this.createBreach({
              agencyId,
              slaId: sla.id,
              resourceType: "task",
              resourceId: task.id,
              breachType: "response_time",
              deadlineAt: responseDeadline,
              status: "detected",
            });
            if (breach) detectedBreaches.push(breach);
          }
        } else {
          const resolutionDeadline = this.calculateDeadline(
            createdAt,
            parseFloat(sla.resolutionTimeHours),
            sla
          );

          if (now > resolutionDeadline) {
            const breach = await this.createBreach({
              agencyId,
              slaId: sla.id,
              resourceType: "task",
              resourceId: task.id,
              breachType: "resolution_time",
              deadlineAt: resolutionDeadline,
              status: "detected",
            });
            if (breach) detectedBreaches.push(breach);
          }
        }
      }
    }

    return detectedBreaches;
  }

  async createBreach(data: InsertSlaBreach): Promise<SlaBreach | null> {
    const result = await db.insert(slaBreaches)
      .values(data)
      .returning();

    if (result.length === 0) return null;

    const breach = result[0];

    await this.logBreachEvent(breach.id, "detected", {
      slaId: data.slaId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      breachType: data.breachType,
      deadlineAt: data.deadlineAt,
    });

    await this.executeBreachActions(breach, "breach");

    return breach;
  }

  async escalateBreach(breachId: string): Promise<EscalationResult> {
    const breach = await db.select()
      .from(slaBreaches)
      .where(eq(slaBreaches.id, breachId))
      .limit(1);

    if (breach.length === 0) {
      return { escalated: false, newLevel: 0, escalatedTo: null, actions: [] };
    }

    const breachData = breach[0];
    const currentLevel = breachData.currentEscalationLevel ?? 0;
    const nextLevel = currentLevel + 1;

    const nextEscalation = await db.select()
      .from(escalationChains)
      .where(and(
        eq(escalationChains.slaId, breachData.slaId),
        eq(escalationChains.level, nextLevel)
      ))
      .limit(1);

    if (nextEscalation.length === 0) {
      return { escalated: false, newLevel: currentLevel, escalatedTo: null, actions: [] };
    }

    const escalation = nextEscalation[0];
    const actions: string[] = [];

    await db.update(slaBreaches)
      .set({
        status: "escalated",
        currentEscalationLevel: nextLevel,
      })
      .where(eq(slaBreaches.id, breachId));

    let escalatedTo: string | null = null;

    if (escalation.profileId) {
      const profile = await db.select()
        .from(profiles)
        .where(eq(profiles.id, escalation.profileId))
        .limit(1);
      
      if (profile.length > 0) {
        escalatedTo = profile[0].fullName;

        if (escalation.notifyInApp) {
          await this.createNotification(
            escalation.profileId,
            "sla_escalation",
            "SLA Breach Escalated",
            `A ${breachData.breachType?.replace("_", " ")} breach has been escalated to you (Level ${nextLevel})`,
            {
              breachId,
              slaId: breachData.slaId,
              resourceType: breachData.resourceType,
              resourceId: breachData.resourceId,
              level: nextLevel,
            }
          );
          actions.push("in_app_notification");
        }

        if (escalation.reassignTask && breachData.resourceType === "task") {
          await db.insert(staffAssignments).values({
            taskId: breachData.resourceId,
            staffProfileId: escalation.profileId,
          });
          actions.push("task_reassigned");
        }
      }
    }

    await this.logBreachEvent(breachId, "escalated", {
      fromLevel: currentLevel,
      toLevel: nextLevel,
      escalatedTo,
      actions,
    });

    return {
      escalated: true,
      newLevel: nextLevel,
      escalatedTo,
      actions,
    };
  }

  async processEscalations(agencyId: string): Promise<number> {
    const now = new Date();
    let escalatedCount = 0;

    const activeBreaches = await db.select()
      .from(slaBreaches)
      .where(and(
        eq(slaBreaches.agencyId, agencyId),
        or(
          eq(slaBreaches.status, "detected"),
          eq(slaBreaches.status, "escalated")
        )
      ));

    for (const breach of activeBreaches) {
      const currentLevel = breach.currentEscalationLevel ?? 0;

      const nextEscalation = await db.select()
        .from(escalationChains)
        .where(and(
          eq(escalationChains.slaId, breach.slaId),
          eq(escalationChains.level, currentLevel + 1)
        ))
        .limit(1);

      if (nextEscalation.length === 0) continue;

      const escalation = nextEscalation[0];
      const breachTime = new Date(breach.detectedAt);
      const minutesSinceBreach = Math.floor((now.getTime() - breachTime.getTime()) / (1000 * 60));

      if (minutesSinceBreach >= escalation.escalateAfterMinutes) {
        const result = await this.escalateBreach(breach.id);
        if (result.escalated) escalatedCount++;
      }
    }

    return escalatedCount;
  }

  async acknowledgeBreach(
    breachId: string,
    userId: string,
    agencyId: string,
    notes?: string
  ): Promise<boolean> {
    const breach = await db.select()
      .from(slaBreaches)
      .where(and(
        eq(slaBreaches.id, breachId),
        eq(slaBreaches.agencyId, agencyId)
      ))
      .limit(1);

    if (breach.length === 0) return false;

    await db.update(slaBreaches)
      .set({
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        notes: notes ?? breach[0].notes,
      })
      .where(eq(slaBreaches.id, breachId));

    await this.logBreachEvent(breachId, "acknowledged", {
      acknowledgedBy: userId,
      notes,
    }, "user", userId);

    return true;
  }

  async resolveBreach(
    breachId: string,
    userId: string,
    agencyId: string,
    autoResolved: boolean = false
  ): Promise<boolean> {
    const breach = await db.select()
      .from(slaBreaches)
      .where(and(
        eq(slaBreaches.id, breachId),
        eq(slaBreaches.agencyId, agencyId)
      ))
      .limit(1);

    if (breach.length === 0) return false;

    const breachData = breach[0];
    const now = new Date();
    const breachDuration = Math.floor(
      (now.getTime() - new Date(breachData.deadlineAt).getTime()) / (1000 * 60)
    );

    await db.update(slaBreaches)
      .set({
        status: autoResolved ? "auto_resolved" : "resolved",
        resolvedAt: now,
        resolvedBy: userId,
        breachDurationMinutes: breachDuration,
        actualResolutionAt: now,
      })
      .where(eq(slaBreaches.id, breachId));

    await this.logBreachEvent(
      breachId,
      "resolved",
      {
        resolvedBy: userId,
        autoResolved,
        breachDurationMinutes: breachDuration,
      },
      autoResolved ? "system" : "user",
      userId
    );

    return true;
  }

  async autoResolveCompletedTasks(agencyId: string): Promise<number> {
    const activeBreaches = await db.select()
      .from(slaBreaches)
      .where(and(
        eq(slaBreaches.agencyId, agencyId),
        eq(slaBreaches.resourceType, "task"),
        or(
          eq(slaBreaches.status, "detected"),
          eq(slaBreaches.status, "acknowledged"),
          eq(slaBreaches.status, "escalated")
        )
      ));

    let resolvedCount = 0;

    for (const breach of activeBreaches) {
      const task = await db.select()
        .from(tasks)
        .where(eq(tasks.id, breach.resourceId))
        .limit(1);

      if (task.length > 0 && (task[0].status === "Completed" || task[0].status === "Cancelled")) {
        const systemUserId = breach.acknowledgedBy || breach.agencyId;
        await this.resolveBreach(breach.id, systemUserId, agencyId, true);
        resolvedCount++;
      }
    }

    return resolvedCount;
  }

  private async executeBreachActions(breach: SlaBreach, trigger: string): Promise<void> {
    const actions = await db.select()
      .from(slaBreachActions)
      .where(and(
        eq(slaBreachActions.slaId, breach.slaId),
        eq(slaBreachActions.triggerAt, trigger),
        eq(slaBreachActions.enabled, true)
      ));

    for (const action of actions) {
      switch (action.actionType) {
        case "notify":
          await this.handleNotifyAction(breach, action.config);
          break;
        case "escalate":
          await this.escalateBreach(breach.id);
          break;
        case "create_task":
          break;
      }
    }
  }

  private async handleNotifyAction(
    breach: SlaBreach,
    config: Record<string, unknown> | null
  ): Promise<void> {
    const sla = await db.select()
      .from(slaDefinitions)
      .where(eq(slaDefinitions.id, breach.slaId))
      .limit(1);

    if (sla.length === 0) return;

    if (sla[0].createdBy) {
      await this.createNotification(
        sla[0].createdBy,
        "sla_breach",
        "SLA Breach Detected",
        `A ${breach.breachType?.replace("_", " ")} breach was detected for ${breach.resourceType} ${breach.resourceId}`,
        {
          breachId: breach.id,
          slaId: breach.slaId,
          slaName: sla[0].name,
          resourceType: breach.resourceType,
          resourceId: breach.resourceId,
          breachType: breach.breachType,
        }
      );
    }
  }

  private async createNotification(
    profileId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const profile = await db.select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    
    if (profile.length === 0) return;

    await db.execute(sql`
      INSERT INTO notifications (id, user_id, type, title, message, metadata, created_at)
      VALUES (
        gen_random_uuid(),
        ${profileId},
        ${type},
        ${title},
        ${message},
        ${JSON.stringify(data || {})}::text,
        NOW()
      )
    `);
  }

  private async logBreachEvent(
    breachId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    triggeredBy: string = "system",
    userId?: string
  ): Promise<void> {
    await db.insert(slaBreachEvents).values({
      breachId,
      eventType,
      eventData,
      triggeredBy,
      userId,
    });
  }

  async getBreachHistory(
    agencyId: string,
    filters?: {
      slaId?: string;
      clientId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<SlaBreach[]> {
    let conditions = [eq(slaBreaches.agencyId, agencyId)];

    if (filters?.slaId) {
      conditions.push(eq(slaBreaches.slaId, filters.slaId));
    }

    if (filters?.status) {
      conditions.push(eq(slaBreaches.status, filters.status));
    }

    if (filters?.startDate) {
      conditions.push(gte(slaBreaches.detectedAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(slaBreaches.detectedAt, filters.endDate));
    }

    const query = db.select()
      .from(slaBreaches)
      .where(and(...conditions))
      .orderBy(desc(slaBreaches.detectedAt))
      .limit(filters?.limit ?? 100);

    return query;
  }

  async getSlaMetrics(
    agencyId: string,
    periodType: "daily" | "weekly" | "monthly" = "monthly",
    slaId?: string,
    clientId?: string
  ): Promise<{
    complianceRate: number;
    totalBreaches: number;
    resolvedBreaches: number;
    averageResolutionTime: number;
    breachesByType: Record<string, number>;
  }> {
    let conditions = [eq(slaBreaches.agencyId, agencyId)];

    if (slaId) {
      conditions.push(eq(slaBreaches.slaId, slaId));
    }

    const now = new Date();
    let periodStart: Date;

    switch (periodType) {
      case "daily":
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        const dayOfWeek = now.getDay();
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "monthly":
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    conditions.push(gte(slaBreaches.detectedAt, periodStart));

    const breaches = await db.select()
      .from(slaBreaches)
      .where(and(...conditions));

    const totalBreaches = breaches.length;
    const resolvedBreaches = breaches.filter(
      b => b.status === "resolved" || b.status === "auto_resolved"
    ).length;

    const resolvedWithDuration = breaches.filter(
      b => (b.status === "resolved" || b.status === "auto_resolved") && b.breachDurationMinutes
    );
    const averageResolutionTime = resolvedWithDuration.length > 0
      ? resolvedWithDuration.reduce((sum, b) => sum + (b.breachDurationMinutes || 0), 0) / resolvedWithDuration.length
      : 0;

    const breachesByType: Record<string, number> = {};
    for (const breach of breaches) {
      const type = breach.breachType || "unknown";
      breachesByType[type] = (breachesByType[type] || 0) + 1;
    }

    const slaIds = await db.select({ id: slaDefinitions.id })
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.agencyId, agencyId),
        eq(slaDefinitions.status, "active"),
        slaId ? eq(slaDefinitions.id, slaId) : sql`1=1`
      ));

    const complianceRate = slaIds.length > 0 && totalBreaches > 0
      ? Math.max(0, 100 - (totalBreaches / slaIds.length) * 10)
      : 100;

    return {
      complianceRate: Math.round(complianceRate * 100) / 100,
      totalBreaches,
      resolvedBreaches,
      averageResolutionTime: Math.round(averageResolutionTime),
      breachesByType,
    };
  }
}

export const slaService = new SlaService();
