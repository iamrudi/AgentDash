import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Loader2, Sparkles, AlertCircle, PlusCircle, CheckCircle2, TrendingUp, FileText, Tag, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

interface OnPageTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'technical' | 'keywords' | 'meta';
}

interface AuditResult {
  url: string;
  aiSummary: string;
  onPageTasks: OnPageTask[];
  technicalMetrics: {
    wordCount: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    metaDescription?: string;
    metaDescriptionLength?: number;
    title?: string;
    titleLength?: number;
  };
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedTask, setSelectedTask] = useState<OnPageTask | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/agency/clients'],
  });

  const auditMutation = useMutation({
    mutationFn: ({ targetUrl, clientId }: { targetUrl: string; clientId: string }) =>
      apiRequest("POST", "/api/seo/audit", { 
        url: targetUrl, 
        clientId
      }).then(res => res.json()),
    onSuccess: (data: AuditResult) => {
      setResult(data);
      setCreatedTasks(new Set());
    },
  });

  const createInitiativeMutation = useMutation({
    mutationFn: (data: { clientId: string; task: OnPageTask; auditUrl: string }) =>
      apiRequest("POST", "/api/seo/audit/create-initiative", {
        clientId: data.clientId,
        recommendation: data.task.title,
        auditUrl: data.auditUrl,
      }).then(res => res.json()),
    onSuccess: (_, variables) => {
      setCreatedTasks(prev => new Set([...prev, variables.task.id]));
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['/api/agency/initiatives'] });
      
      toast({
        title: "Initiative Created",
        description: "SEO task has been added as a draft initiative for client approval.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Create Initiative",
        description: "There was an error creating the initiative. Please try again.",
      });
    },
  });

  const handleAudit = () => {
    if (!url.trim() || !selectedClientId) return;
    setResult(null);
    auditMutation.mutate({
      targetUrl: url,
      clientId: selectedClientId,
    });
  };

  const handleCreateInitiative = () => {
    if (!selectedClientId || !selectedTask || !result) return;
    createInitiativeMutation.mutate({
      clientId: selectedClientId,
      task: selectedTask,
      auditUrl: result.url,
    });
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-500';
    if (priority === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'content') return <FileText className="h-4 w-4" />;
    if (category === 'technical') return <Settings className="h-4 w-4" />;
    if (category === 'keywords') return <Tag className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">On-Page SEO Audit</h1>
          <p className="text-muted-foreground">
            Analyze a webpage for on-page SEO opportunities and get AI-powered recommendations.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="client-select">Select Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={auditMutation.isPending}>
                <SelectTrigger id="client-select" data-testid="select-client">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Client must have Data for SEO credentials configured</p>
            </div>

            <div className="flex w-full items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="url-input">Website URL</Label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={auditMutation.isPending}
                  data-testid="input-url"
                />
              </div>
              <Button 
                onClick={handleAudit} 
                disabled={!url.trim() || !selectedClientId || auditMutation.isPending} 
                data-testid="button-audit"
              >
                {auditMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {auditMutation.isPending ? "Analyzing..." : "Analyze Page"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {auditMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Audit Failed</AlertTitle>
            <AlertDescription>{(auditMutation.error as Error).message}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-6">
            {/* AI Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered SEO Analysis
                </CardTitle>
                <CardDescription>
                  Executive summary of the page's SEO performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" data-testid="text-summary">{result.aiSummary}</p>
              </CardContent>
            </Card>

            {/* Technical Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Metrics</CardTitle>
                <CardDescription>Current on-page SEO indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Word Count</p>
                    <p className="text-2xl font-bold" data-testid="metric-word-count">{result.technicalMetrics.wordCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">H1 Headings</p>
                    <p className="text-2xl font-bold" data-testid="metric-h1">{result.technicalMetrics.h1Count}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">H2 Headings</p>
                    <p className="text-2xl font-bold" data-testid="metric-h2">{result.technicalMetrics.h2Count}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">H3 Headings</p>
                    <p className="text-2xl font-bold" data-testid="metric-h3">{result.technicalMetrics.h3Count}</p>
                  </div>
                </div>
                
                {result.technicalMetrics.title && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Page Title ({result.technicalMetrics.titleLength} chars)</p>
                    <p className="text-sm font-medium">{result.technicalMetrics.title}</p>
                  </div>
                )}
                
                {result.technicalMetrics.metaDescription && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Meta Description ({result.technicalMetrics.metaDescriptionLength} chars)</p>
                    <p className="text-sm">{result.technicalMetrics.metaDescription}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* On-Page Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended On-Page Tasks</CardTitle>
                <CardDescription>
                  Actionable SEO improvements prioritized by impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.onPageTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-4 rounded-md border bg-card">
                      <div className="mt-1">{getCategoryIcon(task.category)}</div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium" data-testid={`task-title-${task.id}`}>{task.title}</h4>
                          <Badge variant="outline" className={`${getPriorityColor(task.priority)} text-white`}>
                            {task.priority}
                          </Badge>
                          <Badge variant="secondary">{task.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`task-description-${task.id}`}>{task.description}</p>
                      </div>
                      {createdTasks.has(task.id) ? (
                        <Button size="sm" variant="ghost" disabled className="shrink-0">
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                          Created
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          onClick={() => setSelectedTask(task)}
                          data-testid={`button-assign-${task.id}`}
                          className="shrink-0"
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Send to Client
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <DialogContent data-testid="dialog-create-initiative">
            <DialogHeader>
              <DialogTitle>Send SEO Task to Client for Approval</DialogTitle>
              <DialogDescription>
                This will create a draft strategic initiative that will be sent to the client for approval.
              </DialogDescription>
            </DialogHeader>
            
            {selectedTask && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Task Details</Label>
                  <div className="p-3 rounded-md bg-muted space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{selectedTask.title}</h4>
                      <Badge variant="outline" className={`${getPriorityColor(selectedTask.priority)} text-white`}>
                        {selectedTask.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Client</Label>
                  <p className="text-sm font-medium">
                    {clients?.find(c => c.id === selectedClientId)?.companyName}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setSelectedTask(null)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateInitiative}
                disabled={!selectedClientId || createInitiativeMutation.isPending}
                data-testid="button-create-initiative"
              >
                {createInitiativeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Initiative
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AgencyLayout>
  );
}
