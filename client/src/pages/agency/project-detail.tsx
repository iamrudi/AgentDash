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
import { TaskListContainer } from "@/components/task-list-container";
import { CreateTaskListDialog } from "@/components/create-task-list-dialog";
import { EditTaskListDialog } from "@/components/edit-task-list-dialog";
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
import type { Task, Profile, StaffAssignment, TaskList } from "@shared/schema";

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
  const [defaultListId, setDefaultListId] = useState<string | undefined>(undefined);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignments | null>(null);
  const [showDeleteTask, setShowDeleteTask] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithAssignments | null>(null);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState<TaskWithAssignments | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showEditList, setShowEditList] = useState(false);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [selectedList, setSelectedList] = useState<TaskList | null>(null);

  const { data: projectData, isLoading} = useQuery<{
    project: { id: string; name: string; status: string; description: string | null; clientId: string; createdAt: string };
    tasks: TaskWithAssignments[];
  }>({
    queryKey: ["/api/agency/projects", id],
    enabled: !!id,
  });

  const { data: taskLists, isLoading: listsLoading } = useQuery<TaskList[]>({
    queryKey: ["/api/agency/projects", id, "lists"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id, "lists"] });
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

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      return await apiRequest("DELETE", `/api/agency/task-lists/${listId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id, "lists"] });
      toast({
        title: "List Deleted",
        description: "Task list has been successfully deleted.",
      });
      setShowDeleteList(false);
      setSelectedList(null);
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
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id, "lists"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", id, "lists"] });
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

  const handleDeleteList = () => {
    if (selectedList) {
      deleteListMutation.mutate(selectedList.id);
    }
  };

  const handleCreateTaskForList = (listId: string) => {
    setDefaultListId(listId);
    setShowCreateTask(true);
  };

  if (isLoading || listsLoading) {
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

      {/* Task Lists Board */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Task Lists</h2>
            <p className="text-muted-foreground">
              {taskLists?.length || 0} {taskLists?.length === 1 ? 'list' : 'lists'} · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <Button onClick={() => setShowCreateList(true)} data-testid="button-add-list">
            <Plus className="w-4 h-4 mr-2" />
            Add List
          </Button>
        </div>

        {!taskLists || taskLists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No task lists yet. Create your first list to organize tasks.</p>
              <Button onClick={() => setShowCreateList(true)} data-testid="button-create-first-list">
                <Plus className="w-4 h-4 mr-2" />
                Create First List
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {taskLists.map(list => (
              <TaskListContainer
                key={list.id}
                taskList={list}
                tasks={tasks}
                onEditList={(listId) => {
                  const list = taskLists.find(l => l.id === listId);
                  if (list) {
                    setSelectedList(list);
                    setShowEditList(true);
                  }
                }}
                onDeleteList={(listId) => {
                  const list = taskLists.find(l => l.id === listId);
                  if (list) {
                    setSelectedList(list);
                    setShowDeleteList(true);
                  }
                }}
                onCreateTask={handleCreateTaskForList}
                onEditTask={(task) => {
                  setSelectedTask(task);
                  setShowEditTask(true);
                }}
                onDeleteTask={(task) => {
                  setTaskToDelete(task);
                  setShowDeleteTask(true);
                }}
                onAssignStaff={(task) => {
                  setTaskToAssign(task);
                  setShowAssignStaff(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <EditProjectDialog 
        open={showEditProject}
        onOpenChange={setShowEditProject}
        project={project}
      />

      <CreateTaskDialog 
        open={showCreateTask}
        onOpenChange={(open) => {
          setShowCreateTask(open);
          if (!open) setDefaultListId(undefined);
        }}
        defaultProjectId={id}
        defaultListId={defaultListId}
      />

      <CreateTaskListDialog
        open={showCreateList}
        onOpenChange={setShowCreateList}
        projectId={id || ""}
      />

      <EditTaskListDialog
        open={showEditList}
        onOpenChange={setShowEditList}
        taskList={selectedList}
        projectId={id || ""}
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

      <AlertDialog open={showDeleteList} onOpenChange={setShowDeleteList}>
        <AlertDialogContent data-testid="dialog-delete-list">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task list? All tasks in this list will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-list">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete-list"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
