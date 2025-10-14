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
  onPageAnalysis?: {
    url: string;
    title: string;
    word_count: number;
    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
    };
    meta_description: string;
  };
  serpAnalysis?: {
    keyword: string;
    currentPosition?: number;
    topCompetitors: {
      position: number;
      url: string;
      title: string;
      domain: string;
    }[];
  };
  peopleAlsoAsk?: {
    question: string;
    answer: string;
    url: string;
  }[];
  insights: {
    lighthouseScore: {
      seo: number;
      performance: number;
      accessibility: number;
      bestPractices: number;
    };
    technicalSeo: {
      wordCount: number;
      h1Count: number;
      h2Count: number;
      h3Count: number;
      hasMetaDescription: boolean;
      metaDescriptionLength?: number;
    };
    competitivePosition?: {
      keyword: string;
      yourPosition?: number;
      topCompetitorDomains: string[];
    };
    contentOpportunities: string[];
  };
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState("");
  const [auditClientId, setAuditClientId] = useState<string>("");
  const [targetKeyword, setTargetKeyword] = useState<string>("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [createdInitiatives, setCreatedInitiatives] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/agency/clients'],
  });

  const auditMutation = useMutation({
    mutationFn: ({ targetUrl, clientId, keyword }: { targetUrl: string; clientId?: string; keyword?: string }) =>
      apiRequest("POST", "/api/seo/audit", { 
        url: targetUrl, 
        clientId: clientId || undefined,
        targetKeyword: keyword || undefined
      }).then(res => res.json()),
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
    auditMutation.mutate({
      targetUrl: url,
      clientId: auditClientId,
      keyword: targetKeyword,
    });
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
          <CardContent className="pt-6 space-y-4">
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
            
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div>
                <Label htmlFor="audit-client">Client (Optional)</Label>
                <Select value={auditClientId} onValueChange={setAuditClientId} disabled={auditMutation.isPending}>
                  <SelectTrigger id="audit-client" data-testid="select-audit-client">
                    <SelectValue placeholder="Select client for Data for SEO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Select a client with Data for SEO to get keyword insights</p>
              </div>
              
              <div>
                <Label htmlFor="target-keyword">Target Keyword (Optional)</Label>
                <Input
                  id="target-keyword"
                  placeholder="e.g., wheelchair access"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  disabled={auditMutation.isPending}
                  data-testid="input-target-keyword"
                />
                <p className="text-xs text-muted-foreground mt-1">Used for SERP and competitor analysis</p>
              </div>
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

            {/* Data for SEO Enhanced Insights */}
            {result.onPageAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Technical SEO Analysis</CardTitle>
                  <CardDescription>Detailed on-page SEO metrics powered by Data for SEO</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Word Count</p>
                      <p className="text-2xl font-bold">{result.insights.technicalSeo.wordCount}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">H1 Headings</p>
                      <p className="text-2xl font-bold">{result.insights.technicalSeo.h1Count}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">H2 Headings</p>
                      <p className="text-2xl font-bold">{result.insights.technicalSeo.h2Count}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">H3 Headings</p>
                      <p className="text-2xl font-bold">{result.insights.technicalSeo.h3Count}</p>
                    </div>
                  </div>
                  {result.onPageAnalysis.meta_description && (
                    <div className="mt-4 space-y-1">
                      <p className="text-sm text-muted-foreground">Meta Description ({result.onPageAnalysis.meta_description.length} chars)</p>
                      <p className="text-sm">{result.onPageAnalysis.meta_description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {result.serpAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Keyword Rankings</CardTitle>
                  <CardDescription>
                    SERP analysis for "{result.serpAnalysis.keyword}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {result.serpAnalysis.currentPosition ? (
                    <Alert className="mb-4">
                      <AlertTitle>Your Position: #{result.serpAnalysis.currentPosition}</AlertTitle>
                      <AlertDescription>This page is currently ranking for the target keyword</AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Not Ranking</AlertTitle>
                      <AlertDescription>This page is not in the top 10 results for this keyword</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <h4 className="font-semibold mb-3">Top 5 Competitors</h4>
                    <div className="space-y-2">
                      {result.serpAnalysis.topCompetitors.map((competitor) => (
                        <div key={competitor.position} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                          <span className="font-bold text-lg text-muted-foreground">#{competitor.position}</span>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{competitor.title}</p>
                            <p className="text-xs text-muted-foreground">{competitor.domain}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.insights.contentOpportunities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Content Opportunities</CardTitle>
                  <CardDescription>Actionable recommendations to improve your content</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.insights.contentOpportunities.map((opportunity, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-500" />
                        <p>{opportunity}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.peopleAlsoAsk && result.peopleAlsoAsk.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>People Also Ask</CardTitle>
                  <CardDescription>Questions people are searching for related to your keyword</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.peopleAlsoAsk.map((paa, index) => (
                      <div key={index} className="p-3 rounded-md border bg-card">
                        <p className="font-medium text-sm mb-1">{paa.question}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{paa.answer}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
