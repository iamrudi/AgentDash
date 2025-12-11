import { storage } from "../storage";
import { durationModelService, PredictionResult } from "./duration-model-service";
import { resourceOptimizerService, TaskForAllocation } from "./resource-optimizer-service";
import { commercialImpactService, TaskImpactContext } from "./commercial-impact-service";
import type { InsertIntelligenceSignal, Task } from "@shared/schema";

export interface DurationSignalPayload {
  taskId: string;
  predictedHours: number;
  confidenceScore: number;
  confidenceLevel: string;
  isColdStart: boolean;
  dueDate: string | null;
  daysUntilDeadline: number | null;
  riskLevel: 'safe' | 'at_risk' | 'critical';
}

export interface SLARiskAlert {
  taskId: string;
  taskDescription: string;
  predictedHours: number;
  scheduledDate: string | null;
  dueDate: string | null;
  daysUntilDeadline: number | null;
  hoursDeficit: number;
  riskLevel: 'warning' | 'critical' | 'breach';
  suggestedAction: string;
}

export class DurationIntelligenceIntegration {
  async emitDurationForecastSignal(
    agencyId: string,
    payload: DurationSignalPayload,
    clientId?: string | null
  ): Promise<void> {
    const signal: InsertIntelligenceSignal = {
      agencyId,
      signalType: "duration_forecast",
      category: "operational",
      sourceSystem: "duration_model",
      payload: payload as any,
      occurredAt: new Date(),
      severity: payload.riskLevel === 'critical' ? 'high' : 
                payload.riskLevel === 'at_risk' ? 'medium' : 'low',
      clientId: clientId || null,
      correlationKey: `task_${payload.taskId}`,
    };

    await storage.createIntelligenceSignal(signal);
  }

  async predictAndSignal(
    agencyId: string,
    task: Task,
    options: {
      taskType: string;
      complexity: string;
      channel?: string;
      role?: string;
    }
  ): Promise<DurationSignalPayload> {
    const clientId = task.projectId ? await this.getClientIdFromProject(task.projectId) : null;
    
    const prediction = await durationModelService.predictDuration(
      agencyId,
      options.taskType,
      options.complexity,
      null,
      clientId,
      null
    );

    let daysUntilDeadline: number | null = null;
    let riskLevel: 'safe' | 'at_risk' | 'critical' = 'safe';

    if (task.dueDate) {
      const now = new Date();
      const due = new Date(task.dueDate);
      daysUntilDeadline = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const workingHoursPerDay = 8;
      const hoursAvailable = Math.max(0, daysUntilDeadline * workingHoursPerDay);
      
      if (hoursAvailable < prediction.predictedHours) {
        riskLevel = 'critical';
      } else if (hoursAvailable < prediction.predictedHours * 1.5) {
        riskLevel = 'at_risk';
      }
    }

    const payload: DurationSignalPayload = {
      taskId: task.id,
      predictedHours: prediction.predictedHours,
      confidenceScore: prediction.confidenceScore,
      confidenceLevel: prediction.confidenceLevel,
      isColdStart: prediction.isColdStart,
      dueDate: task.dueDate,
      daysUntilDeadline,
      riskLevel
    };

    if (riskLevel !== 'safe') {
      await this.emitDurationForecastSignal(agencyId, payload, clientId);
    }

    return payload;
  }

