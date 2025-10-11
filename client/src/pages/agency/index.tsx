import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgencyLayout } from "@/components/agency-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, FolderKanban, MessageSquare, TrendingUp, Sparkles, MousePointer, Eye, DollarSign, AlertCircle } from "lucide-react";
import { Project, Client, Initiative, ClientMessage } from "@shared/schema";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { DailyMetric } from "@shared/schema";
import { ClientFilter } from "@/components/client-filter";
import { AIChatModal } from "@/components/ai-chat-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { format, subDays } from "date-fns";

interface GA4Data {
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

interface GSCData {
  rows: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

interface GSCQueryData {
  rows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

interface OutcomeMetrics {
  conversions: number;
  estimatedPipelineValue: number;
  cpa: number;
  organicClicks: number;
  spend: number;
}

export default function AgencyDashboard() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: recommendations } = useQuery<Initiative[]>({
    queryKey: ["/api/agency/recommendations"],
  });

  const { data: messages } = useQuery<ClientMessage[]>({
    queryKey: ["/api/agency/messages"],
  });

  const { data: metrics } = useQuery<DailyMetric[]>({
    queryKey: ["/api/agency/metrics"],
  });

  const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  const { data: ga4Data, isLoading: ga4Loading, error: ga4Error } = useQuery<GA4Data>({
    queryKey: ['/api/analytics/ga4', selectedClientId, { startDate, endDate }],
    enabled: selectedClientId !== "ALL",
  });

  const { data: gscData, isLoading: gscLoading, error: gscError } = useQuery<GSCData>({
    queryKey: ['/api/analytics/gsc', selectedClientId, { startDate, endDate }],
    enabled: selectedClientId !== "ALL",
  });

  const { data: gscQueries, isLoading: gscQueriesLoading, error: gscQueriesError } = useQuery<GSCQueryData>({
    queryKey: ['/api/analytics/gsc', selectedClientId, 'queries', { startDate, endDate }],
    enabled: selectedClientId !== "ALL",
  });

  const { data: outcomeMetrics, isLoading: outcomeLoading, error: outcomeError } = useQuery<OutcomeMetrics>({
    queryKey: ['/api/analytics/outcome-metrics', selectedClientId, { startDate, endDate }],
    enabled: selectedClientId !== "ALL",
  });

  // Filter data based on selected client
  const filteredProjects = selectedClientId === "ALL" 
    ? projects 
    : projects?.filter(p => p.clientId === selectedClientId);
  
  const filteredRecommendations = selectedClientId === "ALL"
    ? recommendations
    : recommendations?.filter(r => r.clientId === selectedClientId);
  
  const filteredMessages = selectedClientId === "ALL"
    ? messages
    : messages?.filter(m => m.clientId === selectedClientId);
  
  const filteredMetrics = selectedClientId === "ALL"
    ? metrics
    : metrics?.filter(m => m.clientId === selectedClientId);

  const activeProjects = filteredProjects?.filter(p => p.status === "Active").length || 0;
  const totalClients = clients?.length || 0;
  const newRecommendations = filteredRecommendations?.filter(r => r.status === "New").length || 0;
  const unreadMessages = filteredMessages?.filter(m => m.isRead === "false" && m.senderRole === "Client").length || 0;
  const recentMetrics = filteredMetrics?.slice(0, 30) || [];
  const totalRevenue = recentMetrics.reduce((sum, m) => sum + parseFloat(m.spend || "0"), 0);

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const topQueries = gscQueries?.rows?.slice(0, 10) || [];
  const totalClicks = gscData?.rows ? gscData.rows.reduce((sum, row) => sum + (parseInt(row.metricValues?.[0]?.value) || 0), 0) : 0;
  const totalImpressions = gscData?.rows ? gscData.rows.reduce((sum, row) => sum + (parseInt(row.metricValues?.[1]?.value) || 0), 0) : 0;
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition = gscData?.rows?.length ? 
    gscData.rows.reduce((sum, row) => sum + (parseFloat(row.metricValues?.[3]?.value) || 0), 0) / gscData.rows.length : 0;

