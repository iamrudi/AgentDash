import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sparkles, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronDown,
  Copy,
  Send,
  FileText
} from "lucide-react";

type Preset = "quick-wins" | "strategic-growth" | "full-audit";

interface PresetConfig {
  id: Preset;
  name: string;
  description: string;
  icon: typeof Zap;
  dataSources: string[];
  focusAreas: string[];
  outputType: string;
}

const PRESETS: PresetConfig[] = [
  {
    id: "quick-wins",
    name: "Quick Wins",
    description: "Small immediate fixes (titles, CTR, keywords)",
    icon: Zap,
    dataSources: ["GA4", "GSC"],
    focusAreas: ["Technical SEO", "Content Optimization"],
    outputType: "actionable"
  },
  {
    id: "strategic-growth",
    name: "Strategic Growth",
    description: "Long-term roadmap (content clusters, landing pages)",
    icon: TrendingUp,
    dataSources: ["GA4", "GSC", "DataForSEO"],
    focusAreas: ["Content Strategy", "Link Building", "Keyword Expansion"],
    outputType: "strategic"
  },
  {
    id: "full-audit",
    name: "Full Audit",
    description: "All categories auto-enabled",
    icon: Sparkles,
    dataSources: ["GA4", "GSC", "DataForSEO"],
    focusAreas: ["All"],
    outputType: "comprehensive"
  }
];

interface ConnectionStatus {
  ga4: { connected: boolean; lastSync?: string };
  gsc: { connected: boolean; lastSync?: string };
  dataForSEO: { connected: boolean; keywordCount?: number };
}

