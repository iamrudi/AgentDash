import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Send,
  Save,
  GripVertical,
  ChevronLeft,
  Loader2,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProposalTemplate {
  id: string;
  agencyId: string;
  name: string;
  category: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProposalSection {
  id: string;
  proposalId: string;
  title: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Proposal {
  id: string;
  agencyId: string;
  dealId: string;
  name: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  sections?: ProposalSection[];
}

interface Deal {
  id: string;
  name: string;
  value: number;
  contactId: string;
  companyId?: string;
}

export default function ProposalBuilderPage() {
  const [, params] = useRoute("/agency/crm/deals/:dealId/proposal");
  const dealId = params?.dealId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<string>("");
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  // Fetch deal information
  const { data: deal } = useQuery<Deal>({
    queryKey: [`/api/crm/deals/${dealId}`],
    enabled: !!dealId,
  });

  // Fetch existing proposal by deal ID
  const { data: existingProposal, isLoading: isLoadingProposal } = useQuery<Proposal>({
    queryKey: [`/api/crm/proposals/by-deal/${dealId}`],
    enabled: !!dealId,
    retry: false,
  });

  // Fetch proposal templates
  const { data: templates = [] } = useQuery<ProposalTemplate[]>({
    queryKey: ["/api/crm/proposal-templates"],
  });

  // Load proposal and sections when data is available
  useEffect(() => {
    if (existingProposal) {
      setProposal(existingProposal);
      if (existingProposal.sections) {
        setSections(existingProposal.sections.sort((a, b) => a.order - b.order));
      }
    }
  }, [existingProposal]);

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: { dealId: string; name: string; status: string }) => {
      const user = await getAuthUser();
      if (!user?.token) throw new Error("Not authenticated");

      const res = await apiRequest("POST", "/api/crm/proposals", data);
      return await res.json();
    },
    onSuccess: (newProposal: Proposal) => {
      setProposal(newProposal);
      queryClient.invalidateQueries({ queryKey: [`/api/crm/proposals/by-deal/${dealId}`] });
      toast({ title: "Proposal created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create proposal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update proposal mutation
  const updateProposalMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Proposal> }) => {
      const user = await getAuthUser();
      if (!user?.token) throw new Error("Not authenticated");

      const res = await apiRequest("PATCH", `/api/crm/proposals/${data.id}`, data.updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/proposals/by-deal/${dealId}`] });
      toast({ title: "Proposal updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update proposal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create section mutation
  const createSectionMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; order: number }) => {
      const user = await getAuthUser();
      if (!user?.token || !proposal) throw new Error("Not authenticated or no proposal");

      const res = await apiRequest("POST", `/api/crm/proposals/${proposal.id}/sections`, data);
      return await res.json();
    },
    onSuccess: (newSection: ProposalSection) => {
      setSections([...sections, newSection].sort((a, b) => a.order - b.order));
      toast({ title: "Section added successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: async (data: { sectionId: string; updates: Partial<ProposalSection> }) => {
      const user = await getAuthUser();
      if (!user?.token || !proposal) throw new Error("Not authenticated or no proposal");

      const res = await apiRequest("PATCH", `/api/crm/proposals/${proposal.id}/sections/${data.sectionId}`, data.updates);
      return await res.json();
    },
    onSuccess: (updatedSection: ProposalSection) => {
      setSections(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
      toast({ title: "Section updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete section mutation
  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const user = await getAuthUser();
      if (!user?.token || !proposal) throw new Error("Not authenticated or no proposal");

      const res = await apiRequest("DELETE", `/api/crm/proposals/${proposal.id}/sections/${sectionId}`);
      return await res.json();
    },
    onSuccess: (_, sectionId) => {
      setSections(sections.filter(s => s.id !== sectionId));
      setSelectedSectionId(null);
      toast({ title: "Section deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // AI generation mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async (data: {
      action: string;
      dealContext?: { clientName: string; industry?: string; dealValue?: number };
      contentToRefine?: string;
    }) => {
      const user = await getAuthUser();
      if (!user?.token || !proposal) throw new Error("Not authenticated or no proposal");

      const res = await apiRequest("POST", `/api/crm/proposals/${proposal.id}/ai-generate`, data);
      return await res.json();
    },
    onSuccess: (result: { generatedContent: string }) => {
      const selectedSection = sections.find(s => s.id === selectedSectionId);
      if (selectedSection && selectedSectionId) {
        updateSectionMutation.mutate({
          sectionId: selectedSectionId,
          updates: { content: result.generatedContent },
        });
      }
      setIsAiDialogOpen(false);
      toast({ title: "AI content generated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate AI content",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateProposal = () => {
    if (!dealId) {
      toast({ title: "Missing deal ID", variant: "destructive" });
      return;
    }
    
    createProposalMutation.mutate({
      dealId,
      name: deal?.name ? `Proposal for ${deal.name}` : `Proposal`,
      status: "draft",
    });
  };

  const handleAddSection = (title: string, content: string) => {
    const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 0;
    createSectionMutation.mutate({ title, content, order: nextOrder });
  };

  const handleAddTemplateSection = (template: ProposalTemplate) => {
    handleAddSection(template.name, template.content);
  };

  const handleUpdateSectionContent = (sectionId: string, content: string) => {
    updateSectionMutation.mutate({ sectionId, updates: { content } });
  };

  const handleDeleteSection = (sectionId: string) => {
    deleteSectionMutation.mutate(sectionId);
  };

  const handleAiGenerate = () => {
    const selectedSection = sections.find(s => s.id === selectedSectionId);
    if (!selectedSection || !aiAction) return;

    aiGenerateMutation.mutate({
      action: aiAction,
      contentToRefine: selectedSection.content,
      dealContext: deal ? { clientName: deal.name, dealValue: deal.value } : undefined,
    });
  };

  const handleSendProposal = () => {
    if (!proposal) return;
    updateProposalMutation.mutate({
      id: proposal.id,
      updates: { status: "sent" },
    });
  };

  const handleExportPDF = async () => {
    if (!proposal) return;
    
    try {
      const user = await getAuthUser();
      if (!user?.token) throw new Error("Not authenticated");

      const response = await fetch(`/api/crm/proposals/${proposal.id}/export-pdf`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export PDF");
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("Export PDF error:", error);
      toast({ title: "Failed to export PDF", variant: "destructive" });
    }
  };

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  if (isLoadingProposal) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <FileText className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">No Proposal Yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create a proposal for {deal?.name || "this deal"} to get started.
        </p>
        <Button
          onClick={handleCreateProposal}
          disabled={createProposalMutation.isPending}
          data-testid="button-create-proposal"
        >
          {createProposalMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Proposal
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Template Library Panel */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-2">Template Library</h3>
          <p className="text-sm text-muted-foreground">
            Add pre-built sections to your proposal
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => handleAddTemplateSection(template)}
                data-testid={`card-template-${template.id}`}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <Badge variant="outline" className="w-fit mt-1">
                    {template.category}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates available
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Proposal Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/agency/crm/deals")} data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{proposal.name}</h2>
              <p className="text-sm text-muted-foreground">
                Status: <Badge variant="outline">{proposal.status}</Badge>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                toast({ title: "Changes saved automatically" });
              }}
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              data-testid="button-export-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            {proposal.status === "draft" && (
              <Button
                onClick={handleSendProposal}
                disabled={updateProposalMutation.isPending}
                data-testid="button-send"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Proposal
              </Button>
            )}
          </div>
        </div>

        {/* Sections List & Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sections List */}
          <div className="w-64 border-r flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Sections</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddSection("New Section", "")}
                data-testid="button-add-section"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-3 rounded-md cursor-pointer hover-elevate ${
                      selectedSectionId === section.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedSectionId(section.id)}
                    data-testid={`section-item-${section.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate flex-1">
                        {section.title}
                      </span>
                    </div>
                  </div>
                ))}
                {sections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No sections yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Section Editor */}
          <div className="flex-1 flex flex-col">
            {selectedSection ? (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <Input
                    value={selectedSection.title}
                    onChange={(e) =>
                      updateSectionMutation.mutate({
                        sectionId: selectedSection.id,
                        updates: { title: e.target.value },
                      })
                    }
                    className="text-lg font-semibold border-0 focus-visible:ring-0 p-0"
                    placeholder="Section title"
                    data-testid="input-section-title"
                  />
                  <div className="flex items-center gap-2">
                    <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-ai-enhance">
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI Enhance
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>AI Enhancement</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Select value={aiAction} onValueChange={setAiAction}>
                            <SelectTrigger data-testid="select-ai-action">
                              <SelectValue placeholder="Select an action" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="refine">Refine & Polish</SelectItem>
                              <SelectItem value="personalize">Personalize for Client</SelectItem>
                              <SelectItem value="shorten">Make More Concise</SelectItem>
                              <SelectItem value="expand">Add More Detail</SelectItem>
                              <SelectItem value="generate-summary">Generate Summary</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleAiGenerate}
                            disabled={!aiAction || aiGenerateMutation.isPending}
                            className="w-full"
                            data-testid="button-generate-ai"
                          >
                            {aiGenerateMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSection(selectedSection.id)}
                      data-testid="button-delete-section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <Textarea
                    value={selectedSection.content}
                    onChange={(e) =>
                      setSections(
                        sections.map(s =>
                          s.id === selectedSection.id
                            ? { ...s, content: e.target.value }
                            : s
                        )
                      )
                    }
                    onBlur={() =>
                      handleUpdateSectionContent(selectedSection.id, selectedSection.content)
                    }
                    className="min-h-full resize-none font-mono text-sm"
                    placeholder="Write your content here... (Markdown supported)"
                    data-testid="textarea-section-content"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Select a section to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
