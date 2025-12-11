import { storage } from "../storage";
import type { 
  ResourceCapacityProfile, 
  ResourceAllocationPlan,
  InsertResourceAllocationPlan,
  Task 
} from "@shared/schema";
import { durationModelService, PredictionResult } from "./duration-model-service";

export interface AllocationAssignment {
  taskId: string;
  staffId: string;
  scheduledDate: string;
  predictedHours: number;
  priority: number;
  skillFitScore: number;
  taskDescription?: string;
  staffName?: string;
}

export interface OptimizationObjective {
  overloadScore: number;
  slaRiskScore: number;
  contextSwitchScore: number;
  skillFitScore: number;
  commercialImpactScore: number;
  compositeScore: number;
}

export interface TaskForAllocation {
  id: string;
  description: string;
  priority: string | null;
  dueDate: string | null;
  projectId: string | null;
  listId: string | null;
  timeEstimate: string | null;
  assignedStaffIds?: string[];
  predictedHours?: number;
  commercialImpactScore?: number;
  taskType?: string;
  complexity?: string;
  channel?: string;
}

export interface StaffWithCapacity {
  profile: ResourceCapacityProfile;
  staffId: string;
  staffName: string;
  availableHours: Map<string, number>;
  assignedTasks: Map<string, AllocationAssignment[]>;
  totalAssignedHours: number;
}

export interface ResourceOptimizerConfig {
  overloadWeight: number;
  slaRiskWeight: number;
  contextSwitchWeight: number;
  skillFitWeight: number;
  commercialImpactWeight: number;
  maxTasksPerDayPerPerson: number;
  defaultDailyHours: number;
}

const DEFAULT_CONFIG: ResourceOptimizerConfig = {
  overloadWeight: 0.25,
  slaRiskWeight: 0.30,
  contextSwitchWeight: 0.10,
  skillFitWeight: 0.15,
  commercialImpactWeight: 0.20,
  maxTasksPerDayPerPerson: 8,
  defaultDailyHours: 8,
};

export class ResourceOptimizerService {
  private config: ResourceOptimizerConfig;