export function AIRecommendationsPanel({
  open,
  onOpenChange,
  preSelectedClientId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedClientId?: string;
}) {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>(preSelectedClientId || "");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [includeCompetitors, setIncludeCompetitors] = useState(false);
  const [competitorDomains, setCompetitorDomains] = useState<string[]>([]);
  const [newCompetitorDomain, setNewCompetitorDomain] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: connectionStatus, isError: connectionStatusError } = useQuery<ConnectionStatus>({
    queryKey: [`/api/clients/${selectedClientId}/connection-status`],
    enabled: !!selectedClientId,
  });

  // Auto-select client if preselected
  useEffect(() => {
    if (preSelectedClientId) {
      setSelectedClientId(preSelectedClientId);
    }
  }, [preSelectedClientId]);

  const generateMutation = useMutation({
    mutationFn: async (data: {
      clientId: string;
      preset: Preset;
      includeCompetitors: boolean;
      competitorDomains?: string[];
    }) => {
      setIsGenerating(true);
      setGenerationProgress("Collecting GA4 data...");
      
      // Simulate progress updates
      setTimeout(() => setGenerationProgress("Fetching GSC metrics..."), 1000);
      setTimeout(() => setGenerationProgress("Analyzing DataForSEO keywords..."), 2000);
      setTimeout(() => setGenerationProgress("Generating AI recommendations..."), 3000);
      
      const payload: any = {
        preset: data.preset,
        includeCompetitors: data.includeCompetitors,
      };
      
      if (data.competitorDomains && data.competitorDomains.length > 0) {
        payload.competitorDomains = data.competitorDomains;
      }
      
      return await apiRequest("POST", `/api/agency/clients/${data.clientId}/generate-recommendations`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      toast({
        title: "Success",
        description: "AI recommendations generated successfully",
      });
      setIsGenerating(false);
      setGenerationProgress("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate recommendations",
        variant: "destructive",
      });
      setIsGenerating(false);
      setGenerationProgress("");
    },
  });

  const handleAddCompetitor = () => {
    if (!newCompetitorDomain.trim()) return;
    
    // Basic URL validation
    const domain = newCompetitorDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (competitorDomains.includes(domain)) {
      toast({
        title: "Duplicate domain",
        description: "This competitor is already added",
        variant: "destructive",
      });
      return;
    }
    
    if (competitorDomains.length >= 5) {
      toast({
        title: "Limit reached",
        description: "Maximum 5 competitors allowed",
        variant: "destructive",
      });
      return;
    }
    
    setCompetitorDomains([...competitorDomains, domain]);
    setNewCompetitorDomain("");
  };

  const handleRemoveCompetitor = (domain: string) => {
    setCompetitorDomains(competitorDomains.filter(d => d !== domain));
  };

  const handlePresetClick = (preset: Preset) => {
    if (!selectedClientId) {
      toast({
        title: "Select a client",
        description: "Please select a client first",
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      clientId: selectedClientId,
      preset,
      includeCompetitors,
    };
    
    // Only include competitorDomains if competitors are enabled and domains exist
    if (includeCompetitors && competitorDomains.length > 0) {
      payload.competitorDomains = competitorDomains;
    }
    
    setSelectedPreset(preset);
    generateMutation.mutate(payload);
  };

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Recommendations
          </SheetTitle>
          <SheetDescription>
            Generate intelligent recommendations using preset analysis templates
          </SheetDescription>
        </SheetHeader>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{generationProgress}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger data-testid="select-ai-client">
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

            {/* Connection Status Badges */}
            {selectedClientId && (
              connectionStatusError ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                  <p className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Unable to load connection status. Some features may be limited.
                  </p>
                </div>
              ) : connectionStatus ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={connectionStatus.ga4.connected ? "default" : "secondary"} className="gap-1">
                    {connectionStatus.ga4.connected ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    GA4: {connectionStatus.ga4.connected ? "Connected ✓" : "Not connected"}
                  </Badge>
                  <Badge variant={connectionStatus.gsc.connected ? "default" : "secondary"} className="gap-1">
                    {connectionStatus.gsc.connected ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    GSC: {connectionStatus.gsc.connected ? `Synced ${connectionStatus.gsc.lastSync || "recently"}` : "Not connected"}
                  </Badge>
                  <Badge variant={connectionStatus.dataForSEO.connected ? "default" : "secondary"} className="gap-1">
                    {connectionStatus.dataForSEO.connected ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    DataForSEO: {connectionStatus.dataForSEO.connected 
                      ? `${connectionStatus.dataForSEO.keywordCount || 0} keywords scanned` 
                      : "Not connected"}
                  </Badge>
                </div>
              ) : null
            )}

            {/* Auto-Context Info */}
            {selectedClient && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                <p><span className="font-medium">Client:</span> {selectedClient.companyName}</p>
                <p><span className="font-medium">Date Range:</span> Last 28 days</p>
                <p><span className="font-medium">Top URLs:</span> Auto-loaded from GA4</p>
              </div>
            )}

            {/* Preset Buttons */}
            <div className="space-y-3">
              <Label>Select Analysis Type</Label>
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={preset.id}
                    variant={selectedPreset === preset.id ? "default" : "outline"}
                    className="w-full justify-start h-auto py-4"
                    onClick={() => handlePresetClick(preset.id)}
                    disabled={!selectedClientId || generateMutation.isPending}
                    data-testid={`button-preset-${preset.id}`}
                  >
                    <div className="flex items-start gap-3 text-left">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{preset.name}</p>
                        <p className="text-xs opacity-90">{preset.description}</p>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>

            {/* Competitor Analysis */}
            <div className="space-y-3 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-competitors"
                  checked={includeCompetitors}
                  onCheckedChange={(checked) => setIncludeCompetitors(checked as boolean)}
                  data-testid="checkbox-include-competitors"
                />
                <Label htmlFor="include-competitors" className="cursor-pointer flex-1">
                  Include competitor comparison
                </Label>
              </div>
              
              {includeCompetitors && (
                <div className="space-y-2 pl-6">
                  <Label className="text-xs text-muted-foreground">Add competitor domains (max 5)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="example.com"
                      value={newCompetitorDomain}
                      onChange={(e) => setNewCompetitorDomain(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCompetitor()}
                      data-testid="input-competitor-domain"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddCompetitor}
                      disabled={!newCompetitorDomain.trim()}
                      data-testid="button-add-competitor"
                    >
                      Add
                    </Button>
                  </div>
                  
                  {competitorDomains.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {competitorDomains.map((domain) => (
                        <Badge
                          key={domain}
                          variant="secondary"
                          className="gap-1 pl-2 pr-1"
                          data-testid={`badge-competitor-${domain}`}
                        >
                          {domain}
                          <button
                            onClick={() => handleRemoveCompetitor(domain)}
                            className="ml-1 hover:bg-destructive/20 rounded-sm p-0.5"
                            data-testid={`button-remove-competitor-${domain}`}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full justify-between"
                data-testid="button-toggle-advanced"
              >
                Advanced Options
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </Button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-3 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
                  <p>Advanced options are available for analysts only.</p>
                  <p>Temperature sliders and schema options can be configured here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
