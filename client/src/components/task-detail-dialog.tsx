import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { Task, Profile, StaffAssignment } from "@shared/schema";
import {
  TaskStatusControl,
  TaskPriorityControl,
  TaskDateControl,
  TaskAssigneesControl,
} from "./task-inline-editors";

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

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      if (!task) return;
      return await apiRequest("PATCH", `/api/agency/tasks/${task.id}`, {
        description: newDescription,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
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
      return await apiRequest("DELETE", `/api/agency/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
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

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0" data-testid="dialog-task-detail">
          <DialogHeader className="px-6 pt-6 pb-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <DialogTitle className="text-xl" data-testid="text-task-title">Task Details</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground" data-testid="text-task-type">
                  {task.listId ? `List Task` : task.parentId ? `Subtask` : `Unassigned Task`}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-dialog"
              >
                <X className="h-4 w-4" />
              </Button>
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
          </DialogHeader>

          <Separator />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <TaskDateControl
                        task={task}
                        projectId={projectId}
                        dateType="dueDate"
                      />
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

              <TabsContent value="subtasks" className="p-6 m-0">
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Subtask management coming soon...</p>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="p-6 m-0">
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Activity tracking coming soon...</p>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <Separator />

          <div className="px-6 py-4 flex items-center justify-between">
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
        </DialogContent>
      </Dialog>

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
    </>
  );
}
