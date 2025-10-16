import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProjectCard } from "@/components/dashboard/project-card";
import { InvoiceCard } from "@/components/dashboard/invoice-card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAuthUser, clearAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { Building2, LogOut, FolderKanban, FileText, Lightbulb, TrendingUp, AlertCircle, Link as LinkIcon, Target } from "lucide-react";
import { ProjectWithClient, InvoiceWithClient, RecommendationWithClient, ClientObjective } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface GA4Integration {
  connected: boolean;
  ga4PropertyId?: string;
  connectedAt?: string;
  lastUpdated?: string;
}

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const authUser = getAuthUser();
  const { toast } = useToast();
  const [searchParams] = useLocation();

  const { data: projects, isLoading: loadingProjects } = useQuery<ProjectWithClient[]>({
    queryKey: ["/api/client/projects"],
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/client/invoices"],
  });

  const { data: recommendations, isLoading: loadingRecommendations } = useQuery<RecommendationWithClient[]>({
    queryKey: ["/api/client/recommendations"],
  });

  const { data: objectives = [] } = useQuery<ClientObjective[]>({
    queryKey: ["/api/client/objectives"],
    enabled: !!authUser && authUser.profile.role === "Client",
  });

  // First fetch the client record to get client ID
  const { data: clientRecord } = useQuery<{ id: string; companyName: string }>({
    queryKey: ["/api/client/profile"],
    enabled: !!authUser && authUser.profile.role === "Client",
  });

  const { data: ga4Integration } = useQuery<GA4Integration>({
    queryKey: ['/api/integrations/ga4', clientRecord?.id],
    enabled: !!clientRecord?.id,
  });

  // Handle OAuth callback success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("oauth_success");
    const error = params.get("oauth_error");

    if (success === "true") {
      toast({
        title: "Connected Successfully",
        description: "Your Google Analytics account has been connected.",
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      if (!clientRecord?.id) {
        throw new Error("Client ID not available");
      }

      if (!authUser?.token) {
        throw new Error("Not authenticated");
      }

      // Include service and returnTo parameters for context-aware OAuth redirect
      const returnTo = encodeURIComponent(window.location.pathname);
      const response = await fetch(`/api/oauth/google/initiate?clientId=${clientRecord.id}&service=GA4&returnTo=${returnTo}`, {
        headers: {
          Authorization: `Bearer ${authUser.token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate OAuth");
      }

      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    },
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
        {/* GA4 Integration Banner */}
        {ga4Integration && !ga4Integration.connected && (
          <Alert className="mb-6 border-primary/20 bg-primary/5" data-testid="alert-ga4-integration">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Connect Google Analytics</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Google Analytics account to unlock AI-powered insights and recommendations based on your website data.
                </p>
              </div>
              <Button
                onClick={() => connectGoogleMutation.mutate()}
                disabled={connectGoogleMutation.isPending}
                className="shrink-0"
                data-testid="button-connect-google"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {connectGoogleMutation.isPending ? "Connecting..." : "Connect with Google"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Connected Integration Status */}
        {ga4Integration && ga4Integration.connected && (
          <Alert className="mb-6 border-green-500/20 bg-green-500/5" data-testid="alert-ga4-connected">
            <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Google Analytics Connected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your Google Analytics account is connected. {ga4Integration.ga4PropertyId && `Property: ${ga4Integration.ga4PropertyId}`}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

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

        {/* Active Objectives */}
        {objectives.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Objectives</h2>
            <div className="space-y-3">
              {objectives.map((objective) => (
                <Card key={objective.id} data-testid={`client-objective-${objective.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {objective.targetMetric}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{objective.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

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
