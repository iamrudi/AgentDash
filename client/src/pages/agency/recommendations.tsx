import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Initiative, Client } from "@shared/schema";
import { Lightbulb, Send, Building2, Edit, MessageSquare, ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ClientFilter } from "@/components/client-filter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export default function AgencyRecommendationsPage() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  
  const { data: initiatives } = useQuery<Initiative[]>({
    queryKey: ["/api/agency/initiatives"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const [editForm, setEditForm] = useState({
    title: "",
    observation: "",
    proposedAction: "",
    cost: "",
    impact: "Medium"
  });
  const [createForm, setCreateForm] = useState({
    title: "",
    observation: "",
    proposedAction: "",
    cost: "",
    impact: "Medium",
    clientId: ""
  });

  // Filter initiatives based on selected client
  const filteredInitiatives = selectedClientId === "ALL"
    ? initiatives
    : initiatives?.filter(i => i.clientId === selectedClientId);

  const editMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<{ title: string; observation: string; proposedAction: string; cost: string; impact: string }> }) => {
      return await apiRequest("PATCH", `/api/initiatives/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/initiatives"] });
      setEditingId(null);
      toast({
        title: "Initiative updated",
        description: "Changes saved successfully.",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (initiativeId: string) => {
      return await apiRequest("POST", `/api/initiatives/${initiativeId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/initiatives"] });
      toast({
        title: "Initiative sent",
        description: "The initiative has been sent to the client.",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; observation: string; proposedAction: string; cost: string; impact: string; clientId: string; status: string; sentToClient: string }) => {
      return await apiRequest("POST", "/api/initiatives", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/initiatives"] });
      setIsCreating(false);
      setCreateForm({
        title: "",
        observation: "",
        proposedAction: "",
        cost: "",
        impact: "Medium",
        clientId: ""
      });
      toast({
        title: "Initiative created",
        description: "The manual initiative has been created successfully.",
      });
    },
  });

  // Mark initiative responses as viewed when page loads
  useEffect(() => {
    const markViewed = async () => {
      try {
        await apiRequest("POST", "/api/agency/initiatives/mark-viewed");
        // Invalidate notification counts to update the sidebar badge
        queryClient.invalidateQueries({ queryKey: ["/api/agency/notifications/counts"] });
      } catch (error) {
        // Silently fail - not critical
        console.error("Failed to mark initiatives as viewed:", error);
      }
    };

    markViewed();
  }, []); // Run once on mount

  const openEditDialog = (init: Initiative) => {
    setEditingId(init.id);
    setEditForm({
      title: init.title,
      observation: init.observation,
      proposedAction: init.proposedAction,
      cost: init.cost || "",
      impact: init.impact || "Medium"
    });
  };

  const handleSave = () => {
    if (!editingId) return;
    editMutation.mutate({
      id: editingId,
      updates: editForm
    });
  };

  const handleSendToClient = (id: string) => {
    sendMutation.mutate(id);
  };

  const handleCreate = () => {
    if (!createForm.clientId || !createForm.title || !createForm.observation || !createForm.proposedAction) {
      return;
    }
    
    createMutation.mutate({
      ...createForm,
      status: "Draft",
      sentToClient: "false"
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Draft": return "secondary";
      case "Sent": return "default";
      case "Approved": return "default";
      case "Rejected": return "destructive";
      case "Discussing": return "outline";
      default: return "secondary";
    }
  };

  const getResponseIcon = (response: string | null) => {
    switch (response) {
      case "approved": return <ThumbsUp className="h-4 w-4" />;
      case "rejected": return <ThumbsDown className="h-4 w-4" />;
      case "discussing": return <MessageSquare className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">AI Recommendations</h1>
            <p className="text-muted-foreground">
              Edit, approve, and send AI-powered recommendations to clients
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ClientFilter
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-recommendation">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Manual Recommendation
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Manual Recommendation</DialogTitle>
                <DialogDescription>
                  Create a new recommendation for a client
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="create-client">Client</Label>
                  <Select value={createForm.clientId} onValueChange={(value) => setCreateForm({ ...createForm, clientId: value })}>
                    <SelectTrigger data-testid="select-create-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-title">Title</Label>
                  <Input
                    id="create-title"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="Recommendation title"
                    data-testid="input-create-title"
                  />
                </div>
                <div>
                  <Label htmlFor="create-observation">Observation</Label>
                  <Textarea
                    id="create-observation"
                    value={createForm.observation}
                    onChange={(e) => setCreateForm({ ...createForm, observation: e.target.value })}
                    placeholder="What did you observe?"
                    rows={3}
                    data-testid="textarea-create-observation"
                  />
                </div>
                <div>
                  <Label htmlFor="create-proposedAction">Proposed Action</Label>
                  <Textarea
                    id="create-proposedAction"
                    value={createForm.proposedAction}
                    onChange={(e) => setCreateForm({ ...createForm, proposedAction: e.target.value })}
                    placeholder="What action do you propose?"
                    rows={3}
                    data-testid="textarea-create-action"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-cost">Estimated Cost</Label>
                    <Input
                      id="create-cost"
                      value={createForm.cost}
                      onChange={(e) => setCreateForm({ ...createForm, cost: e.target.value })}
                      placeholder="5000"
                      data-testid="input-create-cost"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-impact">Impact Level</Label>
                    <Select value={createForm.impact} onValueChange={(value) => setCreateForm({ ...createForm, impact: value })}>
                      <SelectTrigger data-testid="select-create-impact">
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
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!createForm.clientId || !createForm.title || !createForm.observation || !createForm.proposedAction || createMutation.isPending}
                    data-testid="button-save-create"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Recommendation"}
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {!filteredInitiatives || filteredInitiatives.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recommendations available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredInitiatives.map((rec) => {
              const client = clients?.find(c => c.id === rec.clientId);
              const canEdit = rec.status === "Draft" || rec.status === "Needs Review";
              // Handle both string "true" and boolean true (defensive check for API inconsistencies)
              const isSent = rec.sentToClient === "true" || (rec.sentToClient as unknown) === true;
              
              return (
                <Card key={rec.id} data-testid={`recommendation-${rec.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{client?.companyName || "Unknown Client"}</span>
                          <Badge variant={getStatusVariant(rec.status)}>
                            {rec.status}
                          </Badge>
                          {rec.clientResponse && (
                            <Badge variant="outline" className="gap-1">
                              {getResponseIcon(rec.clientResponse)}
                              {rec.clientResponse}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Dialog open={editingId === rec.id} onOpenChange={(open) => !open && setEditingId(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(rec)}
                                data-testid={`button-edit-${rec.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Edit Recommendation</DialogTitle>
                                <DialogDescription>
                                  Edit the recommendation details before sending to client
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="title">Title</Label>
                                  <Input
                                    id="title"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    placeholder="Recommendation title"
                                    data-testid="input-edit-title"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="observation">Observation</Label>
                                  <Textarea
                                    id="observation"
                                    value={editForm.observation}
                                    onChange={(e) => setEditForm({ ...editForm, observation: e.target.value })}
                                    placeholder="What did you observe?"
                                    rows={3}
                                    data-testid="textarea-edit-observation"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="proposedAction">Proposed Action</Label>
                                  <Textarea
                                    id="proposedAction"
                                    value={editForm.proposedAction}
                                    onChange={(e) => setEditForm({ ...editForm, proposedAction: e.target.value })}
                                    placeholder="What action do you propose?"
                                    rows={3}
                                    data-testid="textarea-edit-action"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="cost">Estimated Cost</Label>
                                    <Input
                                      id="cost"
                                      value={editForm.cost}
                                      onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                                      placeholder="5000"
                                      data-testid="input-edit-cost"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="impact">Impact Level</Label>
                                    <Select value={editForm.impact} onValueChange={(value) => setEditForm({ ...editForm, impact: value })}>
                                      <SelectTrigger data-testid="select-edit-impact">
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
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleSave}
                                    disabled={!editForm.title || !editForm.observation || !editForm.proposedAction || editMutation.isPending}
                                    data-testid="button-save-edit"
                                  >
                                    {editMutation.isPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        {canEdit && !isSent && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSendToClient(rec.id)}
                            disabled={sendMutation.isPending}
                            data-testid={`button-send-${rec.id}`}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send to Client
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rec.observation && (
                      <div>
                        <p className="text-sm font-medium mb-1">Observation</p>
                        <p className="text-sm text-muted-foreground">{rec.observation}</p>
                      </div>
                    )}
                    {rec.proposedAction && (
                      <div>
                        <p className="text-sm font-medium mb-1">Proposed Action</p>
                        <p className="text-sm text-muted-foreground">{rec.proposedAction}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      {rec.cost && (
                        <div>
                          <span className="font-medium">Cost:</span> ${rec.cost}
                        </div>
                      )}
                      {rec.impact && (
                        <div>
                          <span className="font-medium">Impact:</span> {rec.impact}
                        </div>
                      )}
                    </div>
                    {isSent && rec.clientFeedback && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-1">Client Feedback</p>
                        <p className="text-sm text-muted-foreground">{rec.clientFeedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
