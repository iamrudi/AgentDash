import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Project, Task } from "@shared/schema";
import { format } from "date-fns";

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projectId?: string;
}

export function EditTaskDialog({ open, onOpenChange, task, projectId }: EditTaskDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [status, setStatus] = useState("Pending");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  useEffect(() => {
    if (task) {
      setDescription(task.description);
      setTaskProjectId(task.projectId);
      setStatus(task.status);
      setPriority(task.priority || "Medium");
      if (task.dueDate) {
        setDueDate(format(new Date(task.dueDate), "yyyy-MM-dd"));
      } else {
        setDueDate("");
      }
    }
  }, [task]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { 
      description: string; 
      projectId: string; 
      status: string; 
      priority: string;
      dueDate: string | null;
    }) => {
      return await apiRequest("PATCH", `/api/agency/tasks/${task?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      }
      toast({
        title: "Task Updated",
        description: "The task has been successfully updated.",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast({
        title: "Validation Error",
        description: "Task description is required",
        variant: "destructive",
      });
      return;
    }

    if (!taskProjectId) {
      toast({
        title: "Validation Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    updateTaskMutation.mutate({
      description: description.trim(),
      projectId: taskProjectId,
      status,
      priority,
      dueDate: dueDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-edit-task">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details, status, priority, or reassign to a different project.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-task-description">
                Task Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="edit-task-description"
                data-testid="textarea-edit-task-description"
                placeholder="Design homepage mockups for client review..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-task-project">
                Project <span className="text-destructive">*</span>
              </Label>
              <Select value={taskProjectId} onValueChange={setTaskProjectId} required>
                <SelectTrigger id="edit-task-project" data-testid="select-edit-task-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-task-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="edit-task-status" data-testid="select-edit-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-task-priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="edit-task-priority" data-testid="select-edit-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-task-due-date">Due Date</Label>
              <Input
                id="edit-task-due-date"
                data-testid="input-edit-task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit-task"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateTaskMutation.isPending}
              data-testid="button-update-task"
            >
              {updateTaskMutation.isPending ? "Updating..." : "Update Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