  const MetricCardSkeleton = () => (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-20" />
      </CardContent>
    </Card>
  );

  const ErrorAlert = ({ title, message }: { title: string; message: string }) => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your agency's performance and key metrics
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ClientFilter
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
            {selectedClientId !== "ALL" && selectedClient && (
              <Button 
                onClick={() => setIsAiModalOpen(true)}
                className="gap-2"
                data-testid="button-chat-with-data"
              >
                <Sparkles className="h-4 w-4" />
                Chat with Client Data
              </Button>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Clients
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-total-clients">
                {totalClients}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Projects
                </CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-active-projects">
                {activeProjects}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unread Messages
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-unread-messages">
                {unreadMessages}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  New Recommendations
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-new-recommendations">
                {newRecommendations}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client-Specific Analytics */}
        {selectedClientId !== "ALL" && selectedClient && (
          <>
            <div className="border-t pt-6">
              <h2 className="text-2xl font-semibold mb-4">Analytics for {selectedClient.companyName}</h2>
              
              {/* Outcome Metrics */}
              {outcomeError && (
                <ErrorAlert 
                  title="Failed to Load Metrics" 
                  message={(outcomeError as Error).message || "Unable to fetch outcome metrics. Please try again."} 
                />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {outcomeLoading ? (
                  <>
                    <MetricCardSkeleton />
                    <MetricCardSkeleton />
                    <MetricCardSkeleton />
                    <MetricCardSkeleton />
                  </>
                ) : outcomeMetrics ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Conversions
                          </CardTitle>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold font-mono" data-testid="text-conversions">
                          {outcomeMetrics.conversions}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pipeline Value
                          </CardTitle>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold font-mono" data-testid="text-pipeline-value">
                          ${outcomeMetrics.estimatedPipelineValue.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Organic Clicks
                          </CardTitle>
                          <MousePointer className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold font-mono" data-testid="text-organic-clicks">
                          {outcomeMetrics.organicClicks.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Cost per Acquisition
                          </CardTitle>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold font-mono" data-testid="text-cpa">
                          ${outcomeMetrics.cpa.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : null}
              </div>

              {/* GSC Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Clicks (GSC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      {totalClicks.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Impressions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      {totalImpressions.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Average CTR
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      {avgCTR.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Average Position
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      {avgPosition.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Performing Queries Table */}
              <Card data-testid="card-top-queries">
                <CardHeader>
                  <CardTitle>Top Performing Search Queries</CardTitle>
                  <CardDescription>Best organic search terms from Google Search Console</CardDescription>
                </CardHeader>
                <CardContent>
                  {gscQueriesError && <ErrorAlert title="Query Data Error" message={(gscQueriesError as Error).message || "Failed to load query data"} />}
                  {gscQueriesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : topQueries.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Query</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Avg. Position</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topQueries.map((query, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{query.keys[0]}</TableCell>
                            <TableCell className="text-right">{query.clicks}</TableCell>
                            <TableCell className="text-right">{query.impressions}</TableCell>
                            <TableCell className="text-right">{(query.ctr * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{query.position.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No query data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recentMetrics.length > 0 && (
            <>
              <MetricsChart
                data={recentMetrics}
                metric="sessions"
                title="Sessions (Last 30 Days)"
                chartType="area"
              />
              <MetricsChart
                data={recentMetrics}
                metric="conversions"
                title="Conversions (Last 30 Days)"
                chartType="bar"
              />
            </>
          )}
        </div>
      </div>

      {/* AI Chat Modal */}
      {selectedClient && (
        <AIChatModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          contextData={{
            clientId: selectedClient.id,
            clientName: selectedClient.companyName,
            outcomeMetrics,
            gscData,
            gscQueries,
            dateRange: { startDate, endDate }
          }}
          initialQuestion={`What opportunities do you see for ${selectedClient.companyName}?`}
        />
      )}
    </AgencyLayout>
  );
}
