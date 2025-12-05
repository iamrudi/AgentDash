import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar,
  Target,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

interface TaskWithDetails {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  timeTracked: string | number | null;
  timeEstimate: string | number | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  taskList?: {
    id: string;
    name: string;
  };
}

function parseNumeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(parsed) ? 0 : parsed;
}

function formatHours(value: number): string {
  if (value === 0) return "0h";
  return `${value.toFixed(1)}h`;
}

export default function StaffHours() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const { data: tasks, isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ['/api/staff/tasks/full'],
  });

  const analytics = useMemo(() => {
    if (!tasks) return null;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = typeof t.dueDate === 'string' ? parseISO(t.dueDate) : t.dueDate;
      return dueDate < now && t.status !== 'completed';
    });

    let totalTracked = 0;
    let totalEstimated = 0;
    let weekTracked = 0;
    let monthTracked = 0;

    const projectHours: Record<string, { name: string; tracked: number; estimated: number; taskCount: number }> = {};

    tasks.forEach(task => {
      const tracked = parseNumeric(task.timeTracked);
      const estimated = parseNumeric(task.timeEstimate);

      totalTracked += tracked;
      totalEstimated += estimated;

      const updatedAt = task.updatedAt ? (typeof task.updatedAt === 'string' ? parseISO(task.updatedAt) : task.updatedAt) : null;
      if (updatedAt && tracked > 0) {
        if (isWithinInterval(updatedAt, { start: weekStart, end: weekEnd })) {
          weekTracked += tracked;
        }
        if (isWithinInterval(updatedAt, { start: monthStart, end: monthEnd })) {
          monthTracked += tracked;
        }
      }

      if (task.project) {
        const projectId = task.project.id;
        if (!projectHours[projectId]) {
          projectHours[projectId] = {
            name: task.project.name,
            tracked: 0,
            estimated: 0,
            taskCount: 0,
          };
        }
        projectHours[projectId].tracked += tracked;
        projectHours[projectId].estimated += estimated;
        projectHours[projectId].taskCount += 1;
      }
    });

    const projectBreakdown = Object.values(projectHours).sort((a, b) => b.tracked - a.tracked);

    return {
      totalTasks: tasks.length,
      completedCount: completedTasks.length,
      inProgressCount: inProgressTasks.length,
      pendingCount: pendingTasks.length,
      overdueCount: overdueTasks.length,
      totalTracked,
      totalEstimated,
      weekTracked,
      monthTracked,
      projectBreakdown,
      utilizationRate: totalEstimated > 0 ? (totalTracked / totalEstimated) * 100 : 0,
    };
  }, [tasks]);

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold">My Hours</h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-hours-title">My Hours</h1>
                  <p className="text-sm text-muted-foreground">
                    Track your time across projects and tasks
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !analytics ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No task data available</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>This Week</CardDescription>
                        <CardTitle className="text-2xl" data-testid="text-week-hours">
                          {formatHours(analytics.weekTracked)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>This Month</CardDescription>
                        <CardTitle className="text-2xl" data-testid="text-month-hours">
                          {formatHours(analytics.monthTracked)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(), 'MMMM yyyy')}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Total Tracked</CardDescription>
                        <CardTitle className="text-2xl" data-testid="text-total-hours">
                          {formatHours(analytics.totalTracked)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Across all tasks</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Utilization</CardDescription>
                        <CardTitle className="text-2xl" data-testid="text-utilization">
                          {analytics.utilizationRate.toFixed(0)}%
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Progress value={Math.min(analytics.utilizationRate, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatHours(analytics.totalTracked)} / {formatHours(analytics.totalEstimated)} estimated
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-base">Hours by Project</CardTitle>
                              <CardDescription>Time tracked across your assigned projects</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {analytics.projectBreakdown.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              No project hours tracked yet
                            </p>
                          ) : (
                            <div className="space-y-4" data-testid="project-hours-list">
                              {analytics.projectBreakdown.map((project) => (
                                <div key={project.name} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{project.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {formatHours(project.tracked)} / {formatHours(project.estimated)}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={project.estimated > 0 ? (project.tracked / project.estimated) * 100 : 0} 
                                    className="h-2"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Task Summary</CardTitle>
                            <CardDescription>Overview of your tasks</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4" data-testid="task-summary">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Completed</span>
                          </div>
                          <Badge variant="secondary">{analytics.completedCount}</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">In Progress</span>
                          </div>
                          <Badge variant="secondary">{analytics.inProgressCount}</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Pending</span>
                          </div>
                          <Badge variant="secondary">{analytics.pendingCount}</Badge>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm">Overdue</span>
                          </div>
                          <Badge variant={analytics.overdueCount > 0 ? "destructive" : "secondary"}>
                            {analytics.overdueCount}
                          </Badge>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total Tasks</span>
                          <Badge>{analytics.totalTasks}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
