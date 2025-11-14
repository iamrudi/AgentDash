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
import { Project, TaskList } from "@shared/schema";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  defaultListId?: string;
}

export function CreateTaskDialog({ open, onOpenChange, defaultProjectId, defaultListId }: CreateTaskDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [listId, setListId] = useState("");
  const [status, setStatus] = useState("To Do");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const { data: taskLists = [] } = useQuery<TaskList[]>({
    queryKey: ["/api/agency/projects", projectId, "lists"],
    enabled: !!projectId,
  });

  // Set listId from defaultListId only when dialog opens
  useEffect(() => {
    if (open && defaultListId) {
      setListId(defaultListId);
    }
  }, [open, defaultListId]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: { 
      description: string; 
      projectId: string; 
      listId: string | null;
      status: string; 
      priority: string;
      dueDate: string | null;
    }) => {
      return await apiRequest("POST", "/api/agency/tasks", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", variables.projectId, "lists"] });
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

    // Validate listId belongs to selected project if both are set
    if (listId) {
      const listBelongsToProject = taskLists.some(list => list.id === listId);
      if (!listBelongsToProject) {
        toast({
          title: "Validation Error",
          description: "Selected list does not belong to the selected project",
          variant: "destructive",
        });
        return;
      }
    }

    createTaskMutation.mutate({
      description: description.trim(),
      projectId,
      listId: listId || null,
      status,
      priority,
      dueDate: dueDate || null,
    });
  };

  const handleClose = () => {
    setDescription("");
    setProjectId(defaultProjectId || "");
    setListId("");
    setStatus("To Do");
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
              <Select value={projectId} onValueChange={(value) => {
                setProjectId(value);
                // Reset listId when project changes as lists belong to projects
                setListId("");
              }} required>
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

            <div className="grid gap-2">
              <Label htmlFor="task-list">Task List</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger id="task-list" data-testid="select-task-list">
                  <SelectValue placeholder="Select a list (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.length === 0 ? (
                    <SelectItem value="no-lists" disabled>No lists available</SelectItem>
                  ) : (
                    taskLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))
                  )}
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
                    <SelectItem value="To Do">To Do</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
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
                    <SelectItem value="Urgent">Urgent</SelectItem>
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
