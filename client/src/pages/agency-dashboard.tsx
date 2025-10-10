import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { ProjectCard } from "@/components/dashboard/project-card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { Building2, FolderKanban, Users, DollarSign, TrendingUp } from "lucide-react";
import { Project, Client, DailyMetric, Recommendation } from "@shared/schema";

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

  const activeProjects = projects?.filter(p => p.status === "Active").length || 0;
  const totalClients = clients?.length || 0;
  const recentMetrics = metrics?.slice(0, 30) || [];
  const totalRevenue = recentMetrics.reduce((sum, m) => sum + parseFloat(m.spend), 0);
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

              {/* Recent Projects */}
              <section>
                <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects?.slice(0, 6).map((project) => (
                    <ProjectCard key={project.id} project={project} />
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
