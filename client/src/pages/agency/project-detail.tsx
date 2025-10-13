import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { EditTaskDialog } from "@/components/edit-task-dialog";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, Profile, StaffAssignment } from "@shared/schema";

// Type for task with populated assignments
type TaskWithAssignments = Task & {
  assignments: Array<StaffAssignment & { staffProfile: Profile }>;
};

// Type for staff list from API
type StaffListItem = {
  id: string;
  name: string;
};

interface AssignmentDialogBodyProps {
  taskToAssign: TaskWithAssignments | null;
  tasks: TaskWithAssignments[];
  staffList: StaffListItem[] | undefined;
  onAssign: (taskId: string, staffProfileId: string) => void;
  onUnassign: (taskId: string, staffProfileId: string) => void;
}

function AssignmentDialogBody({ taskToAssign, tasks, staffList, onAssign, onUnassign }: AssignmentDialogBodyProps) {
  const { toast } = useToast();
  
  // Memoize current assignments - will update when tasks array changes
  const currentAssignments = useMemo(() => {
    if (!taskToAssign) return [];
    const currentTask = tasks.find(t => t.id === taskToAssign.id);
    return currentTask?.assignments || [];
  }, [tasks, taskToAssign]);

  const handleAssign = (value: string) => {
    if (!taskToAssign || !value) return;
    
    // Check if already assigned using memoized current assignments
    const alreadyAssigned = currentAssignments.some(
      a => a.staffProfile.id === value
    );
    
    if (alreadyAssigned) {
      toast({
        title: "Already Assigned",
        description: "This staff member is already assigned to this task.",
        variant: "destructive",
      });
      return;
    }
    
    onAssign(taskToAssign.id, value);
  };

  return (
    <div className="py-4 space-y-4">
      {/* Current Assignments */}
      {currentAssignments.length > 0 && (
        <div className="space-y-2">
          <Label>Currently Assigned Staff</Label>
          <div className="flex flex-wrap gap-2">
            {currentAssignments.map(assignment => (
              <Badge
                key={assignment.id}
                variant="secondary"
                className="pl-3 pr-1 py-1 gap-1 flex items-center"
                data-testid={`badge-assigned-${assignment.staffProfile.id}`}
              >
                <span>{assignment.staffProfile.fullName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => taskToAssign && onUnassign(taskToAssign.id, assignment.staffProfile.id)}
                  data-testid={`button-unassign-${assignment.staffProfile.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Add Staff Member */}
      <div className="space-y-2">
        <Label htmlFor="staff-select">Add Staff Member</Label>
        <Select value="" onValueChange={handleAssign}>
          <SelectTrigger id="staff-select" data-testid="select-assign-staff">
            <SelectValue placeholder="Select a staff member to add" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={5} data-testid="select-staff-content">
            {staffList?.map(staff => (
              <SelectItem key={staff.id} value={staff.id} data-testid={`select-staff-option-${staff.id}`}>
                {staff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showEditProject, setShowEditProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignments | null>(null);
  const [showDeleteTask, setShowDeleteTask] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithAssignments | null>(null);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState<TaskWithAssignments | null>(null);

  const { data: projectData, isLoading} = useQuery<{
    project: { id: string; name: string; status: string; description: string | null; clientId: string; createdAt: string };
    tasks: TaskWithAssignments[];
  }>({
    queryKey: ["/api/agency/projects", id],
    enabled: !!id,
  });

  const { data: staffList } = useQuery<StaffListItem[]>({
    queryKey: ["/api/agency/staff"],
  });

  const { data: clients } = useQuery<Array<{ id: string; companyName: string }>>({
    queryKey: ["/api/agency/clients"],
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/agency/tasks/${taskId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id] });
      toast({
        title: "Task Deleted",
        description: "The task has been successfully deleted.",
      });
      setShowDeleteTask(false);
      setTaskToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignStaffMutation = useMutation({
    mutationFn: async ({ taskId, staffProfileId }: { taskId: string; staffProfileId: string }) => {
      return await apiRequest("POST", `/api/agency/tasks/${taskId}/assign`, { staffProfileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id] });
      toast({
        title: "Staff Assigned",
        description: "Staff member has been successfully assigned to the task.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unassignStaffMutation = useMutation({
    mutationFn: async ({ taskId, staffProfileId }: { taskId: string; staffProfileId: string }) => {
      return await apiRequest("DELETE", `/api/agency/tasks/${taskId}/assign/${staffProfileId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id] });
      toast({
        title: "Staff Unassigned",
        description: "Staff member has been successfully removed from the task.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteTask = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete.id);
    }
  };

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

  const { project, tasks } = projectData;
  const client = clients?.find(c => c.id === project?.clientId);

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
              {client?.companyName || "Unknown Client"}
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
            <Button onClick={() => setShowCreateTask(true)} data-testid="button-add-task">
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
              {tasks.map(task => (
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
                          <Badge className={getPriorityColor(task.priority || 'Medium')} data-testid={`badge-task-priority-${task.id}`}>
                            {task.priority || 'Medium'}
                          </Badge>
                        </div>
                        
                        {task.dueDate && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-task-due-${task.id}`}>
                            Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </p>
                        )}

                        {task.assignments && task.assignments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.assignments.map(assignment => (
                              <Badge
                                key={assignment.id}
                                variant="outline"
                                className="text-xs"
                                data-testid={`badge-assigned-${assignment.staffProfile.id}`}
                              >
                                {assignment.staffProfile.fullName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setTaskToAssign(task);
                            setShowAssignStaff(true);
                          }}
                          data-testid={`button-assign-staff-${task.id}`}
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowEditTask(true);
                          }}
                          data-testid={`button-edit-task-${task.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setTaskToDelete(task);
                            setShowDeleteTask(true);
                          }}
                          data-testid={`button-delete-task-${task.id}`}
                        >
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

      <CreateTaskDialog 
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultProjectId={id}
      />

      <EditTaskDialog 
        open={showEditTask}
        onOpenChange={setShowEditTask}
        task={selectedTask}
        projectId={id}
      />

      <AlertDialog open={showDeleteTask} onOpenChange={setShowDeleteTask}>
        <AlertDialogContent data-testid="dialog-delete-task">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-task">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete-task"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAssignStaff} onOpenChange={setShowAssignStaff}>
        <AlertDialogContent data-testid="dialog-assign-staff">
          <AlertDialogHeader>
            <AlertDialogTitle>Manage Staff Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Assign or remove staff members from this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AssignmentDialogBody 
            taskToAssign={taskToAssign}
            tasks={tasks}
            staffList={staffList}
            onAssign={(taskId, staffProfileId) => assignStaffMutation.mutate({ taskId, staffProfileId })}
            onUnassign={(taskId, staffProfileId) => unassignStaffMutation.mutate({ taskId, staffProfileId })}
          />
          
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-assign-staff">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
