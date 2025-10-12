import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, Calendar, AlertCircle, CheckCircle2, Clock, Circle } from "lucide-react";
import type { Project, Task } from "@shared/schema";
import { format } from "date-fns";

interface ProjectWithTasks extends Project {
  tasks: Task[];
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
}

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery<ProjectWithTasks[]>({
    queryKey: ["/api/client/projects-with-tasks"],
  });

  const activeProjects = projects.filter(p => p.status !== "Completed");
  const completedProjects = projects.filter(p => p.status === "Completed");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />;
      case "In Progress":
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-500" />;
      case "Pending":
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "Completed":
        return "default";
      case "In Progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  const ProjectCard = ({ project }: { project: ProjectWithTasks }) => {
    const progressPercentage = project.taskStats.total > 0
      ? Math.round((project.taskStats.completed / project.taskStats.total) * 100)
      : 0;

    return (
      <Card data-testid={`project-card-${project.id}`}>
        <Accordion type="single" collapsible>
          <AccordionItem value="project-details" className="border-0">
            <AccordionTrigger className="hover:no-underline px-6 pt-6 pb-3" data-testid={`accordion-trigger-${project.id}`}>
              <div className="flex-1 text-left">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`project-name-${project.id}`}>
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <CardDescription className="mt-1" data-testid={`project-description-${project.id}`}>
                        {project.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge 
                    variant={project.status === "Active" ? "default" : project.status === "Completed" ? "secondary" : "outline"}
                    data-testid={`project-status-${project.id}`}
                  >
                    {project.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium" data-testid={`progress-percentage-${project.id}`}>
                      {project.taskStats.completed} / {project.taskStats.total} tasks
                    </span>
                  </div>
                  <Progress 
                    value={progressPercentage} 
                    className="h-2"
                    data-testid={`progress-bar-${project.id}`}
                  />
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span data-testid={`project-date-${project.id}`}>
                        Started {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-6 pb-6 pt-3" data-testid={`accordion-content-${project.id}`}>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Tasks ({project.taskStats.total})</h4>
                {project.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {project.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                        data-testid={`task-item-${task.id}`}
                      >
                        <div className="mt-0.5">
                          {getStatusIcon(task.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm" data-testid={`task-title-${task.id}`}>
                              {task.description}
                            </p>
                            <Badge 
                              variant={getStatusBadgeVariant(task.status)}
                              className="text-xs shrink-0"
                              data-testid={`task-status-${task.id}`}
                            >
                              {task.status}
                            </Badge>
                            {task.priority === "High" && (
                              <Badge variant="destructive" className="text-xs shrink-0">
                                High Priority
                              </Badge>
                            )}
                          </div>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No tasks created yet for this project</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-projects">Projects</h1>
        <p className="text-muted-foreground mt-1">View and track your active and completed projects</p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList data-testid="tabs-projects">
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeProjects.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4" data-testid="tab-content-active">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading projects...</div>
              </CardContent>
            </Card>
          ) : activeProjects.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active projects</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4" data-testid="tab-content-completed">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading projects...</div>
              </CardContent>
            </Card>
          ) : completedProjects.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No completed projects</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
