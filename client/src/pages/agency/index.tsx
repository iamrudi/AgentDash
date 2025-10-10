import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgencyLayout } from "@/components/agency-layout";
import { Building2, FolderKanban, MessageSquare, TrendingUp } from "lucide-react";
import { Project, Client, Recommendation, ClientMessage } from "@shared/schema";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { DailyMetric } from "@shared/schema";
import { ClientFilter } from "@/components/client-filter";
import { useState } from "react";

export default function AgencyDashboard() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/agency/recommendations"],
  });

  const { data: messages } = useQuery<ClientMessage[]>({
    queryKey: ["/api/agency/messages"],
  });

  const { data: metrics } = useQuery<DailyMetric[]>({
    queryKey: ["/api/agency/metrics"],
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

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your agency's performance and key metrics
            </p>
          </div>
          <ClientFilter
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
          />
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
    </AgencyLayout>
  );
}
