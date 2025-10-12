import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown, MousePointer, DollarSign, Users, Eye, CheckCircle, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import type { ClientObjective, Task, Initiative, Invoice } from "@shared/schema";

interface OutcomeMetrics {
  conversions: number;
  estimatedPipelineValue: number;
  cpa: number;
  organicClicks: number;
  comparisonPeriodData?: {
    conversions: number;
    estimatedPipelineValue: number;
    cpa: number;
    organicClicks: number;
  };
}

interface TaskWithProject extends Task {
  project?: {
    id: string;
    name: string;
  };
}

export default function Dashboard() {
  const { data: clientRecord } = useQuery<{ id: string; companyName: string }>({
    queryKey: ["/api/client/profile"],
  });

  const { data: objectives = [] } = useQuery<ClientObjective[]>({
    queryKey: ["/api/client/objectives"],
    enabled: !!clientRecord?.id,
  });

  const { data: outcomeMetrics } = useQuery<OutcomeMetrics>({
    queryKey: ["/api/analytics/outcome-metrics", clientRecord?.id],
    enabled: !!clientRecord?.id,
  });

  const { data: recentTasks = [] } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/client/tasks/recent"],
    enabled: !!clientRecord?.id,
  });

  const { data: pendingInitiatives = [] } = useQuery<Initiative[]>({
    queryKey: ["/api/client/initiatives"],
    select: (data) => data.filter((i: Initiative) => i.status === "Awaiting Approval"),
  });

  const { data: overdueInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/client/invoices"],
    select: (data) => data.filter((inv: Invoice) => {
      if (inv.status !== "Pending") return false;
      const dueDate = new Date(inv.dueDate);
      return dueDate < new Date();
    }),
  });

  const activeObjective = objectives.find(o => o.isActive) || objectives[0];

  const calculateChange = (current: number, previous: number): { percentage: number; isPositive: boolean } => {
    if (!previous || previous === 0) return { percentage: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { percentage: Math.abs(change), isPositive: change >= 0 };
  };

  const kpiData = [
    {
      title: "Leads / Conversions",
      value: outcomeMetrics?.conversions || 0,
      icon: Users,
      change: outcomeMetrics?.comparisonPeriodData
        ? calculateChange(outcomeMetrics.conversions, outcomeMetrics.comparisonPeriodData.conversions)
        : null,
      testId: "card-kpi-conversions",
    },
    {
      title: "Pipeline Value",
      value: `$${(outcomeMetrics?.estimatedPipelineValue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: outcomeMetrics?.comparisonPeriodData
        ? calculateChange(outcomeMetrics.estimatedPipelineValue, outcomeMetrics.comparisonPeriodData.estimatedPipelineValue)
        : null,
      testId: "card-kpi-pipeline",
    },
    {
      title: "Cost Per Acquisition",
      value: `$${(outcomeMetrics?.cpa || 0).toFixed(2)}`,
      icon: TrendingDown,
      change: outcomeMetrics?.comparisonPeriodData && outcomeMetrics.comparisonPeriodData.cpa > 0
        ? {
            ...calculateChange(outcomeMetrics.cpa, outcomeMetrics.comparisonPeriodData.cpa),
            isPositive: outcomeMetrics.cpa < outcomeMetrics.comparisonPeriodData.cpa,
          }
        : null,
      testId: "card-kpi-cpa",
    },
    {
      title: "Organic Clicks",
      value: (outcomeMetrics?.organicClicks || 0).toLocaleString(),
      icon: MousePointer,
      change: outcomeMetrics?.comparisonPeriodData
        ? calculateChange(outcomeMetrics.organicClicks, outcomeMetrics.comparisonPeriodData.organicClicks)
        : null,
      testId: "card-kpi-organic",
    },
  ];

  const actionItemsCount = pendingInitiatives.length + overdueInvoices.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-performance-overview">Performance Overview</h1>
        <p className="text-muted-foreground mt-1">Your 10-second health check</p>
      </div>

      {/* Client Objective Card - Prominent and Personalized */}
      {activeObjective ? (
        <Card data-testid="card-client-objective" className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-lg">Your Primary Objective</div>
                <Badge variant="outline" className="mt-1">
                  {activeObjective.targetMetric}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-base leading-relaxed">
              {activeObjective.description}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-client-objective">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Client Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No active objective set. Contact your account manager to set strategic goals.</p>
          </CardContent>
        </Card>
      )}

      {/* Real KPI Scorecards with Trend Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title} data-testid={kpi.testId} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`${kpi.testId}-value`}>
                {kpi.value}
              </div>
              {kpi.change ? (
                <div className="flex items-center gap-1 mt-1">
                  {kpi.change.isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-500" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      kpi.change.isPositive
                        ? "text-green-600 dark:text-green-500"
                        : "text-red-600 dark:text-red-500"
                    }`}
                    data-testid={`${kpi.testId}-change`}
                  >
                    {kpi.change.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs previous period</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {outcomeMetrics ? "No comparison data" : "Loading metrics..."}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Needs Your Attention Widget */}
      {actionItemsCount > 0 && (
        <Card data-testid="card-needs-attention" className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              Needs Your Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInitiatives.length > 0 && (
              <Link href="/client/recommendations">
                <button className="w-full text-left p-3 rounded-lg border hover-elevate active-elevate-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {pendingInitiatives.length} new recommendation{pendingInitiatives.length > 1 ? "s" : ""} to review
                        </p>
                        <p className="text-sm text-muted-foreground">Review and approve strategic initiatives</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              </Link>
            )}
            {overdueInvoices.length > 0 && (
              <Link href="/client/billing">
                <button className="w-full text-left p-3 rounded-lg border hover-elevate active-elevate-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-red-600 dark:text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">Payment required</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* What's Happening Now Widget */}
      <Card data-testid="card-whats-happening">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              What's Happening Now
            </CardTitle>
            <Link href="/client/projects">
              <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
                View all projects
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTasks.length > 0 ? (
            <div className="space-y-3">
              {recentTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border hover-elevate"
                  data-testid={`task-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            task.status === "Completed"
                              ? "default"
                              : task.status === "In Progress"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {task.status}
                        </Badge>
                        {task.priority === "High" && (
                          <Badge variant="destructive" className="text-xs">
                            High Priority
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.project && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Project: {task.project.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                    {task.status === "Completed" && (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">Check back soon for updates on your projects</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
