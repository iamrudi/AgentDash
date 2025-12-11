import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Brain, 
  Signal, 
  Lightbulb, 
  ListOrdered, 
  MessageSquare, 
  Play, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Settings,
  Timer,
  Users,
  BarChart3,
  DollarSign,
  Gauge,
  Target,
  Zap
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface IntelligenceOverview {
  unprocessedSignalsCount: number;
  openInsightsCount: number;
  pendingPrioritiesCount: number;
  recentSignals: any[];
  topInsights: any[];
  topPriorities: any[];
}

interface IntelligenceSignal {
  id: string;
  sourceSystem: string;
  signalType: string;
  category: string;
  severity: string | null;
  occurredAt: string;
  processedToInsight: boolean;
  discarded: boolean;
  payload: Record<string, unknown>;
}

interface IntelligenceInsight {
  id: string;
  title: string;
  description: string | null;
  insightType: string;
  severity: string | null;
  status: string;
  confidenceScore: string | null;
  suggestedAction: string | null;
  createdAt: string;
}

interface IntelligencePriority {
  id: string;
  insightId: string;
  priorityScore: string;
  commercialImpactScore: string;
  urgencyScore: string;
  confidenceScore: string;
  resourceFeasibilityScore: string;
  rankingBucket: string | null;
  status: string;
  recommendedDueDate: string | null;
}

interface DurationPrediction {
  id: string;
  taskId: string;
  predictedHours: string;
  confidenceScore: string;
  confidenceLevel: string;
  isColdStart: boolean;
  coldStartReason: string | null;
  createdAt: string;
}

interface CapacityProfile {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxHours: string;
  focusTimeStart: string | null;
  focusTimeEnd: string | null;
}

interface CommercialPriority {
  taskId: string;
  taskDescription: string;
  clientName: string;
  totalImpactScore: number;
  revenueImpact: number;
  clientTierWeight: number;
  deadlineRiskWeight: number;
  strategicWeight: number;
  slaAtRisk: boolean;
  daysUntilDeadline: number | null;
}

interface ModelStats {
  totalHistoricalRecords: number;
  avgVariancePercent: number;
  coldStartRate: number;
  confidenceDistribution: Record<string, number>;
  topTaskTypes: Array<{ taskType: string; count: number; avgHours: number }>;
}

