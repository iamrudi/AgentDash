import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TaskItem } from "@/components/dashboard/task-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth";
import { TaskWithProject } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckSquare, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StaffDashboard() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
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

  const handleToggleTask = (taskId: string, completed: boolean) => {
    updateTaskMutation.mutate({
      taskId,
      status: completed ? "Completed" : "Pending",
    });
  };

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
      </div>
    </SidebarProvider>
  );
}
