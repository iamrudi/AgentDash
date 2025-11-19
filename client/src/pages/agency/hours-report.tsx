import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, TrendingUp, Users, Briefcase } from "lucide-react";
import type { Task, Project, Profile } from "@shared/schema";

// Helper function to format hours into readable string
function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

type TaskWithProject = Task & { project: Project | null };

type StaffHours = {
  profileId: string;
  name: string;
  email: string;
  totalTracked: number;
  totalEstimated: number;
  taskCount: number;
};

type ProjectHours = {
  projectId: string;
  projectName: string;
  totalTracked: number;
  totalEstimated: number;
  taskCount: number;
  variance: number; // Positive = under budget, Negative = over budget
};

export default function HoursReport() {
  const { data: allTasks, isLoading: tasksLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/agency/tasks"],
  });

  const { data: allStaff, isLoading: staffLoading } = useQuery<Profile[]>({
    queryKey: ["/api/agency/staff"],
  });

  const { data: allProjects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const isLoading = tasksLoading || staffLoading || projectsLoading;

  // Calculate project-level hours
  const projectHours: ProjectHours[] = allProjects?.map(project => {
    const projectTasks = allTasks?.filter(task => task.projectId === project.id) || [];
    const totalTracked = projectTasks.reduce((sum, task) => sum + (task.timeTracked || 0), 0);
    const totalEstimated = projectTasks.reduce((sum, task) => sum + (task.timeEstimate || 0), 0);
    const variance = totalEstimated - totalTracked;

    return {
      projectId: project.id,
      projectName: project.name,
      totalTracked,
      totalEstimated,
      taskCount: projectTasks.length,
      variance,
    };
  }) || [];

  // Fetch staff assignments for all tasks
  const { data: allAssignments } = useQuery({
    queryKey: ["/api/agency/staff-assignments"],
  });

  // Calculate staff-level hours from assignments
  const staffHoursMap = new Map<string, StaffHours>();
  
  // Build task assignment counts to distribute hours evenly
  const taskAssignmentCounts = new Map<string, number>();
  allAssignments?.forEach(assignment => {
    const count = taskAssignmentCounts.get(assignment.taskId) || 0;
    taskAssignmentCounts.set(assignment.taskId, count + 1);
  });

  // Build staff hours map from assignments and tasks, dividing hours by number of assignees
  allAssignments?.forEach(assignment => {
    const task = allTasks?.find(t => t.id === assignment.taskId);
    if (!task) return;

    const staff = allStaff?.find(s => s.id === assignment.staffProfileId);
    if (!staff) return;

    const assigneeCount = taskAssignmentCounts.get(assignment.taskId) || 1;
    const proportionalTracked = (task.timeTracked || 0) / assigneeCount;
    const proportionalEstimated = (task.timeEstimate || 0) / assigneeCount;

    if (!staffHoursMap.has(staff.id)) {
      staffHoursMap.set(staff.id, {
        profileId: staff.id,
        name: staff.fullName || 'Unknown',
        email: staff.email,
        totalTracked: 0,
        totalEstimated: 0,
        taskCount: 0,
      });
    }

    const staffHours = staffHoursMap.get(staff.id)!;
    staffHours.totalTracked += proportionalTracked;
    staffHours.totalEstimated += proportionalEstimated;
    staffHours.taskCount += 1;
  });

  const staffHours = Array.from(staffHoursMap.values());

  // Calculate overall totals
  const totalTracked = allTasks?.reduce((sum, task) => sum + (task.timeTracked || 0), 0) || 0;
  const totalEstimated = allTasks?.reduce((sum, task) => sum + (task.timeEstimate || 0), 0) || 0;
  const totalVariance = totalEstimated - totalTracked;
  const utilizationRate = totalEstimated > 0 ? (totalTracked / totalEstimated) * 100 : 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-hours-report">
            Task Hours Report
          </h1>
          <p className="text-muted-foreground">
            Track time estimates vs actual hours worked across all projects
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-tracked">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tracked">
              {formatHours(totalTracked)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {allTasks?.length || 0} tasks
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-estimated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estimated</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-estimated">
              {formatHours(totalEstimated)}
            </div>
            <p className="text-xs text-muted-foreground">
              Budgeted hours
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-variance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-variance">
              {totalVariance >= 0 ? '+' : ''}{formatHours(Math.abs(totalVariance))}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalVariance >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-utilization">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-utilization">
              {utilizationRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of estimated hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Breakdown */}
      <Card data-testid="card-project-breakdown">
        <CardHeader>
          <CardTitle>Hours by Project</CardTitle>
          <CardDescription>
            Time tracked vs estimated for each project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectHours.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No projects with time tracking data
            </p>
          ) : (
            <div className="space-y-4">
              {projectHours
                .sort((a, b) => b.totalTracked - a.totalTracked)
                .map(project => (
                  <div
                    key={project.projectId}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    data-testid={`project-${project.projectId}`}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        {project.projectName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatHours(project.totalTracked)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          of {formatHours(project.totalEstimated)}
                        </p>
                      </div>
                      <Badge
                        variant={project.variance >= 0 ? "default" : "destructive"}
                        className="w-20 justify-center"
                      >
                        {project.variance >= 0 ? '+' : ''}{formatHours(Math.abs(project.variance))}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Breakdown */}
      <Card data-testid="card-staff-breakdown">
        <CardHeader>
          <CardTitle>Hours by Staff Member</CardTitle>
          <CardDescription>
            Time tracked by each team member. Hours are divided proportionally among assignees. Unassigned tasks are not included in staff totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staffHours.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No staff with assigned tasks
            </p>
          ) : (
            <div className="space-y-4">
              {staffHours
                .sort((a, b) => b.totalTracked - a.totalTracked)
                .map(staff => (
                  <div
                    key={staff.profileId}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    data-testid={`staff-${staff.profileId}`}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        {staff.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {staff.taskCount} {staff.taskCount === 1 ? 'task' : 'tasks'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatHours(staff.totalTracked)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          of {formatHours(staff.totalEstimated)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
