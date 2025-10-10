import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { InvoiceCard } from "@/components/dashboard/invoice-card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAuthUser, clearAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { Building2, LogOut, FolderKanban, FileText, Lightbulb, TrendingUp } from "lucide-react";
import { ProjectWithClient, InvoiceWithClient, RecommendationWithClient } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const authUser = getAuthUser();

  const { data: projects, isLoading: loadingProjects } = useQuery<ProjectWithClient[]>({
    queryKey: ["/api/client/projects"],
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/client/invoices"],
  });

  const { data: recommendations, isLoading: loadingRecommendations } = useQuery<RecommendationWithClient[]>({
    queryKey: ["/api/client/recommendations"],
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  if (!authUser) return null;

  const initials = authUser.profile.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const activeProjects = projects?.filter(p => p.status === "Active") || [];
  const pendingInvoices = invoices?.filter(i => i.status === "Pending") || [];
  const newRecommendations = recommendations?.filter(r => r.status === "New") || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Client Portal</h1>
                <p className="text-xs text-muted-foreground">{authUser.profile.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <div className="text-3xl font-bold font-mono" data-testid="text-active-projects-count">
                {activeProjects.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Invoices
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-pending-invoices-count">
                {pendingInvoices.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  New Recommendations
                </CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid="text-new-recommendations-count">
                {newRecommendations.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Projects */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Projects</h2>
          {loadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted/50" />
                </Card>
              ))}
            </div>
          ) : activeProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No active projects at this time
              </CardContent>
            </Card>
          )}
        </section>

        {/* Pending Invoices */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Invoices</h2>
          {loadingInvoices ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-24 bg-muted/50" />
                </Card>
              ))}
            </div>
          ) : pendingInvoices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending invoices
              </CardContent>
            </Card>
          )}
        </section>

        {/* AI Recommendations */}
        <section>
          <h2 className="text-xl font-semibold mb-4">AI Recommendations</h2>
          {loadingRecommendations ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-32 bg-muted/50" />
                </Card>
              ))}
            </div>
          ) : newRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newRecommendations.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No new recommendations available
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
