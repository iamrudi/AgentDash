import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Loader2, Sparkles, AlertCircle, PlusCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

interface AuditResult {
  lighthouseReport: any;
  aiSummary: {
    summary: string;
    recommendations: string[];
  };
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [createdInitiatives, setCreatedInitiatives] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/agency/clients'],
  });

  const auditMutation = useMutation({
    mutationFn: (targetUrl: string) =>
      apiRequest("POST", "/api/seo/audit", { url: targetUrl }).then(res => res.json()),
    onSuccess: (data: AuditResult) => {
      setResult(data);
      setCreatedInitiatives(new Set());
    },
  });

  const createInitiativeMutation = useMutation({
    mutationFn: (data: { clientId: string; recommendation: string; auditUrl: string }) =>
      apiRequest("POST", "/api/seo/audit/create-initiative", data).then(res => res.json()),
    onSuccess: (_, variables) => {
      const index = result?.aiSummary.recommendations.findIndex(r => r === variables.recommendation);
      if (index !== undefined && index !== -1) {
        setCreatedInitiatives(prev => new Set(prev).add(index));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/agency/initiatives'] });
      setSelectedRecommendation(null);
      setSelectedClientId("");
      toast({
        title: "Initiative Created",
        description: "SEO recommendation has been converted to a draft initiative.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Initiative",
        description: error.message || "An error occurred while creating the initiative.",
        variant: "destructive",
      });
    },
  });

  const handleAudit = () => {
    if (!url.trim()) return;
    setResult(null);
    auditMutation.mutate(url);
  };

  const handleCreateInitiative = () => {
    if (!selectedClientId || !selectedRecommendation) return;
    createInitiativeMutation.mutate({
      clientId: selectedClientId,
      recommendation: selectedRecommendation,
      auditUrl: url,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">SEO Website Audit</h1>
          <p className="text-muted-foreground">
            Enter a URL to get a comprehensive SEO, performance, and accessibility report powered by Google Lighthouse.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex w-full max-w-lg items-center space-x-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={auditMutation.isPending}
                data-testid="input-url"
              />
              <Button onClick={handleAudit} disabled={auditMutation.isPending} data-testid="button-audit">
                {auditMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {auditMutation.isPending ? "Auditing..." : "Audit Website"}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Summary & Recommendations
                </CardTitle>
                <CardDescription>
                  An AI-generated analysis of the Lighthouse report for quick insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Overall Summary</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-summary">{result.aiSummary.summary}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Top Recommendations</h3>
                  <div className="space-y-3">
                    {result.aiSummary.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                        <div className="flex-1">
                          <p className="text-sm" data-testid={`text-recommendation-${index}`}>{rec}</p>
                        </div>
                        {createdInitiatives.has(index) ? (
                          <Button size="sm" variant="ghost" disabled className="shrink-0">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                            Created
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => setSelectedRecommendation(rec)}
                            data-testid={`button-assign-${index}`}
                            className="shrink-0"
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Assign to Client
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lighthouse Score Summary</CardTitle>
                <CardDescription>
                  Detailed scores from the Google Lighthouse audit. Scores are out of 100.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.values(result.lighthouseReport.categories).map((category: any) => (
                  <div key={category.id} data-testid={`score-${category.id}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium capitalize">{category.title}</span>
                      <span className="text-lg font-bold">{(category.score * 100).toFixed(0)}</span>
                    </div>
                    <Progress value={category.score * 100} className={getScoreColor(category.score * 100)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={!!selectedRecommendation} onOpenChange={(open) => !open && setSelectedRecommendation(null)}>
          <DialogContent data-testid="dialog-create-initiative">
            <DialogHeader>
              <DialogTitle>Assign SEO Recommendation to Client</DialogTitle>
              <DialogDescription>
                This will create a draft initiative that you can review and send to the client for approval.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recommendation</Label>
                <p className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                  {selectedRecommendation}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-select">Select Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger id="client-select" data-testid="select-client">
                    <SelectValue placeholder="Choose a client..." />
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
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setSelectedRecommendation(null)}
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
