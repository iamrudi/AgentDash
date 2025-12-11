import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ClientFilter } from "@/components/client-filter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, BookOpen, Archive, History, AlertCircle, FileText, Clock, Edit } from "lucide-react";
import { format } from "date-fns";
import type { Client, KnowledgeCategory, ClientKnowledge, KnowledgeIngestionLog } from "@shared/schema";

interface KnowledgeForm {
  clientId: string;
  categoryId: string;
  title: string;
  content: string;
  source: string;
  confidenceScore: number;
  validFrom: string;
  validUntil: string;
}

const defaultForm: KnowledgeForm = {
  clientId: "",
  categoryId: "",
  title: "",
  content: "",
  source: "",
  confidenceScore: 80,
  validFrom: "",
  validUntil: "",
};

export default function KnowledgeManagement() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<ClientKnowledge | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyKnowledgeId, setHistoryKnowledgeId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(defaultForm);
  const [activeTab, setActiveTab] = useState("active");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<KnowledgeCategory[]>({
    queryKey: ["/api/knowledge/categories"],
  });

  const { data: knowledge = [], isLoading: knowledgeLoading } = useQuery<ClientKnowledge[]>({
    queryKey: ["/api/knowledge", { clientId: selectedClientId, categoryId: selectedCategoryId, status: activeTab }],
  });

  const { data: ingestionHistory = [] } = useQuery<KnowledgeIngestionLog[]>({
    queryKey: ["/api/knowledge/ingestion-history", historyKnowledgeId],
    enabled: !!historyKnowledgeId,
  });

  const initializeCategoriesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/knowledge/categories/initialize");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/categories"] });
      toast({ title: "Success", description: "Default categories initialized" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createKnowledgeMutation = useMutation({
    mutationFn: async (data: KnowledgeForm) => {
      return await apiRequest("POST", "/api/knowledge", {
        ...data,
        confidenceScore: Number(data.confidenceScore) / 100, // Convert percentage to 0-1 scale
        validFrom: data.validFrom || undefined,
        validUntil: data.validUntil || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      setIsCreating(false);
      setForm(defaultForm);
      toast({ title: "Success", description: "Knowledge created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<KnowledgeForm> }) => {
      return await apiRequest("PATCH", `/api/knowledge/${id}`, {
        ...data,
        confidenceScore: data.confidenceScore ? Number(data.confidenceScore) / 100 : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      setIsEditing(false);
      setEditingKnowledge(null);
      setForm(defaultForm);
      toast({ title: "Success", description: "Knowledge updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const archiveKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/knowledge/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({ title: "Success", description: "Knowledge archived successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!form.clientId || !form.categoryId || !form.title || !form.content) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createKnowledgeMutation.mutate(form);
  };

  const handleEdit = (item: ClientKnowledge) => {
    setEditingKnowledge(item);
    // Convert confidence score from 0-1 API scale to 0-100 UI scale
    const rawScore = Number(item.confidenceScore) || 0.8;
    const uiScore = rawScore <= 1 ? rawScore * 100 : rawScore; // Handle both scales
    setForm({
      clientId: item.clientId || "",
      categoryId: item.categoryId,
      title: item.title,
      content: item.content || "",
      source: item.source || "",
      confidenceScore: Math.round(uiScore),
      validFrom: item.validFrom ? format(new Date(item.validFrom), "yyyy-MM-dd") : "",
      validUntil: item.validUntil ? format(new Date(item.validUntil), "yyyy-MM-dd") : "",
    });
    setIsEditing(true);
  };

  const handleUpdate = () => {
    if (!editingKnowledge) return;
    updateKnowledgeMutation.mutate({ id: editingKnowledge.id, data: form });
  };

  const handleViewHistory = (id: string) => {
    setHistoryKnowledgeId(id);
    setShowHistory(true);
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Agency-wide";
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || "Unknown Client";
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.displayName || category?.name || "Unknown Category";
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "active": return "default";
      case "archived": return "secondary";
      case "superseded": return "outline";
      default: return "default";
    }
  };

  const filteredKnowledge = knowledge.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClient = selectedClientId === "ALL" || item.clientId === selectedClientId;
    const matchesCategory = selectedCategoryId === "ALL" || item.categoryId === selectedCategoryId;
    return matchesSearch && matchesClient && matchesCategory;
  });

  const activeCategories = categories.filter(c => c.isActive);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Brand Knowledge</h1>
          <p className="text-muted-foreground">
            Manage client knowledge for AI recommendations
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {categories.length === 0 && !categoriesLoading && (
            <Button
              variant="outline"
              onClick={() => initializeCategoriesMutation.mutate()}
              disabled={initializeCategoriesMutation.isPending}
              data-testid="button-initialize-categories"
            >
              {initializeCategoriesMutation.isPending ? "Initializing..." : "Initialize Categories"}
            </Button>
          )}
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-knowledge">
                <Plus className="h-4 w-4 mr-2" />
                Add Knowledge
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Knowledge Entry</DialogTitle>
                <DialogDescription>
                  Add a new piece of client knowledge for AI context
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-client">Client *</Label>
                    <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                      <SelectTrigger data-testid="select-create-client">
                        <SelectValue placeholder="Select client" />
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
                  <div>
                    <Label htmlFor="create-category">Category *</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger data-testid="select-create-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.displayName || cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="create-title">Title *</Label>
                  <Input
                    id="create-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Knowledge title"
                    data-testid="input-create-title"
                  />
                </div>
                <div>
                  <Label htmlFor="create-content">Content *</Label>
                  <Textarea
                    id="create-content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Enter the knowledge content..."
                    rows={6}
                    data-testid="textarea-create-content"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-source">Source</Label>
                    <Input
                      id="create-source"
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      placeholder="e.g., Client meeting, Brand guide"
                      data-testid="input-create-source"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-confidence">Confidence (%)</Label>
                    <Input
                      id="create-confidence"
                      type="number"
                      min={0}
                      max={100}
                      value={form.confidenceScore}
                      onChange={(e) => setForm({ ...form, confidenceScore: Number(e.target.value) })}
                      data-testid="input-create-confidence"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-validfrom">Valid From</Label>
                    <Input
                      id="create-validfrom"
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                      data-testid="input-create-validfrom"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-validuntil">Valid Until</Label>
                    <Input
                      id="create-validuntil"
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                      data-testid="input-create-validuntil"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!form.clientId || !form.categoryId || !form.title || !form.content || createKnowledgeMutation.isPending}
                    data-testid="button-submit-knowledge"
                  >
                    {createKnowledgeMutation.isPending ? "Creating..." : "Create Knowledge"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-knowledge"
            />
          </div>
        </div>
        <ClientFilter
          clients={clients}
          selectedClientId={selectedClientId}
          onClientChange={setSelectedClientId}
        />
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {activeCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.displayName || cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            <BookOpen className="h-4 w-4 mr-2" />
            Active
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived">
            <Archive className="h-4 w-4 mr-2" />
            Archived
          </TabsTrigger>
          <TabsTrigger value="superseded" data-testid="tab-superseded">
            <History className="h-4 w-4 mr-2" />
            Superseded
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {knowledgeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredKnowledge.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No knowledge entries found</p>
                <p className="text-sm">Add knowledge to help AI generate better recommendations</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKnowledge.map((item) => (
                <Card key={item.id} className="hover-elevate" data-testid={`card-knowledge-${item.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-1">
                      {getClientName(item.clientId)} • {getCategoryName(item.categoryId)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {item.content || "No content"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      {item.confidenceScore && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {Number(item.confidenceScore) * 100}% confidence
                        </span>
                      )}
                      {item.source && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {item.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "Unknown"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleViewHistory(item.id)}
                          data-testid={`button-history-${item.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {item.status === "active" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  data-testid={`button-archive-${item.id}`}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Archive Knowledge</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will archive "{item.title}". Archived knowledge won't be used in AI context but can be restored.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => archiveKnowledgeMutation.mutate(item.id)}
                                    data-testid={`button-confirm-archive-${item.id}`}
                                  >
                                    Archive
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Knowledge Entry</DialogTitle>
            <DialogDescription>
              Update the knowledge entry details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content *</Label>
              <Textarea
                id="edit-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                data-testid="textarea-edit-content"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-source">Source</Label>
                <Input
                  id="edit-source"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  data-testid="input-edit-source"
                />
              </div>
              <div>
                <Label htmlFor="edit-confidence">Confidence (%)</Label>
                <Input
                  id="edit-confidence"
                  type="number"
                  min={0}
                  max={100}
                  value={form.confidenceScore}
                  onChange={(e) => setForm({ ...form, confidenceScore: Number(e.target.value) })}
                  data-testid="input-edit-confidence"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditingKnowledge(null); }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!form.title || !form.content || updateKnowledgeMutation.isPending}
                data-testid="button-update-knowledge"
              >
                {updateKnowledgeMutation.isPending ? "Updating..." : "Update Knowledge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingestion History</DialogTitle>
            <DialogDescription>
              View the change history for this knowledge entry
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] mt-4">
            {ingestionHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No history found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingestionHistory.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={log.action === "created" ? "default" : log.action === "updated" ? "secondary" : "outline"}>
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.performedAt ? format(new Date(log.performedAt), "MMM d, yyyy h:mm a") : "Unknown"}
                        </span>
                      </div>
                      {log.changeDescription && (
                        <p className="text-sm text-muted-foreground">{log.changeDescription}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {log.validationStatus}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
