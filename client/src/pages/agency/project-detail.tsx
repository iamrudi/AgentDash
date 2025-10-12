import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { EditProjectDialog } from "@/components/edit-project-dialog";

export default function ProjectDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showEditProject, setShowEditProject] = useState(false);

  const { data: projectData, isLoading } = useQuery({
    queryKey: ["/api/agency/projects", id],
    enabled: !!id,
  });

  const { data: allStaff } = useQuery({
    queryKey: ["/api/agency/staff"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/agency/clients"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const { project, tasks } = projectData as any;
  const client = (clients as any)?.find((c: any) => c.id === project?.clientId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "In Progress": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Pending": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Medium": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "Low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/agency/tasks")}
            data-testid="button-back-to-tasks"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-project-name">{project.name}</h1>
            <p className="text-muted-foreground" data-testid="text-project-client">
              {client?.name || "Unknown Client"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowEditProject(true)}
            data-testid="button-edit-project"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Project
          </Button>
        </div>
      </div>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Details</CardTitle>
            <Badge className={getStatusColor(project.status)} data-testid="badge-project-status">
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {project.description ? (
            <p className="text-sm text-muted-foreground" data-testid="text-project-description">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided</p>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} in this project
              </CardDescription>
            </div>
            <Button data-testid="button-add-task">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks yet. Add your first task to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task: any) => (
                <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium" data-testid={`text-task-description-${task.id}`}>
                            {task.description}
                          </p>
                          <Badge className={getStatusColor(task.status)} data-testid={`badge-task-status-${task.id}`}>
                            {task.status}
                          </Badge>
                          <Badge className={getPriorityColor(task.priority)} data-testid={`badge-task-priority-${task.id}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        
                        {task.dueDate && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-task-due-${task.id}`}>
                            Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </p>
                        )}

                        {task.assignments && task.assignments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.assignments.map((assignment: any) => (
                              <Badge
                                key={assignment.id}
                                variant="outline"
                                className="text-xs"
                                data-testid={`badge-staff-${assignment.staffProfile.id}`}
                              >
                                {assignment.staffProfile.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" data-testid={`button-assign-staff-${task.id}`}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" data-testid={`button-edit-task-${task.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-task-${task.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditProjectDialog 
        open={showEditProject}
        onOpenChange={setShowEditProject}
        project={project}
      />
    </div>
  );
}
