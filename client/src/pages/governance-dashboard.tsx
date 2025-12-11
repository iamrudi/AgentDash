import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle, Clock, RefreshCw, Building2, Users, Activity, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalAgencies: number;
  totalUsers: number;
  unhealthyIntegrations: number;
  expiringTokens: number;
  quotasNearLimit: number;
}

interface DashboardData {
  stats: DashboardStats;
  alerts: {
    unhealthyIntegrations: Array<{
      id: string;
      agencyId: string;
      integration: string;
      status: string;
      lastErrorMessage: string | null;
      consecutiveFailures: number;
    }>;
    expiringTokens: Array<{
      id: string;
      agencyId: string;
      integration: string;
      tokenExpiresAt: string;
    }>;
    quotasNearLimit: Array<{
      id: string;
      agencyId: string;
      aiTokenUsed: number;
      aiTokenLimit: number;
      billingPlan: string;
    }>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    resourceType: string;
    createdAt: string;
  }>;
}

interface QuotaSummary {
  agencyId: string;
  aiTokens: { used: number; limit: number; percent: number };
  aiRequests: { used: number; limit: number; percent: number };
  storage: { used: number; limit: number; percent: number };
  seats: { used: number; limit: number; percent: number };
  clients: { used: number; limit: number; percent: number };
  projects: { used: number; limit: number; percent: number };
  billingPlan: string;
  warningThreshold: number;
  quotaExceeded: boolean;
  quotaWarning: boolean;
}

interface Agency {
  agency: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
  quota: {
    billingPlan: string;
    aiTokenUsed: number;
    aiTokenLimit: number;
  } | null;
  userCount: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    healthy: { variant: "default", icon: CheckCircle },
    degraded: { variant: "secondary", icon: AlertCircle },
    failed: { variant: "destructive", icon: AlertCircle },
    unknown: { variant: "outline", icon: Clock },
  };
  
  const config = variants[status] || variants.unknown;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="flex items-center gap-1" data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}

function QuotaProgressBar({ label, used, limit, percent }: { label: string; used: number; limit: number; percent: number }) {
  const getColorClass = () => {
    if (percent >= 90) return "bg-destructive";
    if (percent >= 80) return "bg-yellow-500";
    return "";
  };
  
  return (
    <div className="space-y-1" data-testid={`quota-progress-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      <Progress value={percent} className={getColorClass()} />
    </div>
  );
}

export default function GovernanceDashboard() {
  const { toast } = useToast();
  
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/governance/dashboard"],
  });
  
  const { data: agencies, isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/governance/agencies"],
  });

  const syncQuotaMutation = useMutation({
    mutationFn: async (agencyId: string) => {
      return apiRequest("POST", `/api/governance/quotas/${agencyId}/sync`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Quota synchronized successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/governance"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sync quota", variant: "destructive" });
    },
  });

  const runHealthCheckMutation = useMutation({
    mutationFn: async (agencyId: string) => {
      return apiRequest("POST", `/api/governance/integrations/health/${agencyId}/check`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Health check completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/governance"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Health check failed", variant: "destructive" });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = dashboard?.stats;

  return (
    <div className="p-6 space-y-6" data-testid="page-governance-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Governance Dashboard</h1>
          <p className="text-muted-foreground">Monitor agencies, quotas, and integration health</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchDashboard()}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-stat-agencies">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agencies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-agencies">{stats?.totalAgencies || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-users">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-users">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-unhealthy">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unhealthy Integrations</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-unhealthy">{stats?.unhealthyIntegrations || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-expiring">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Tokens</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-expiring">{stats?.expiringTokens || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-quotas">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Quota Limit</CardTitle>
            <Activity className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-quotas">{stats?.quotasNearLimit || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agencies" className="space-y-4">
        <TabsList data-testid="tabs-governance">
          <TabsTrigger value="agencies" data-testid="tab-agencies">Agencies</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="agencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agency Overview</CardTitle>
              <CardDescription>Manage agency quotas and resources</CardDescription>
            </CardHeader>
            <CardContent>
              {agenciesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agency</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>AI Tokens</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies?.map((agency) => (
                      <TableRow key={agency.agency.id} data-testid={`row-agency-${agency.agency.id}`}>
                        <TableCell className="font-medium" data-testid={`text-agency-name-${agency.agency.id}`}>
                          {agency.agency.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-plan-${agency.agency.id}`}>
                            {agency.quota?.billingPlan || "starter"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-user-count-${agency.agency.id}`}>
                          {agency.userCount}
                        </TableCell>
                        <TableCell>
                          {agency.quota ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={(agency.quota.aiTokenUsed / agency.quota.aiTokenLimit) * 100}
                                className="w-20"
                              />
                              <span className="text-xs text-muted-foreground">
                                {((agency.quota.aiTokenUsed / agency.quota.aiTokenLimit) * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No quota</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => syncQuotaMutation.mutate(agency.agency.id)}
                              disabled={syncQuotaMutation.isPending}
                              data-testid={`button-sync-quota-${agency.agency.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncQuotaMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => runHealthCheckMutation.mutate(agency.agency.id)}
                              disabled={runHealthCheckMutation.isPending}
                              data-testid={`button-health-check-${agency.agency.id}`}
                            >
                              <Activity className={`w-4 h-4 ${runHealthCheckMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Unhealthy Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.alerts.unhealthyIntegrations.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground" data-testid="text-no-unhealthy">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    All integrations healthy
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard?.alerts.unhealthyIntegrations.map((integration) => (
                      <div
                        key={integration.id}
                        className="flex items-center justify-between p-2 rounded border"
                        data-testid={`alert-integration-${integration.id}`}
                      >
                        <div>
                          <p className="font-medium">{integration.integration}</p>
                          <p className="text-sm text-muted-foreground">{integration.lastErrorMessage}</p>
                        </div>
                        <StatusBadge status={integration.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Expiring Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.alerts.expiringTokens.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground" data-testid="text-no-expiring">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    No tokens expiring soon
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard?.alerts.expiringTokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center justify-between p-2 rounded border"
                        data-testid={`alert-token-${token.id}`}
                      >
                        <div>
                          <p className="font-medium">{token.integration}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires: {new Date(token.tokenExpiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary">Action Required</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-yellow-500" />
                Quotas Near Limit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.alerts.quotasNearLimit.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground" data-testid="text-no-quota-alerts">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  All agencies within quota limits
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agency ID</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>AI Token Usage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.alerts.quotasNearLimit.map((quota) => (
                      <TableRow key={quota.id} data-testid={`row-quota-alert-${quota.id}`}>
                        <TableCell className="font-mono text-sm">{quota.agencyId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">{quota.billingPlan}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(quota.aiTokenUsed / quota.aiTokenLimit) * 100}
                              className="w-24"
                            />
                            <span className="text-sm">
                              {((quota.aiTokenUsed / quota.aiTokenLimit) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Near Limit</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Recent Governance Activity
              </CardTitle>
              <CardDescription>Audit trail of administrative actions</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activity">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-2">
                  {dashboard?.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 rounded border"
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div>
                          <p className="font-medium">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">{activity.resourceType}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
