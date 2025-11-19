import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskRelationshipWithTask } from "@shared/schema";

interface TaskRelationshipsProps {
  task: Task;
  projectId: string;
}

const relationshipTypeLabels: Record<string, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  relates_to: "Relates to",
  duplicates: "Duplicates",
};

const relationshipTypeVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  blocks: "destructive",
  blocked_by: "destructive",
  relates_to: "secondary",
  duplicates: "outline",
};

export function TaskRelationships({ task, projectId }: TaskRelationshipsProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("");

  // Fetch relationships for this task
  const { data: relationships = [], isLoading } = useQuery<TaskRelationshipWithTask[]>({
    queryKey: ["/api/tasks", task.id, "relationships"],
    enabled: !!task.id,
  });

  // Fetch all tasks in project for selection (could be optimized to exclude already related tasks)
  const { data: projectData } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/agency/projects", projectId],
  });

  const availableTasks = projectData?.tasks?.filter(t => t.id !== task.id) || [];

  // Add relationship mutation
  const addMutation = useMutation({
    mutationFn: async ({ relatedTaskId, relationshipType }: { relatedTaskId: string; relationshipType: string }) => {
      return await apiRequest("POST", `/api/tasks/${task.id}/relationships`, {
        relatedTaskId,
        relationshipType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      setShowAddDialog(false);
      setSelectedTaskId("");
      setRelationshipType("");
      toast({
        title: "Relationship added",
        description: "Task relationship has been created.",
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

  // Remove relationship mutation
  const removeMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return await apiRequest("DELETE", `/api/tasks/relationships/${relationshipId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      toast({
        title: "Relationship removed",
        description: "Task relationship has been deleted.",
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

  const handleAddRelationship = () => {
    if (!selectedTaskId || !relationshipType) {
      toast({
        title: "Validation error",
        description: "Please select a task and relationship type.",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ relatedTaskId: selectedTaskId, relationshipType });
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading relationships...</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Related Tasks</label>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-relationship">
              <Plus className="h-4 w-4 mr-1" />
              Add Relationship
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-relationship">
            <DialogHeader>
              <DialogTitle>Add Task Relationship</DialogTitle>
              <DialogDescription>
                Link this task to another task to show dependencies or connections.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Relationship Type</label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger data-testid="select-relationship-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blocks">Blocks</SelectItem>
                    <SelectItem value="blocked_by">Blocked by</SelectItem>
                    <SelectItem value="relates_to">Relates to</SelectItem>
                    <SelectItem value="duplicates">Duplicates</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Related Task</label>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger data-testid="select-related-task">
                    <SelectValue placeholder="Select task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.description.length > 50 
                          ? t.description.substring(0, 50) + "..."
                          : t.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setSelectedTaskId("");
                  setRelationshipType("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRelationship}
                disabled={!selectedTaskId || !relationshipType || addMutation.isPending}
                data-testid="button-confirm-add-relationship"
              >
                {addMutation.isPending ? "Adding..." : "Add Relationship"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {relationships.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          No related tasks. Click "Add Relationship" to link this task to another.
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center gap-3 p-3 rounded-md border bg-card hover-elevate"
              data-testid={`relationship-item-${rel.id}`}
            >
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Badge variant={relationshipTypeVariants[rel.relationshipType]} className="shrink-0">
                {relationshipTypeLabels[rel.relationshipType]}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" data-testid={`text-related-task-${rel.id}`}>
                  {rel.relatedTask.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rel.relatedTask.status}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMutation.mutate(rel.id)}
                disabled={removeMutation.isPending}
                data-testid={`button-remove-relationship-${rel.id}`}
                className="h-8 w-8 p-0 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
