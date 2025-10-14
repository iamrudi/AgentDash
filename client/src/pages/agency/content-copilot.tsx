import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lightbulb, FileText, Target, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface ContentIdea {
  title: string;
  description: string;
  targetKeywords: string[];
  searchVolume: number;
  difficulty: string;
  contentType: string;
}

interface ContentBrief {
  title: string;
  targetKeywords: string[];
  wordCount: number;
  outline: string[];
  tone: string;
  targetAudience: string;
  keyPoints: string[];
  competitorInsights: string;
}

interface ContentOptimization {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  keywordOpportunities: string[];
  readabilityScore: number;
  seoRecommendations: string[];
}

export default function ContentCopilot() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("ideas");

  // Content Ideas state
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [competitorUrls, setCompetitorUrls] = useState("");
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);

  // Content Brief state
  const [topic, setTopic] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentType, setContentType] = useState("");
  const [briefCompetitors, setBriefCompetitors] = useState("");
  const [contentBrief, setContentBrief] = useState<ContentBrief | null>(null);

  // Content Optimizer state
  const [contentToOptimize, setContentToOptimize] = useState("");
  const [optimizeKeywords, setOptimizeKeywords] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [optimization, setOptimization] = useState<ContentOptimization | null>(null);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: integrationStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/integrations/dataforseo", selectedClientId],
    enabled: !!selectedClientId,
  });

  // Generate content ideas mutation
  const generateIdeasMutation = useMutation({
    mutationFn: async (): Promise<ContentIdea[]> => {
      const urls = competitorUrls.split("\n").filter(url => url.trim());
      const response = await apiRequest("POST", `/api/content/ideas/${selectedClientId}`, {
        primaryKeyword,
        competitorUrls: urls,
        locationCode: 2840, // United States
      });
      return response as ContentIdea[];
    },
    onSuccess: (data) => {
      setContentIdeas(data);
      toast({
        title: "Success",
        description: "Content ideas generated successfully",
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

  // Generate content brief mutation
  const generateBriefMutation = useMutation({
    mutationFn: async (): Promise<ContentBrief> => {
      const keywords = targetKeywords.split(",").map(k => k.trim()).filter(k => k);
      const urls = briefCompetitors.split("\n").filter(url => url.trim());
      const response = await apiRequest("POST", `/api/content/brief/${selectedClientId}`, {
        topic,
        targetKeywords: keywords,
        targetAudience,
        contentType,
        competitorUrls: urls,
      });
      return response as ContentBrief;
    },
    onSuccess: (data) => {
      setContentBrief(data);
      toast({
        title: "Success",
        description: "Content brief generated successfully",
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

  // Optimize content mutation
  const optimizeContentMutation = useMutation({
    mutationFn: async (): Promise<ContentOptimization> => {
      const keywords = optimizeKeywords.split(",").map(k => k.trim()).filter(k => k);
      const response = await apiRequest("POST", `/api/content/optimize/${selectedClientId}`, {
        content: contentToOptimize,
        targetKeywords: keywords,
        currentUrl: currentUrl || undefined,
      });
      return response as ContentOptimization;
    },
    onSuccess: (data) => {
      setOptimization(data);
      toast({
        title: "Success",
        description: "Content optimization complete",
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

  const handleGenerateIdeas = () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }
    if (!primaryKeyword) {
      toast({
        title: "Error",
        description: "Please enter a primary keyword",
        variant: "destructive",
      });
      return;
    }
    generateIdeasMutation.mutate();
  };

  const handleGenerateBrief = () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }
    if (!topic) {
      toast({
        title: "Error",
        description: "Please enter a topic",
        variant: "destructive",
      });
      return;
    }
    generateBriefMutation.mutate();
  };

  const handleOptimizeContent = () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }
    if (!contentToOptimize) {
      toast({
        title: "Error",
        description: "Please enter content to optimize",
        variant: "destructive",
      });
      return;
    }
    optimizeContentMutation.mutate();
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Content Co-pilot
            </h1>
            <p className="text-muted-foreground">
              AI-powered content strategy, research, and optimization
            </p>
          </div>
          <div className="w-64">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Select client" />
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

        {selectedClientId && !integrationStatus?.connected && (
          <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <p className="text-sm">
                  Data for SEO integration not configured for this client. Please configure it in the{" "}
                  <a href="/agency/integrations" className="text-primary hover:underline">
                    integrations page
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ideas" data-testid="tab-ideas">
              <Lightbulb className="h-4 w-4 mr-2" />
              Content Ideas
            </TabsTrigger>
            <TabsTrigger value="brief" data-testid="tab-brief">
              <FileText className="h-4 w-4 mr-2" />
              Content Brief
            </TabsTrigger>
            <TabsTrigger value="optimize" data-testid="tab-optimize">
              <Target className="h-4 w-4 mr-2" />
              Content Optimizer
            </TabsTrigger>
          </TabsList>

          {/* Content Ideas Tab */}
          <TabsContent value="ideas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Content Ideas</CardTitle>
                <CardDescription>
                  Discover content opportunities based on keyword research and competitor analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="primary-keyword">Primary Keyword *</Label>
                  <Input
                    id="primary-keyword"
                    placeholder="e.g., digital marketing strategies"
                    value={primaryKeyword}
                    onChange={(e) => setPrimaryKeyword(e.target.value)}
                    data-testid="input-primary-keyword"
                  />
                </div>
                <div>
                  <Label htmlFor="competitor-urls">Competitor URLs (one per line)</Label>
                  <Textarea
                    id="competitor-urls"
                    placeholder="https://competitor1.com&#10;https://competitor2.com&#10;https://competitor3.com"
                    value={competitorUrls}
                    onChange={(e) => setCompetitorUrls(e.target.value)}
                    rows={4}
                    data-testid="input-competitor-urls"
                  />
                </div>
                <Button
                  onClick={handleGenerateIdeas}
                  disabled={generateIdeasMutation.isPending || !selectedClientId}
                  data-testid="button-generate-ideas"
                >
                  {generateIdeasMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Ideas
                </Button>
              </CardContent>
            </Card>

            {contentIdeas.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generated Ideas</h3>
                {contentIdeas.map((idea, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{idea.title}</CardTitle>
                          <CardDescription className="mt-2">{idea.description}</CardDescription>
                        </div>
                        <Badge variant="secondary">{idea.contentType}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {idea.targetKeywords.map((keyword, kidx) => (
                          <Badge key={kidx} variant="outline">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Search Volume: {idea.searchVolume.toLocaleString()}/mo</span>
                        <span>•</span>
                        <span>Difficulty: {idea.difficulty}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Content Brief Tab */}
          <TabsContent value="brief" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Content Brief</CardTitle>
                <CardDescription>
                  Create a comprehensive content brief with outline, tone, and key points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="topic">Topic *</Label>
                  <Input
                    id="topic"
                    placeholder="e.g., Complete Guide to Email Marketing"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    data-testid="input-topic"
                  />
                </div>
                <div>
                  <Label htmlFor="target-keywords">Target Keywords (comma-separated)</Label>
                  <Input
                    id="target-keywords"
                    placeholder="email marketing, email campaigns, email automation"
                    value={targetKeywords}
                    onChange={(e) => setTargetKeywords(e.target.value)}
                    data-testid="input-target-keywords"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="target-audience">Target Audience</Label>
                    <Input
                      id="target-audience"
                      placeholder="e.g., Small business owners"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      data-testid="input-target-audience"
                    />
                  </div>
                  <div>
                    <Label htmlFor="content-type">Content Type</Label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger id="content-type" data-testid="select-content-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Article">Article</SelectItem>
                        <SelectItem value="How-to Guide">How-to Guide</SelectItem>
                        <SelectItem value="Listicle">Listicle</SelectItem>
                        <SelectItem value="Case Study">Case Study</SelectItem>
                        <SelectItem value="Comparison">Comparison</SelectItem>
                        <SelectItem value="Tutorial">Tutorial</SelectItem>
                        <SelectItem value="Review">Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="brief-competitors">Competitor URLs (one per line)</Label>
                  <Textarea
                    id="brief-competitors"
                    placeholder="https://competitor1.com/article&#10;https://competitor2.com/guide"
                    value={briefCompetitors}
                    onChange={(e) => setBriefCompetitors(e.target.value)}
                    rows={3}
                    data-testid="input-brief-competitors"
                  />
                </div>
                <Button
                  onClick={handleGenerateBrief}
                  disabled={generateBriefMutation.isPending || !selectedClientId}
                  data-testid="button-generate-brief"
                >
                  {generateBriefMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Brief
                </Button>
              </CardContent>
            </Card>

            {contentBrief && (
              <Card>
                <CardHeader>
                  <CardTitle>{contentBrief.title}</CardTitle>
                  <CardDescription>
                    Recommended Word Count: {contentBrief.wordCount} • Tone: {contentBrief.tone}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Target Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {contentBrief.targetKeywords.map((keyword, idx) => (
                        <Badge key={idx} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Target Audience</h4>
                    <p className="text-muted-foreground">{contentBrief.targetAudience}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Content Outline</h4>
                    <ul className="space-y-1">
                      {contentBrief.outline.map((item, idx) => (
                        <li key={idx} className={item.startsWith("  ") ? "ml-6 text-muted-foreground" : "font-medium"}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Key Points to Cover</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {contentBrief.keyPoints.map((point, idx) => (
                        <li key={idx} className="text-muted-foreground">{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Competitor Insights</h4>
                    <p className="text-muted-foreground">{contentBrief.competitorInsights}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Content Optimizer Tab */}
          <TabsContent value="optimize" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Optimize Existing Content</CardTitle>
                <CardDescription>
                  Analyze and get recommendations to improve your content's SEO and readability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="content-to-optimize">Content to Analyze *</Label>
                  <Textarea
                    id="content-to-optimize"
                    placeholder="Paste your article or blog post content here..."
                    value={contentToOptimize}
                    onChange={(e) => setContentToOptimize(e.target.value)}
                    rows={8}
                    data-testid="input-content-to-optimize"
                  />
                </div>
                <div>
                  <Label htmlFor="optimize-keywords">Target Keywords (comma-separated)</Label>
                  <Input
                    id="optimize-keywords"
                    placeholder="keyword 1, keyword 2, keyword 3"
                    value={optimizeKeywords}
                    onChange={(e) => setOptimizeKeywords(e.target.value)}
                    data-testid="input-optimize-keywords"
                  />
                </div>
                <div>
                  <Label htmlFor="current-url">Current URL (optional)</Label>
                  <Input
                    id="current-url"
                    placeholder="https://example.com/article"
                    value={currentUrl}
                    onChange={(e) => setCurrentUrl(e.target.value)}
                    data-testid="input-current-url"
                  />
                </div>
                <Button
                  onClick={handleOptimizeContent}
                  disabled={optimizeContentMutation.isPending || !selectedClientId}
                  data-testid="button-optimize-content"
                >
                  {optimizeContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Analyze Content
                </Button>
              </CardContent>
            </Card>

            {optimization && (
              <Card>
                <CardHeader>
                  <CardTitle>Optimization Report</CardTitle>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Overall Score</span>
                      <div className="text-2xl font-bold">{optimization.overallScore}/100</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Readability Score</span>
                      <div className="text-2xl font-bold">{optimization.readabilityScore}/100</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Strengths</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {optimization.strengths.map((strength, idx) => (
                        <li key={idx} className="text-muted-foreground">{strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-yellow-600 dark:text-yellow-400">Areas for Improvement</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {optimization.improvements.map((improvement, idx) => (
                        <li key={idx} className="text-muted-foreground">{improvement}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Keyword Opportunities</h4>
                    <div className="flex flex-wrap gap-2">
                      {optimization.keywordOpportunities.map((keyword, idx) => (
                        <Badge key={idx} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">SEO Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {optimization.seoRecommendations.map((rec, idx) => (
                        <li key={idx} className="text-muted-foreground">{rec}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AgencyLayout>
  );
}
