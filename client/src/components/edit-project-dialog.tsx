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
import { Client } from "@shared/schema";

// Type for project from API (dates as strings)
type ProjectFromAPI = {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  status: string;
  createdAt: string;
};

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectFromAPI | null;
}

export function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("Active");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setClientId(project.clientId);
      setStatus(project.status);
    }
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; clientId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/agency/projects/${project?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", project?.id] });
      toast({
        title: "Project Updated",
        description: "The project has been successfully updated.",
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
    
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Validation Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    updateProjectMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      clientId,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-edit-project">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details, status, or reassign to a different client.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-project-name"
                data-testid="input-edit-project-name"
                placeholder="Website Redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-project-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger id="edit-project-client" data-testid="select-edit-project-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-project-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-project-status" data-testid="select-edit-project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                data-testid="textarea-edit-project-description"
                placeholder="Brief description of the project scope and objectives"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit-project"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProjectMutation.isPending}
              data-testid="button-update-project"
            >
              {updateProjectMutation.isPending ? "Updating..." : "Update Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
