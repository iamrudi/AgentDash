import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, X, Plus, Check, CornerDownRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import type { Task, Profile, StaffAssignment, TaskActivityWithUser } from "@shared/schema";
import {
  TaskStatusControl,
  TaskPriorityControl,
  TaskDateControl,
  TaskAssigneesControl,
  TaskTimeEstimateControl,
  TaskTimeTrackedControl,
} from "./task-inline-editors";
import { TaskMessages } from "./task-messages";
import { TaskRelationships } from "./task-relationships";

type TaskWithAssignments = Task & {
  assignments: Array<StaffAssignment & { staffProfile: Profile }>;
};

interface TaskDetailDialogProps {
  task: TaskWithAssignments | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignStaff: (task: TaskWithAssignments) => void;
}

export function TaskDetailDialog({
  task,
  projectId,
  open,
  onOpenChange,
  onAssignStaff,
}: TaskDetailDialogProps) {
  const { toast } = useToast();
  const authUser = getAuthUser();
  const [description, setDescription] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Sync description state when task changes (fixes render-time state update)
  useEffect(() => {
    if (task) {
      setDescription(task.description);
    }
  }, [task?.id, task?.description]);

  // Fetch staff for assignee control (tenant-scoped by backend middleware)
  const { data: staffProfiles = [] } = useQuery<Profile[]>({
    queryKey: ["/api/agency/staff"],
    enabled: open,
  });

  // Fetch subtasks
  const { data: subtasks = [], isLoading: subtasksLoading } = useQuery<TaskWithAssignments[]>({
    queryKey: ["/api/agency/tasks", task?.id, "subtasks"],
    enabled: open && !!task?.id,
  });

  // Fetch task activities (timeline)
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<TaskActivityWithUser[]>({
    queryKey: ["/api/agency/tasks", task?.id, "activities"],
    enabled: open && !!task?.id,
  });

  // State for new subtask form
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      if (!task) return;
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        description: newDescription,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
      toast({
        title: "Success",
        description: "Task description updated",
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

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      return await apiRequest("DELETE", `/api/tasks/${task.id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
      toast({
        title: "Success",
        description: "Task deleted",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create subtask mutation (uses Staff-accessible endpoint)
  const createSubtaskMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!task) throw new Error("No parent task");
      return await apiRequest("POST", `/api/tasks/${task.id}/subtasks`, {
        description,
        status: "To Do",
        priority: "Medium",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/tasks", task?.id, "subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      setNewSubtaskDescription("");
      toast({
        title: "Subtask created",
        description: "New subtask has been added.",
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

  // Toggle subtask status mutation (uses Staff-accessible endpoint)
  const toggleSubtaskStatusMutation = useMutation({
    mutationFn: async ({ subtaskId, currentStatus }: { subtaskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === "Completed" ? "To Do" : "Completed";
      return await apiRequest("PATCH", `/api/tasks/${subtaskId}`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/tasks", task?.id, "subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveDescription = () => {
    if (!task || description === task.description) return;
    updateDescriptionMutation.mutate(description);
  };

  const handleCancelDescription = () => {
    if (task) {
      setDescription(task.description);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] p-0 pr-6 flex flex-col overflow-hidden" data-testid="sheet-task-detail">
          {!task ? (
            <div className="flex items-center justify-center p-12">
              <p className="text-muted-foreground">Loading task details...</p>
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-10 pb-4 space-y-3 border-b">
                <div className="space-y-1">
                  <SheetTitle className="text-xl" data-testid="text-task-title">Task Details</SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground" data-testid="text-task-type">
                    {task.listId ? `List Task` : task.parentId ? `Subtask` : `Unassigned Task`}
                  </SheetDescription>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter task description..."
                    className="resize-none min-h-[80px]"
                    data-testid="input-task-description"
                  />
                  {description !== task.description && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={updateDescriptionMutation.isPending}
                    data-testid="button-save-description"
                  >
                    {updateDescriptionMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelDescription}
                    disabled={updateDescriptionMutation.isPending}
                    data-testid="button-cancel-description"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="px-6 py-2 bg-background rounded-none border-b justify-start">
              <TabsTrigger value="details" data-testid="tab-details">
                Details
              </TabsTrigger>
              <TabsTrigger value="subtasks" data-testid="tab-subtasks">
                Subtasks
              </TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">
                Activity
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">
                Messages
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="details" className="p-6 space-y-6 m-0">
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <TaskStatusControl task={task} projectId={projectId} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <TaskPriorityControl task={task} projectId={projectId} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <TaskDateControl
                        task={task}
                        projectId={projectId}
                        dateType="startDate"
                        label="Start"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <TaskDateControl
                        task={task}
                        projectId={projectId}
                        dateType="dueDate"
                        label="Due"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Time Estimate</label>
                      <TaskTimeEstimateControl task={task} projectId={projectId} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Time Tracked</label>
                      <TaskTimeTrackedControl task={task} projectId={projectId} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assignees</label>
                    <TaskAssigneesControl
                      task={task}
                      projectId={projectId}
                      onAssignStaff={onAssignStaff}
                    />
                  </div>

                  <Separator />

                  <TaskRelationships task={task} projectId={projectId} />

                  <Separator />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Task Information
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Created</div>
                      <div>{new Date(task.createdAt).toLocaleDateString()}</div>
                      
                      {task.parentId && (
                        <>
                          <div className="text-muted-foreground">Parent Task</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {task.parentId.slice(0, 8)}...
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subtasks" className="p-6 m-0 space-y-4">
                {/* Create subtask form */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={newSubtaskDescription}
                    onChange={(e) => setNewSubtaskDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSubtaskDescription.trim()) {
                        createSubtaskMutation.mutate(newSubtaskDescription);
                      }
                    }}
                    disabled={createSubtaskMutation.isPending}
                    data-testid="input-new-subtask"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newSubtaskDescription.trim()) {
                        createSubtaskMutation.mutate(newSubtaskDescription);
                      }
                    }}
                    disabled={!newSubtaskDescription.trim() || createSubtaskMutation.isPending}
                    data-testid="button-create-subtask"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Subtask list */}
                <div className="space-y-2">
                  {subtasksLoading ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Loading subtasks...
                    </div>
                  ) : subtasks.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No subtasks yet. Add one above to get started.
                    </div>
                  ) : (
                    subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-start gap-3 p-3 pl-4 rounded-md border bg-card/50 hover-elevate"
                        data-testid={`subtask-item-${subtask.id}`}
                      >
                        <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <Checkbox
                          checked={subtask.status === "Completed"}
                          onCheckedChange={() =>
                            toggleSubtaskStatusMutation.mutate({
                              subtaskId: subtask.id,
                              currentStatus: subtask.status,
                            })
                          }
                          disabled={toggleSubtaskStatusMutation.isPending}
                          data-testid={`checkbox-subtask-${subtask.id}`}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm ${
                                subtask.status === "Completed"
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }`}
                              data-testid={`text-subtask-description-${subtask.id}`}
                            >
                              {subtask.description}
                            </p>
                            <span className="text-xs text-muted-foreground/60 font-medium">
                              Subtask
                            </span>
                          </div>
                          {subtask.assignments.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {subtask.assignments.slice(0, 3).map((assignment) => (
                                <span
                                  key={assignment.id}
                                  className="text-xs text-muted-foreground"
                                >
                                  {assignment.staffProfile.fullName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="p-6 m-0 space-y-4">
                {activitiesLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Loading activities...
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No activity yet. Changes to this task will appear here.
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="task-activity-timeline">
                    {activities.map((activity) => {
                      const date = new Date(activity.createdAt);
                      const timeAgo = formatDistanceToNow(date, { addSuffix: true });
                      
                      // Format activity message based on action type
                      let message = '';
                      if (activity.action === 'status_changed') {
                        message = `changed status from "${activity.oldValue}" to "${activity.newValue}"`;
                      } else if (activity.action === 'priority_changed') {
                        message = `changed priority from "${activity.oldValue || 'None'}" to "${activity.newValue || 'None'}"`;
                      } else if (activity.action === 'date_changed') {
                        const fieldLabel = activity.fieldName === 'startDate' ? 'start date' : 'due date';
                        const hasOldValue = activity.oldValue && activity.oldValue.trim() !== '';
                        const hasNewValue = activity.newValue && activity.newValue.trim() !== '';
                        
                        if (hasOldValue && hasNewValue) {
                          const oldDate = format(new Date(activity.oldValue!), 'PP');
                          const newDate = format(new Date(activity.newValue!), 'PP');
                          message = `changed ${fieldLabel} from ${oldDate} to ${newDate}`;
                        } else if (hasNewValue) {
                          const newDate = format(new Date(activity.newValue!), 'PP');
                          message = `set ${fieldLabel} to ${newDate}`;
                        } else if (hasOldValue) {
                          const oldDate = format(new Date(activity.oldValue!), 'PP');
                          message = `cleared ${fieldLabel} (was ${oldDate})`;
                        } else {
                          message = `updated ${fieldLabel}`;
                        }
                      } else if (activity.action === 'description_changed') {
                        message = `updated the task description`;
                      } else if (activity.action === 'assignee_added') {
                        message = `added assignee: ${activity.newValue}`;
                      } else if (activity.action === 'assignee_removed') {
                        message = `removed assignee: ${activity.oldValue}`;
                      } else if (activity.action === 'subtask_created') {
                        message = `created subtask: "${activity.newValue}"`;
                      } else {
                        message = activity.action.replace(/_/g, ' ');
                      }

                      return (
                        <div key={activity.id} className="flex gap-3" data-testid={`activity-${activity.id}`}>
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                            {activities[activities.length - 1].id !== activity.id && (
                              <div className="w-px h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="text-sm">
                              <span className="font-medium">{activity.user.fullName}</span>
                              {' '}
                              <span className="text-muted-foreground">{message}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{timeAgo}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="messages" className="p-0 m-0 flex-1 flex flex-col">
                {authUser?.profile?.id && (
                  <TaskMessages taskId={task.id} currentUserId={authUser.profile.id} />
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="px-6 py-4 border-t flex items-center justify-between mt-auto">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-task"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </Button>

            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-dialog-footer"
            >
              Close
            </Button>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {task && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent data-testid="dialog-confirm-delete-task">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
                {task.parentId && " All subtasks will also be deleted."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
