import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { ProjectCard } from "@/components/dashboard/project-card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { Building2, FolderKanban, Users, DollarSign, TrendingUp, ChevronRight, MessageSquare } from "lucide-react";
import { Project, Client, DailyMetric, Recommendation, ClientMessage } from "@shared/schema";
import { format } from "date-fns";

export default function AgencyDashboard() {
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: metrics } = useQuery<DailyMetric[]>({
    queryKey: ["/api/agency/metrics"],
  });

  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/agency/recommendations"],
  });

  const { data: messages } = useQuery<ClientMessage[]>({
    queryKey: ["/api/agency/messages"],
  });

  const activeProjects = projects?.filter(p => p.status === "Active").length || 0;
  const totalClients = clients?.length || 0;
  const recentMetrics = metrics?.slice(0, 30) || [];
  const totalRevenue = recentMetrics.reduce((sum, m) => sum + parseFloat(m.spend || "0"), 0);
  const newRecommendations = recommendations?.filter(r => r.status === "New").length || 0;

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-semibold mb-2">Agency Dashboard</h1>
                <p className="text-muted-foreground">
                  Overview of all clients, projects, and performance metrics
                </p>
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
                        Total Revenue (30d)
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold font-mono" data-testid="text-total-revenue">
                      ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
                    <MetricsChart
                      data={recentMetrics}
                      metric="spend"
                      title="Ad Spend (Last 30 Days)"
                      chartType="line"
                    />
                    <MetricsChart
                      data={recentMetrics}
                      metric="clicks"
                      title="Clicks (Last 30 Days)"
                      chartType="area"
                    />
                  </>
                )}
              </div>

              {/* Client Messages */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Client Messages
                  </h2>
                  <Badge variant="secondary" data-testid="badge-message-count">
                    {messages?.filter(m => m.isRead === "false" && m.senderRole === "Client").length || 0} Unread
                  </Badge>
                </div>
                <Card>
                  <CardContent className="p-0">
                    {!messages || messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No messages yet</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {messages.slice(0, 10).map((message) => {
                          const client = clients?.find(c => c.id === message.clientId);
                          return (
                            <div
                              key={message.id}
                              className={`p-4 hover-elevate ${message.isRead === "false" && message.senderRole === "Client" ? "bg-muted/50" : ""}`}
                              data-testid={`message-item-${message.id}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold" data-testid={`message-client-${message.id}`}>
                                      {client?.companyName || "Unknown Client"}
                                    </p>
                                    <Badge variant={message.senderRole === "Client" ? "default" : "outline"} className="text-xs">
                                      {message.senderRole}
                                    </Badge>
                                    {message.isRead === "false" && message.senderRole === "Client" && (
                                      <Badge variant="secondary" className="text-xs">New</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`message-text-${message.id}`}>
                                    {message.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
                                </div>
                                <Link href={`/agency/clients/${message.clientId}`}>
                                  <Button variant="ghost" size="sm" data-testid={`button-view-message-${message.id}`}>
                                    View
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Recent Projects */}
              <section>
                <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects?.slice(0, 6).map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>

              {/* Clients List */}
              <section>
                <h2 className="text-xl font-semibold mb-4">All Clients</h2>
                <div className="space-y-2">
                  {clients?.map((client) => (
                    <Card key={client.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-medium" data-testid={`text-client-${client.id}`}>
                                {client.companyName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Client ID: {client.id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                          <Link href={`/agency/clients/${client.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-client-${client.id}`}>
                              View Details
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Recent Recommendations */}
              <section>
                <h2 className="text-xl font-semibold mb-4">Recent Recommendations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations?.slice(0, 4).map((rec) => (
                    <RecommendationCard key={rec.id} recommendation={rec} />
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