export default function IntelligencePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: overview, isLoading: overviewLoading } = useQuery<IntelligenceOverview>({
    queryKey: ["/api/intelligence/overview"],
  });

  const { data: signals, isLoading: signalsLoading } = useQuery<IntelligenceSignal[]>({
    queryKey: ["/api/intelligence/signals"],
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<IntelligenceInsight[]>({
    queryKey: ["/api/intelligence/insights"],
  });

  const { data: priorities, isLoading: prioritiesLoading } = useQuery<IntelligencePriority[]>({
    queryKey: ["/api/intelligence/priorities"],
  });

  const runPipelineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/intelligence/run-pipeline");
      return response.json();
    },
    onSuccess: (data: { signalsProcessed: number; insightsCreated: number; prioritiesCreated: number }) => {
      toast({
        title: "Pipeline completed",
        description: `Processed ${data.signalsProcessed} signals, created ${data.insightsCreated} insights and ${data.prioritiesCreated} priorities.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence/priorities"] });
    },
    onError: () => {
      toast({
        title: "Pipeline failed",
        description: "Failed to run the intelligence pipeline.",
        variant: "destructive",
      });
    },
  });

  const getSeverityBadge = (severity: string | null) => {
    const styles: Record<string, string> = {
      critical: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-black",
      low: "bg-green-500 text-white",
    };
    return (
      <Badge className={styles[severity || "medium"] || "bg-muted"}>
        {severity || "medium"}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      open: { variant: "secondary", icon: <Clock className="w-3 h-3 mr-1" /> },
      pending: { variant: "secondary", icon: <Clock className="w-3 h-3 mr-1" /> },
      prioritised: { variant: "default", icon: <ListOrdered className="w-3 h-3 mr-1" /> },
      in_progress: { variant: "default", icon: <Play className="w-3 h-3 mr-1" /> },
      actioned: { variant: "default", icon: <CheckCircle className="w-3 h-3 mr-1" /> },
      done: { variant: "default", icon: <CheckCircle className="w-3 h-3 mr-1" /> },
      ignored: { variant: "outline", icon: null },
      dismissed: { variant: "outline", icon: null },
    };
    const style = styles[status] || { variant: "secondary" as const, icon: null };
    return (
      <Badge variant={style.variant} className="flex items-center gap-1">
        {style.icon}
        {status}
      </Badge>
    );
  };

  const formatScore = (score: string | null) => {
    if (!score) return "N/A";
    return `${(parseFloat(score) * 100).toFixed(0)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6" data-testid="page-intelligence">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Intelligence Center</h1>
            <p className="text-muted-foreground">Operational insights, priorities, and feedback loops</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/intelligence/overview"] });
              queryClient.invalidateQueries({ queryKey: ["/api/intelligence/signals"] });
              queryClient.invalidateQueries({ queryKey: ["/api/intelligence/insights"] });
              queryClient.invalidateQueries({ queryKey: ["/api/intelligence/priorities"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => runPipelineMutation.mutate()}
            disabled={runPipelineMutation.isPending}
            data-testid="button-run-pipeline"
          >
            <Play className="w-4 h-4 mr-2" />
            {runPipelineMutation.isPending ? "Running..." : "Run Pipeline"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="signals" className="flex items-center gap-2" data-testid="tab-signals">
            <Signal className="w-4 h-4" />
            Signals
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2" data-testid="tab-insights">
            <Lightbulb className="w-4 h-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="priorities" className="flex items-center gap-2" data-testid="tab-priorities">
            <ListOrdered className="w-4 h-4" />
            Priorities
          </TabsTrigger>
          <TabsTrigger value="duration" className="flex items-center gap-2" data-testid="tab-duration">
            <Timer className="w-4 h-4" />
            Duration
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2" data-testid="tab-config">
            <Settings className="w-4 h-4" />
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unprocessed Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Signal className="w-5 h-5 text-muted-foreground" />
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <span className="text-3xl font-bold" data-testid="text-unprocessed-signals">
                      {overview?.unprocessedSignalsCount || 0}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-muted-foreground" />
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <span className="text-3xl font-bold" data-testid="text-open-insights">
                      {overview?.openInsightsCount || 0}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending Priorities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-muted-foreground" />
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <span className="text-3xl font-bold" data-testid="text-pending-priorities">
                      {overview?.pendingPrioritiesCount || 0}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Signals</CardTitle>
                <CardDescription>Latest incoming signals from integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {overviewLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : overview?.recentSignals?.length ? (
                    <div className="space-y-3">
                      {overview.recentSignals.map((signal: any) => (
                        <div key={signal.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{signal.sourceSystem}</Badge>
                            <span className="text-sm font-medium">{signal.signalType}</span>
                          </div>
                          {getSeverityBadge(signal.severity)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No recent signals</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Priorities</CardTitle>
                <CardDescription>Highest priority items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {overviewLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : overview?.topPriorities?.length ? (
                    <div className="space-y-3">
                      {overview.topPriorities.map((priority: any) => (
                        <div key={priority.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant={priority.rankingBucket === "critical" ? "destructive" : "secondary"}>
                              {priority.rankingBucket || "unknown"}
                            </Badge>
                            <span className="text-sm">Score: {formatScore(priority.priorityScore)}</span>
                          </div>
                          {getStatusBadge(priority.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No pending priorities</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="signals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Intelligence Signals</CardTitle>
              <CardDescription>Raw signals from analytics, CRM, and workflow integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {signalsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : signals?.length ? (
                  <div className="space-y-3">
                    {signals.map((signal) => (
                      <div key={signal.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{signal.sourceSystem}</Badge>
                            <span className="font-medium">{signal.signalType}</span>
                            <Badge variant="secondary">{signal.category}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(signal.severity)}
                            {signal.processedToInsight ? (
                              <Badge variant="default">Processed</Badge>
                            ) : signal.discarded ? (
                              <Badge variant="outline">Discarded</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Occurred: {formatDate(signal.occurredAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No signals yet</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Intelligence Insights</CardTitle>
              <CardDescription>Aggregated insights from processed signals with confidence scores</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {insightsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : insights?.length ? (
                  <div className="space-y-4">
                    {insights.map((insight) => (
                      <div key={insight.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{insight.title}</h3>
                            <Badge variant="outline" className="mt-1">{insight.insightType}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(insight.severity)}
                            {getStatusBadge(insight.status)}
                          </div>
                        </div>
                        {insight.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{insight.description}</p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Confidence: {formatScore(insight.confidenceScore)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(insight.createdAt)}
                          </span>
                        </div>
                        {insight.suggestedAction && (
                          <div className="p-2 bg-muted rounded-md text-sm">
                            <strong>Suggested Action:</strong> {insight.suggestedAction}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No insights yet</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priorities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Priority Queue</CardTitle>
              <CardDescription>Ranked priorities based on weighted scoring</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {prioritiesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : priorities?.length ? (
                  <div className="space-y-4">
                    {priorities.map((priority, index) => (
                      <div key={priority.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                            <Badge variant={priority.rankingBucket === "critical" ? "destructive" : "default"}>
                              {priority.rankingBucket || "unranked"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{formatScore(priority.priorityScore)}</span>
                            {getStatusBadge(priority.status)}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Impact</span>
                            <div className="font-medium">{formatScore(priority.commercialImpactScore)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Urgency</span>
                            <div className="font-medium">{formatScore(priority.urgencyScore)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Confidence</span>
                            <div className="font-medium">{formatScore(priority.confidenceScore)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Feasibility</span>
                            <div className="font-medium">{formatScore(priority.resourceFeasibilityScore)}</div>
                          </div>
                        </div>
                        {priority.recommendedDueDate && (
                          <div className="text-sm text-muted-foreground">
                            Due: {formatDate(priority.recommendedDueDate)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No priorities yet</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duration" className="mt-6">
          <DurationIntelligenceTab />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <PriorityConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PriorityConfigTab() {
  const { toast } = useToast();
  
  const { data: config, isLoading } = useQuery<{
    wImpact: string;
    wUrgency: string;
    wConfidence: string;
    wResource: string;
  }>({
    queryKey: ["/api/intelligence/priority-config"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/intelligence/priority-config", data),
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence/priority-config"] });
    },
    onError: () => {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    },
  });

  const [weights, setWeights] = useState({
    wImpact: "0.4",
    wUrgency: "0.3",
    wConfidence: "0.2",
    wResource: "0.1",
  });

  const handleSave = () => {
    updateConfigMutation.mutate(weights);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority Scoring Configuration</CardTitle>
        <CardDescription>
          Adjust the weights used to calculate priority scores. All weights should sum to 1.0.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Commercial Impact Weight</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={weights.wImpact}
              onChange={(e) => setWeights({ ...weights, wImpact: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              data-testid="input-weight-impact"
            />
            <p className="text-xs text-muted-foreground">Weight given to commercial/revenue impact</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Urgency Weight</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={weights.wUrgency}
              onChange={(e) => setWeights({ ...weights, wUrgency: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              data-testid="input-weight-urgency"
            />
            <p className="text-xs text-muted-foreground">Weight given to time-sensitivity</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confidence Weight</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={weights.wConfidence}
              onChange={(e) => setWeights({ ...weights, wConfidence: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              data-testid="input-weight-confidence"
            />
            <p className="text-xs text-muted-foreground">Weight given to insight confidence score</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Resource Feasibility Weight</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={weights.wResource}
              onChange={(e) => setWeights({ ...weights, wResource: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              data-testid="input-weight-resource"
            />
            <p className="text-xs text-muted-foreground">Weight given to resource availability</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateConfigMutation.isPending} data-testid="button-save-config">
          {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DurationIntelligenceTab() {
  const { toast } = useToast();
  const [predictionForm, setPredictionForm] = useState({
    taskType: "general",
    complexity: "medium",
  });

  const { data: modelStats, isLoading: statsLoading } = useQuery<ModelStats>({
    queryKey: ["/api/intelligence/duration/stats"],
  });

  const { data: recentPredictions, isLoading: predictionsLoading } = useQuery<DurationPrediction[]>({
    queryKey: ["/api/intelligence/duration/predictions"],
  });

  const { data: commercialPriorities, isLoading: prioritiesLoading } = useQuery<CommercialPriority[]>({
    queryKey: ["/api/intelligence/commercial-impact/priorities"],
  });

  const { data: capacityProfiles, isLoading: capacityLoading } = useQuery<CapacityProfile[]>({
    queryKey: ["/api/intelligence/resource-optimization/capacity"],
  });

  const predictMutation = useMutation({
    mutationFn: async (input: { taskType: string; complexity: string }) => {
      const response = await apiRequest("POST", "/api/intelligence/duration/predict", input);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Prediction generated",
        description: `Predicted duration: ${data.predictedHours.toFixed(1)} hours (${data.confidenceLevel} confidence)`,
      });
    },
    onError: () => {
      toast({
        title: "Prediction failed",
        description: "Failed to generate duration prediction",
        variant: "destructive",
      });
    },
  });

  const getConfidenceBadge = (level: string) => {
    const styles: Record<string, string> = {
      high: "bg-green-500 text-white",
      medium: "bg-yellow-500 text-black",
      low: "bg-red-500 text-white",
    };
    return <Badge className={styles[level] || "bg-muted"}>{level}</Badge>;
  };

  const getImpactColor = (score: number) => {
    if (score >= 80) return "bg-red-500";
    if (score >= 60) return "bg-orange-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getDayName = (day: number) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[day] || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Historical Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-3xl font-bold" data-testid="text-historical-records">
                {modelStats?.totalHistoricalRecords || 0}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Avg Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-3xl font-bold" data-testid="text-avg-variance">
                {modelStats?.avgVariancePercent?.toFixed(1) || 0}%
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Cold Start Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-3xl font-bold" data-testid="text-cold-start-rate">
                {((modelStats?.coldStartRate || 0) * 100).toFixed(0)}%
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Capacity Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {capacityLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-3xl font-bold" data-testid="text-capacity-profiles">
                {capacityProfiles?.length || 0}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Quick Prediction
            </CardTitle>
            <CardDescription>Generate a duration estimate for a task type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Task Type</label>
                <select
                  value={predictionForm.taskType}
                  onChange={(e) => setPredictionForm({ ...predictionForm, taskType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  data-testid="select-task-type"
                >
                  <option value="general">General</option>
                  <option value="content">Content</option>
                  <option value="design">Design</option>
                  <option value="development">Development</option>
                  <option value="review">Review</option>
                  <option value="research">Research</option>
                  <option value="meeting">Meeting</option>
                  <option value="reporting">Reporting</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Complexity</label>
                <select
                  value={predictionForm.complexity}
                  onChange={(e) => setPredictionForm({ ...predictionForm, complexity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  data-testid="select-complexity"
                >
                  <option value="simple">Simple</option>
                  <option value="medium">Medium</option>
                  <option value="complex">Complex</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <Button
              onClick={() => predictMutation.mutate(predictionForm)}
              disabled={predictMutation.isPending}
              data-testid="button-predict"
            >
              {predictMutation.isPending ? "Predicting..." : "Generate Prediction"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Confidence Distribution
            </CardTitle>
            <CardDescription>How confident are our predictions</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : modelStats?.confidenceDistribution ? (
              <div className="space-y-4">
                {Object.entries(modelStats.confidenceDistribution).map(([level, count]) => (
                  <div key={level} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{level}</span>
                      <span>{count}</span>
                    </div>
                    <Progress 
                      value={(count / Math.max(...Object.values(modelStats.confidenceDistribution), 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No prediction data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Predictions
            </CardTitle>
            <CardDescription>Latest duration predictions with confidence scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {predictionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentPredictions?.length ? (
                <div className="space-y-3">
                  {recentPredictions.map((prediction) => (
                    <div
                      key={prediction.id}
                      className="p-3 border rounded-lg space-y-2"
                      data-testid={`card-prediction-${prediction.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {parseFloat(prediction.predictedHours).toFixed(1)} hours
                        </span>
                        {getConfidenceBadge(prediction.confidenceLevel)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Confidence: {(parseFloat(prediction.confidenceScore) * 100).toFixed(0)}%</span>
                        {prediction.isColdStart && (
                          <Badge variant="outline" className="text-xs">
                            Cold Start
                          </Badge>
                        )}
                      </div>
                      {prediction.coldStartReason && (
                        <p className="text-xs text-muted-foreground">{prediction.coldStartReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No predictions yet. Generate one using the form above.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Commercial Priority Queue
            </CardTitle>
            <CardDescription>Tasks ranked by commercial impact</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {prioritiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : commercialPriorities?.length ? (
                <div className="space-y-3">
                  {commercialPriorities.map((priority, index) => (
                    <div
                      key={priority.taskId}
                      className="p-3 border rounded-lg space-y-2"
                      data-testid={`card-priority-${priority.taskId}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                          <span className="font-medium truncate max-w-[180px]">
                            {priority.taskDescription || "Untitled Task"}
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded text-white text-sm font-medium ${getImpactColor(priority.totalImpactScore)}`}>
                          {priority.totalImpactScore.toFixed(0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{priority.clientName || "No Client"}</span>
                        {priority.slaAtRisk && (
                          <Badge variant="destructive" className="text-xs">
                            SLA Risk
                          </Badge>
                        )}
                        {priority.daysUntilDeadline !== null && (
                          <span className={priority.daysUntilDeadline <= 2 ? "text-red-500" : ""}>
                            {priority.daysUntilDeadline}d left
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span>Rev: {(priority.revenueImpact * 100).toFixed(0)}%</span>
                        <span>Tier: {(priority.clientTierWeight * 100).toFixed(0)}%</span>
                        <span>Deadline: {(priority.deadlineRiskWeight * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No commercial priorities calculated yet.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Task Types by Duration
          </CardTitle>
          <CardDescription>Task types with most historical data and average durations</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : modelStats?.topTaskTypes?.length ? (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {modelStats.topTaskTypes.map((taskType) => (
                <div key={taskType.taskType} className="p-4 border rounded-lg text-center">
                  <p className="font-medium capitalize">{taskType.taskType}</p>
                  <p className="text-2xl font-bold">{taskType.avgHours.toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">{taskType.count} samples</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              No task type data available yet. Complete more tasks to build the model.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