  async checkSLARisks(
    agencyId: string,
    tasksWithDeadlines: Array<{ task: Task; predictedHours: number }>
  ): Promise<SLARiskAlert[]> {
    const alerts: SLARiskAlert[] = [];
    const now = new Date();

    for (const { task, predictedHours } of tasksWithDeadlines) {
      if (!task.dueDate) continue;

      const due = new Date(task.dueDate);
      const daysUntilDeadline = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const workingHoursPerDay = 8;
      const hoursAvailable = Math.max(0, daysUntilDeadline * workingHoursPerDay);
      const hoursDeficit = predictedHours - hoursAvailable;

      let riskLevel: 'warning' | 'critical' | 'breach' | null = null;
      let suggestedAction = '';

      if (daysUntilDeadline <= 0) {
        riskLevel = 'breach';
        suggestedAction = 'Deadline has passed. Escalate to client relationship manager immediately.';
      } else if (hoursDeficit > 0) {
        riskLevel = 'critical';
        suggestedAction = `Insufficient time to complete task. Consider: 1) Reassign to staff with more capacity, 2) Request deadline extension, 3) Add resources to task.`;
      } else if (hoursAvailable < predictedHours * 1.5) {
        riskLevel = 'warning';
        suggestedAction = 'Task may be at risk if any delays occur. Monitor closely and have contingency plan ready.';
      }

      if (riskLevel) {
        alerts.push({
          taskId: task.id,
          taskDescription: task.description,
          predictedHours,
          scheduledDate: null,
          dueDate: task.dueDate,
          daysUntilDeadline,
          hoursDeficit: Math.max(0, hoursDeficit),
          riskLevel,
          suggestedAction
        });
      }
    }

    return alerts.sort((a, b) => {
      const riskOrder = { breach: 0, critical: 1, warning: 2 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  async enrichTasksWithIntelligence(
    agencyId: string,
    tasks: Task[]
  ): Promise<Array<TaskForAllocation & { commercialImpactScore: number }>> {
    const enrichedTasks: Array<TaskForAllocation & { commercialImpactScore: number }> = [];

    for (const task of tasks) {
      const clientId = task.projectId ? await this.getClientIdFromProject(task.projectId) : null;
      
      const impactContext: TaskImpactContext = {
        taskId: task.id,
        taskDescription: task.description,
        clientId,
        projectId: task.projectId,
        dueDate: task.dueDate,
        priority: task.priority
      };

      const impactResult = await commercialImpactService.calculateImpactScore(agencyId, impactContext);
      
      let predictedHours = 2;
      if (task.timeEstimate) {
        predictedHours = parseFloat(task.timeEstimate);
      }

      enrichedTasks.push({
        id: task.id,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        projectId: task.projectId,
        listId: task.listId,
        timeEstimate: task.timeEstimate,
        predictedHours,
        commercialImpactScore: impactResult.totalImpactScore,
        taskType: 'general',
        complexity: 'medium'
      });
    }

    return enrichedTasks.sort((a, b) => b.commercialImpactScore - a.commercialImpactScore);
  }

  async generateResourcePlanWithIntelligence(
    agencyId: string,
    tasks: Task[],
    startDate: Date,
    endDate: Date
  ): Promise<{
    plan: Awaited<ReturnType<typeof resourceOptimizerService.generateAllocationPlan>>;
    slaRisks: SLARiskAlert[];
    totalCommercialValue: number;
  }> {
    const enrichedTasks = await this.enrichTasksWithIntelligence(agencyId, tasks);

    const plan = await resourceOptimizerService.generateAllocationPlan(
      agencyId,
      enrichedTasks,
      startDate,
      endDate
    );

    const tasksWithPredictions = enrichedTasks
      .filter(t => t.predictedHours !== undefined)
      .map(t => ({
        task: tasks.find(orig => orig.id === t.id)!,
        predictedHours: t.predictedHours!
      }))
      .filter(t => t.task);

    const slaRisks = await this.checkSLARisks(agencyId, tasksWithPredictions);

    const totalCommercialValue = enrichedTasks.reduce((sum, t) => sum + t.commercialImpactScore, 0);

    return { plan, slaRisks, totalCommercialValue };
  }

  async onTaskCreated(
    agencyId: string,
    task: Task,
    options?: { taskType?: string; complexity?: string; channel?: string }
  ): Promise<void> {
    try {
      const clientId = task.projectId ? await this.getClientIdFromProject(task.projectId) : null;
      
      const prediction = await durationModelService.predictDuration(
        agencyId,
        options?.taskType || 'general',
        options?.complexity || 'medium',
        null,
        clientId,
        null
      );

      await durationModelService.savePrediction(agencyId, task.id, prediction);

      const impactContext: TaskImpactContext = {
        taskId: task.id,
        taskDescription: task.description,
        clientId,
        projectId: task.projectId,
        dueDate: task.dueDate,
        priority: task.priority
      };

      const impactResult = await commercialImpactService.calculateImpactScore(agencyId, impactContext);
      await commercialImpactService.saveImpactScore(agencyId, task.id, impactContext, impactResult);

      if (impactResult.slaAtRisk) {
        const payload: DurationSignalPayload = {
          taskId: task.id,
          predictedHours: prediction.predictedHours,
          confidenceScore: prediction.confidenceScore,
          confidenceLevel: prediction.confidenceLevel,
          isColdStart: prediction.isColdStart,
          dueDate: task.dueDate,
          daysUntilDeadline: impactResult.daysUntilDeadline,
          riskLevel: impactResult.daysUntilDeadline !== null && impactResult.daysUntilDeadline <= 1 ? 'critical' : 'at_risk'
        };
        await this.emitDurationForecastSignal(agencyId, payload, clientId);
      }
    } catch (error) {
      console.error("Error in onTaskCreated intelligence processing:", error);
    }
  }

  async onTaskCompleted(
    agencyId: string,
    task: Task,
    actualHours: number,
    options?: { taskType?: string; complexity?: string; channel?: string }
  ): Promise<void> {
    try {
      const clientId = task.projectId ? await this.getClientIdFromProject(task.projectId) : null;
      
      await durationModelService.recordTaskCompletion(
        agencyId,
        task.id,
        options?.taskType || 'general',
        options?.complexity || 'medium',
        options?.channel || null,
        clientId,
        task.projectId,
        null,
        task.timeEstimate ? parseFloat(task.timeEstimate) : null,
        actualHours,
        false,
        null,
        task.priority,
        null,
        new Date()
      );

      const prediction = await storage.getTaskDurationPrediction(task.id);
      if (prediction) {
        const predictedHours = parseFloat(prediction.predictedHours);
        const variancePercent = ((actualHours - predictedHours) / predictedHours) * 100;

        if (Math.abs(variancePercent) > 50) {
          const signal: InsertIntelligenceSignal = {
            agencyId,
            signalType: "duration_variance_high",
            category: "operational",
            sourceSystem: "duration_model",
            occurredAt: new Date(),
            payload: {
              taskId: task.id,
              predictedHours,
              actualHours,
              variancePercent: Math.round(variancePercent * 100) / 100,
              taskType: options?.taskType || 'general',
              direction: variancePercent > 0 ? 'overrun' : 'underrun'
            } as any,
            severity: Math.abs(variancePercent) > 100 ? 'high' : 'medium',
            correlationKey: `task_${task.id}`,
          };
          await storage.createIntelligenceSignal(signal);
        }
      }
    } catch (error) {
      console.error("Error in onTaskCompleted intelligence processing:", error);
    }
  }

  private async getClientIdFromProject(projectId: string): Promise<string | null> {
    const project = await storage.getProjectById(projectId);
    return project?.clientId || null;
  }
}

export const durationIntelligenceIntegration = new DurationIntelligenceIntegration();
