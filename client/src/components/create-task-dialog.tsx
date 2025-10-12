import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Project } from "@shared/schema";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

export function CreateTaskDialog({ open, onOpenChange, defaultProjectId }: CreateTaskDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [status, setStatus] = useState("Pending");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { 
      description: string; 
      projectId: string; 
      status: string; 
      priority: string;
      dueDate: string | null;
    }) => {
      return await apiRequest("POST", "/api/agency/tasks", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", variables.projectId] });
      toast({
        title: "Task Created",
        description: "The task has been successfully created.",
      });
      handleClose();
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

    if (!projectId) {
      toast({
        title: "Validation Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate({
      description: description.trim(),
      projectId,
      status,
      priority,
      dueDate: dueDate || null,
    });
  };

  const handleClose = () => {
    setDescription("");
    setProjectId(defaultProjectId || "");
    setStatus("Pending");
    setPriority("Medium");
    setDueDate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-create-task">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to a project. Tasks track specific action items and deliverables.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-description">
                Task Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="task-description"
                data-testid="input-task-description"
                placeholder="Design homepage mockups for client review..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-project">
                Project <span className="text-destructive">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger id="task-project" data-testid="select-task-project">
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
                <Label htmlFor="task-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="task-status" data-testid="select-task-status">
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
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="task-priority" data-testid="select-task-priority">
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
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                data-testid="input-task-due-date"
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
              onClick={handleClose}
              data-testid="button-cancel-task"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTaskMutation.isPending}
              data-testid="button-create-task"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