  constructor(config: Partial<ResourceOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateAllocationPlan(
    agencyId: string,
    tasks: TaskForAllocation[],
    startDate: Date,
    endDate: Date
  ): Promise<{
    assignments: AllocationAssignment[];
    objective: OptimizationObjective;
    unassignedTasks: string[];
    warnings: string[];
  }> {
    const capacityProfiles = await storage.getResourceCapacityProfilesByAgencyId(agencyId, { activeOnly: true });
    
    if (capacityProfiles.length === 0) {
      return {
        assignments: [],
        objective: this.emptyObjective(),
        unassignedTasks: tasks.map(t => t.id),
        warnings: ["No active capacity profiles found. Please set up staff capacity profiles."]
      };
    }

    const staffWithCapacity = await this.buildStaffCapacity(capacityProfiles, startDate, endDate);

    const sortedTasks = this.sortTasksByPriority(tasks);

    const { assignments, unassignedTasks, warnings } = this.greedyAssign(
      sortedTasks,
      staffWithCapacity,
      startDate,
      endDate
    );

    const objective = this.calculateObjective(assignments, staffWithCapacity, tasks);

    return { assignments, objective, unassignedTasks, warnings };
  }

  private async buildStaffCapacity(
    profiles: ResourceCapacityProfile[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, StaffWithCapacity>> {
    const staffMap = new Map<string, StaffWithCapacity>();

    for (const profile of profiles) {
      const availableHours = new Map<string, number>();
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        let hours = parseFloat(profile.dailyCapacityHours || "8");
        
        switch (dayOfWeek) {
          case 0: hours = parseFloat(profile.sundayHours || "0"); break;
          case 1: hours = parseFloat(profile.mondayHours || "8"); break;
          case 2: hours = parseFloat(profile.tuesdayHours || "8"); break;
          case 3: hours = parseFloat(profile.wednesdayHours || "8"); break;
          case 4: hours = parseFloat(profile.thursdayHours || "8"); break;
          case 5: hours = parseFloat(profile.fridayHours || "8"); break;
          case 6: hours = parseFloat(profile.saturdayHours || "0"); break;
        }

        if (profile.plannedTimeOff) {
          const timeOff = profile.plannedTimeOff as Array<{ startDate: string; endDate: string }>;
          for (const off of timeOff) {
            if (dateKey >= off.startDate && dateKey <= off.endDate) {
              hours = 0;
              break;
            }
          }
        }

        availableHours.set(dateKey, hours);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      staffMap.set(profile.staffId, {
        profile,
        staffId: profile.staffId,
        staffName: profile.staffId,
        availableHours,
        assignedTasks: new Map(),
        totalAssignedHours: 0
      });
    }

    return staffMap;
  }

  private sortTasksByPriority(tasks: TaskForAllocation[]): TaskForAllocation[] {
    const priorityOrder: Record<string, number> = {
      'Urgent': 4,
      'High': 3,
      'Medium': 2,
      'Low': 1
    };

    return [...tasks].sort((a, b) => {
      const aImpact = a.commercialImpactScore || 0;
      const bImpact = b.commercialImpactScore || 0;
      if (bImpact !== aImpact) return bImpact - aImpact;

      const aPriority = priorityOrder[a.priority || 'Medium'] || 2;
      const bPriority = priorityOrder[b.priority || 'Medium'] || 2;
      if (bPriority !== aPriority) return bPriority - aPriority;

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      return 0;
    });
  }

  private greedyAssign(
    tasks: TaskForAllocation[],
    staffMap: Map<string, StaffWithCapacity>,
    startDate: Date,
    endDate: Date
  ): {
    assignments: AllocationAssignment[];
    unassignedTasks: string[];
    warnings: string[];
  } {
    const assignments: AllocationAssignment[] = [];
    const unassignedTasks: string[] = [];
    const warnings: string[] = [];

    for (const task of tasks) {
      const predictedHours = task.predictedHours || 
        (task.timeEstimate ? parseFloat(task.timeEstimate) : 2);
      
      const priorityValue = this.getPriorityValue(task.priority);
      
      const bestAssignment = this.findBestStaff(
        task,
        predictedHours,
        staffMap,
        startDate,
        endDate
      );

      if (bestAssignment) {
        const staff = staffMap.get(bestAssignment.staffId)!;
        
        if (!staff.assignedTasks.has(bestAssignment.scheduledDate)) {
          staff.assignedTasks.set(bestAssignment.scheduledDate, []);
        }
        staff.assignedTasks.get(bestAssignment.scheduledDate)!.push({
          ...bestAssignment,
          taskId: task.id,
          priority: priorityValue,
          taskDescription: task.description
        });
        staff.totalAssignedHours += predictedHours;

        const currentHours = staff.availableHours.get(bestAssignment.scheduledDate) || 0;
        staff.availableHours.set(bestAssignment.scheduledDate, currentHours - predictedHours);

        assignments.push({
          taskId: task.id,
          staffId: bestAssignment.staffId,
          scheduledDate: bestAssignment.scheduledDate,
          predictedHours,
          priority: priorityValue,
          skillFitScore: bestAssignment.skillFitScore,
          taskDescription: task.description
        });
      } else {
        unassignedTasks.push(task.id);
        warnings.push(`Could not assign task "${task.description.substring(0, 50)}..." - no available capacity`);
      }
    }

    return { assignments, unassignedTasks, warnings };
  }

  private findBestStaff(
    task: TaskForAllocation,
    predictedHours: number,
    staffMap: Map<string, StaffWithCapacity>,
    startDate: Date,
    endDate: Date
  ): { staffId: string; scheduledDate: string; skillFitScore: number } | null {
    let bestOption: { staffId: string; scheduledDate: string; skillFitScore: number; score: number } | null = null;

    for (const [staffId, staff] of staffMap) {
      const skillFitScore = this.calculateSkillFit(task, staff.profile);
      
      for (const [dateKey, availableHours] of staff.availableHours) {
        if (availableHours < predictedHours) continue;
        
        const tasksOnDate = staff.assignedTasks.get(dateKey)?.length || 0;
        if (tasksOnDate >= this.config.maxTasksPerDayPerPerson) continue;

        let score = skillFitScore * 100;
        
        score += availableHours * 2;
        
        const dateObj = new Date(dateKey);
        const daysFromStart = Math.floor((dateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        score -= daysFromStart * 0.5;
        
        score -= tasksOnDate * 5;

        if (!bestOption || score > bestOption.score) {
          bestOption = { staffId, scheduledDate: dateKey, skillFitScore, score };
        }
      }
    }

    return bestOption ? {
      staffId: bestOption.staffId,
      scheduledDate: bestOption.scheduledDate,
      skillFitScore: bestOption.skillFitScore
    } : null;
  }

  private calculateSkillFit(task: TaskForAllocation, profile: ResourceCapacityProfile): number {
    const channel = task.channel?.toLowerCase();
    const taskType = task.taskType?.toLowerCase();

    if (!channel && !taskType) return 0.5;

    const channelSpecs = profile.channelSpecializations || [];
    const primarySkills = profile.primarySkills || [];
    const secondarySkills = profile.secondarySkills || [];

    let score = 0.5;

    if (channel && channelSpecs.includes(channel)) {
      score += 0.3;
    }

    if (taskType) {
      if (primarySkills.some(s => taskType.includes(s.toLowerCase()))) {
        score += 0.2;
      } else if (secondarySkills.some(s => taskType.includes(s.toLowerCase()))) {
        score += 0.1;
      }
    }

    return Math.min(1, score);
  }

  private getPriorityValue(priority: string | null): number {
    switch (priority) {
      case 'Urgent': return 4;
      case 'High': return 3;
      case 'Medium': return 2;
      case 'Low': return 1;
      default: return 2;
    }
  }

  private calculateObjective(
    assignments: AllocationAssignment[],
    staffMap: Map<string, StaffWithCapacity>,
    tasks: TaskForAllocation[]
  ): OptimizationObjective {
    let totalOverload = 0;
    let totalCapacity = 0;
    
    for (const [, staff] of staffMap) {
      for (const [dateKey, available] of staff.availableHours) {
        totalCapacity += parseFloat(staff.profile.dailyCapacityHours || "8");
        if (available < 0) {
          totalOverload += Math.abs(available);
        }
      }
    }
    const overloadScore = totalCapacity > 0 ? 1 - (totalOverload / totalCapacity) : 1;

    const tasksWithDeadlines = tasks.filter(t => t.dueDate);
    let slaRisk = 0;
    for (const task of tasksWithDeadlines) {
      const assignment = assignments.find(a => a.taskId === task.id);
      if (assignment && task.dueDate) {
        const scheduledDate = new Date(assignment.scheduledDate);
        const dueDate = new Date(task.dueDate);
        if (scheduledDate > dueDate) {
          slaRisk += 1;
        }
      } else if (!assignment && task.dueDate) {
        slaRisk += 1;
      }
    }
    const slaRiskScore = tasksWithDeadlines.length > 0 
      ? 1 - (slaRisk / tasksWithDeadlines.length) 
      : 1;

    let totalSwitches = 0;
    let totalDays = 0;
    for (const [, staff] of staffMap) {
      for (const [, dailyTasks] of staff.assignedTasks) {
        totalDays++;
        const uniqueProjects = new Set(
          dailyTasks.map(t => {
            const task = tasks.find(tk => tk.id === t.taskId);
            return task?.projectId || 'unknown';
          })
        );
        totalSwitches += Math.max(0, uniqueProjects.size - 1);
      }
    }
    const avgSwitches = totalDays > 0 ? totalSwitches / totalDays : 0;
    const contextSwitchScore = 1 - Math.min(1, avgSwitches / this.config.maxTasksPerDayPerPerson);

    const avgSkillFit = assignments.length > 0
      ? assignments.reduce((sum, a) => sum + a.skillFitScore, 0) / assignments.length
      : 0.5;
    const skillFitScore = avgSkillFit;

    const avgImpact = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + (t.commercialImpactScore || 0), 0) / tasks.length
      : 0.5;
    const commercialImpactScore = avgImpact;

    const compositeScore = 
      overloadScore * this.config.overloadWeight +
      slaRiskScore * this.config.slaRiskWeight +
      contextSwitchScore * this.config.contextSwitchWeight +
      skillFitScore * this.config.skillFitWeight +
      commercialImpactScore * this.config.commercialImpactWeight;

    return {
      overloadScore: Math.round(overloadScore * 100) / 100,
      slaRiskScore: Math.round(slaRiskScore * 100) / 100,
      contextSwitchScore: Math.round(contextSwitchScore * 100) / 100,
      skillFitScore: Math.round(skillFitScore * 100) / 100,
      commercialImpactScore: Math.round(commercialImpactScore * 100) / 100,
      compositeScore: Math.round(compositeScore * 100) / 100
    };
  }

  private emptyObjective(): OptimizationObjective {
    return {
      overloadScore: 0,
      slaRiskScore: 0,
      contextSwitchScore: 0,
      skillFitScore: 0,
      commercialImpactScore: 0,
      compositeScore: 0
    };
  }

  async saveAllocationPlan(
    agencyId: string,
    name: string,
    startDate: Date,
    endDate: Date,
    assignments: AllocationAssignment[],
    objective: OptimizationObjective,
    createdBy: string | null
  ): Promise<ResourceAllocationPlan> {
    const totalPredictedHours = assignments.reduce((sum, a) => sum + a.predictedHours, 0);
    
    const capacityProfiles = await storage.getResourceCapacityProfilesByAgencyId(agencyId, { activeOnly: true });
    let totalCapacity = 0;
    for (const profile of capacityProfiles) {
      totalCapacity += parseFloat(profile.weeklyCapacityHours || "40");
    }

    const data: InsertResourceAllocationPlan = {
      agencyId,
      name,
      status: "draft",
      planStartDate: startDate.toISOString().split('T')[0],
      planEndDate: endDate.toISOString().split('T')[0],
      assignments: assignments as any,
      totalPredictedHours: totalPredictedHours.toString(),
      totalStaffCapacityHours: totalCapacity.toString(),
      utilizationRate: totalCapacity > 0 
        ? (totalPredictedHours / totalCapacity).toString() 
        : "0",
      overloadScore: objective.overloadScore.toString(),
      slaRiskScore: objective.slaRiskScore.toString(),
      contextSwitchScore: objective.contextSwitchScore.toString(),
      skillFitScore: objective.skillFitScore.toString(),
      commercialImpactScore: objective.commercialImpactScore.toString(),
      compositeScore: objective.compositeScore.toString(),
      createdBy: createdBy || undefined
    };

    return storage.createResourceAllocationPlan(data);
  }

  async getCapacityHeatmap(
    agencyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    staffId: string;
    staffName: string;
    dates: Array<{ date: string; capacityHours: number; assignedHours: number; utilization: number }>;
  }>> {
    const profiles = await storage.getResourceCapacityProfilesByAgencyId(agencyId, { activeOnly: true });
    const plans = await storage.getResourceAllocationPlansByAgencyId(agencyId, { 
      status: 'approved', 
      limit: 10 
    });

    const result: Array<{
      staffId: string;
      staffName: string;
      dates: Array<{ date: string; capacityHours: number; assignedHours: number; utilization: number }>;
    }> = [];

    for (const profile of profiles) {
      const staffData: {
        staffId: string;
        staffName: string;
        dates: Array<{ date: string; capacityHours: number; assignedHours: number; utilization: number }>;
      } = {
        staffId: profile.staffId,
        staffName: profile.staffId,
        dates: []
      };

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        let capacityHours = 0;
        switch (dayOfWeek) {
          case 0: capacityHours = parseFloat(profile.sundayHours || "0"); break;
          case 1: capacityHours = parseFloat(profile.mondayHours || "8"); break;
          case 2: capacityHours = parseFloat(profile.tuesdayHours || "8"); break;
          case 3: capacityHours = parseFloat(profile.wednesdayHours || "8"); break;
          case 4: capacityHours = parseFloat(profile.thursdayHours || "8"); break;
          case 5: capacityHours = parseFloat(profile.fridayHours || "8"); break;
          case 6: capacityHours = parseFloat(profile.saturdayHours || "0"); break;
        }

        let assignedHours = 0;
        for (const plan of plans) {
          const assignments = plan.assignments as AllocationAssignment[];
          for (const assignment of assignments) {
            if (assignment.staffId === profile.staffId && assignment.scheduledDate === dateKey) {
              assignedHours += assignment.predictedHours;
            }
          }
        }

        staffData.dates.push({
          date: dateKey,
          capacityHours,
          assignedHours,
          utilization: capacityHours > 0 ? Math.round((assignedHours / capacityHours) * 100) / 100 : 0
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      result.push(staffData);
    }

    return result;
  }
}

export const resourceOptimizerService = new ResourceOptimizerService();
