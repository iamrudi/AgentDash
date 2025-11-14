import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TaskList } from "@shared/schema";

const taskListSchema = z.object({
  name: z.string().min(1, "List name is required"),
});

type TaskListFormData = z.infer<typeof taskListSchema>;

interface EditTaskListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskList: TaskList | null;
  projectId: string;
}

export function EditTaskListDialog({ open, onOpenChange, taskList, projectId }: EditTaskListDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TaskListFormData>({
    resolver: zodResolver(taskListSchema),
    defaultValues: {
      name: taskList?.name || "",
    },
  });

  useEffect(() => {
    if (taskList) {
      form.reset({
        name: taskList.name,
      });
    }
  }, [taskList, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TaskListFormData) => {
      if (!taskList) throw new Error("No task list selected");
      return await apiRequest("PATCH", `/api/agency/task-lists/${taskList.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId, "lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      toast({
        title: "List Updated",
        description: "Task list has been successfully updated.",
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

  const onSubmit = async (data: TaskListFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-task-list">
        <DialogHeader>
          <DialogTitle>Edit Task List</DialogTitle>
          <DialogDescription>
            Update the task list name.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">List Name</Label>
            <Input
              id="list-name"
              placeholder="e.g., To Do, In Progress, Done"
              {...form.register("name")}
              data-testid="input-list-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel-edit-list"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-edit-list"
            >
              {isSubmitting ? "Updating..." : "Update List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
