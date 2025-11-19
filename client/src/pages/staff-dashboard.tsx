import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TaskItem } from "@/components/dashboard/task-item";
import { TaskDetailDialog } from "@/components/task-detail-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth";
import { TaskWithProject, Task, Profile, StaffAssignment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckSquare, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TaskWithAssignments = Task & {
  assignments: Array<StaffAssignment & { staffProfile: Profile }>;
};

export default function StaffDashboard() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();
  const { toast } = useToast();

  const { data: tasks, isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/staff/tasks"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] });
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully",
      });
    },
  });

  // Query for full task data with assignments (for detail dialog)
  const { data: fullTaskData } = useQuery<TaskWithAssignments[]>({
    queryKey: ["/api/staff/tasks/full"],
    enabled: !!tasks,
  });

  // Debug logging for task data changes
  useEffect(() => {
    if (fullTaskData && selectedTaskId) {
      const task = fullTaskData.find(t => t.id === selectedTaskId);
      console.log('[StaffDashboard] fullTaskData updated, selectedTask timeTracked:', task?.timeTracked);
    }
  }, [fullTaskData, selectedTaskId]);

  const handleToggleTask = (taskId: string, completed: boolean) => {
    updateTaskMutation.mutate({
      taskId,
      status: completed ? "Completed" : "Pending",
    });
  };

  // Task click handler
  const handleViewTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowTaskDetail(true);
    syncTaskParam(taskId);
  };

  // URL sync helper
  const syncTaskParam = useCallback((taskId?: string) => {
    const [pathname, search = ""] = location.split("?");
    const params = new URLSearchParams(search);
    taskId ? params.set("task", taskId) : params.delete("task");
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (next !== location) {
      setLocation(next, { replace: true });
    }
  }, [location, setLocation]);

  const handleTaskDialogOpenChange = (open: boolean) => {
    setShowTaskDetail(open);
    if (!open) {
      // Clear state and URL when closing
      setSelectedTaskId(null);
      // Directly clear the task param from URL
      const [pathname] = location.split("?");
      setLocation(pathname, { replace: true });
    }
  };

  // URL sync effect - waits for tasks to load before validating
  useEffect(() => {
    const [, search = ""] = location.split("?");
    const params = new URLSearchParams(search);
    const taskParam = params.get("task");
    
    if (!taskParam) {
      setSelectedTaskId(null);
      setShowTaskDetail(false);
      return;
    }
    
    // Wait for tasks to load before validating
    if (isLoading || !tasks) {
      return; // Don't do anything until tasks are loaded
    }
    
    // Validate task exists
    const exists = tasks.some(t => t.id === taskParam);
    if (exists) {
      setSelectedTaskId(taskParam);
      setShowTaskDetail(true);
    } else {
      // Task doesn't exist - clear param and show error
      const [pathname] = location.split("?");
      setLocation(pathname, { replace: true });
      toast({
        title: "Task not found",
        description: "The requested task is unavailable.",
        variant: "destructive"
      });
    }
  }, [location, tasks, isLoading, setLocation, toast]);

  // Selected task - now waits for fullTaskData to load
  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !fullTaskData) return null;
    const task = fullTaskData.find(t => t.id === selectedTaskId) ?? null;
    console.log('[StaffDashboard useMemo] Recomputing selectedTask. timeTracked:', task?.timeTracked);
    return task;
  }, [fullTaskData, selectedTaskId]);

  const filteredTasks = tasks?.filter((task) => {
    if (filterStatus === "all") return true;
    return task.status === filterStatus;
  }) || [];

  const pendingTasks = tasks?.filter(t => t.status === "Pending").length || 0;
  const inProgressTasks = tasks?.filter(t => t.status === "In Progress").length || 0;
  const completedTasks = tasks?.filter(t => t.status === "Completed").length || 0;

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-semibold mb-2">My Tasks</h1>
                <p className="text-muted-foreground">
                  Manage your assigned tasks and track your progress
                </p>
              </div>

              {/* Task Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Pending</p>
                        <p className="text-2xl font-bold font-mono" data-testid="text-pending-tasks">
                          {pendingTasks}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">In Progress</p>
                        <p className="text-2xl font-bold font-mono" data-testid="text-inprogress-tasks">
                          {inProgressTasks}
                        </p>
                      </div>
                      <CheckSquare className="h-8 w-8 text-chart-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Completed</p>
                        <p className="text-2xl font-bold font-mono" data-testid="text-completed-tasks">
                          {completedTasks}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-accent" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                  data-testid="button-filter-all"
                >
                  All Tasks
                </Button>
                <Button
                  variant={filterStatus === "Pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("Pending")}
                  data-testid="button-filter-pending"
                >
                  Pending
                </Button>
                <Button
                  variant={filterStatus === "In Progress" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("In Progress")}
                  data-testid="button-filter-inprogress"
                >
                  In Progress
                </Button>
                <Button
                  variant={filterStatus === "Completed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("Completed")}
                  data-testid="button-filter-completed"
                >
                  Completed
                </Button>
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="h-24 bg-muted/50" />
                      </Card>
                    ))}
                  </div>
                ) : filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleTask}
                      onClick={() => handleViewTask(task.id)}
                      showProject={true}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No tasks found
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Task Detail Sheet - render when showTaskDetail is true, even if selectedTask is loading */}
        {showTaskDetail && selectedTaskId && (
          selectedTask ? (
            <TaskDetailDialog
              task={selectedTask}
              projectId={selectedTask.projectId || ""}
              open={showTaskDetail}
              onOpenChange={handleTaskDialogOpenChange}
              onAssignStaff={() => {}}
            />
          ) : (
            <div data-testid="loading-task-detail" className="hidden" />
          )
        )}
      </div>
    </SidebarProvider>
  );
}
