import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { Client } from "@shared/schema";
import { useState } from "react";

interface GA4Integration {
  connected: boolean;
  ga4PropertyId?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

export default function ClientDetail() {
  const [, params] = useRoute("/agency/clients/:clientId");
  const clientId = params?.clientId;
  const { toast } = useToast();
  const [selectedProperty, setSelectedProperty] = useState<string>("");

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: [`/api/agency/clients/${clientId}`],
    enabled: !!clientId,
  });

  const { data: ga4Integration, isLoading: integrationLoading } = useQuery<GA4Integration>({
    queryKey: [`/api/integrations/ga4/${clientId}`],
    enabled: !!clientId,
  });

  const { data: ga4Properties, isLoading: propertiesLoading } = useQuery<GA4Property[]>({
    queryKey: [`/api/integrations/ga4/${clientId}/properties`],
    enabled: !!clientId && ga4Integration?.connected === true,
  });

  const initiateOAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/oauth/google/initiate?clientId=${clientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }
      return await response.json() as { authUrl: string };
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "OAuth Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return await apiRequest(
        "POST",
        `/api/integrations/ga4/${clientId}/property`,
        { ga4PropertyId: propertyId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integrations/ga4/${clientId}`] });
      toast({
        title: "Success",
        description: "GA4 property saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveProperty = () => {
    if (selectedProperty) {
      savePropertyMutation.mutate(selectedProperty);
    }
  };

  const style = {
    "--sidebar-width": "16rem",
  };

  if (clientLoading) {
    return (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!client) {
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
              <p className="text-muted-foreground">Client not found</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

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
                <h1 className="text-3xl font-semibold mb-2" data-testid="text-client-name">
                  {client.companyName}
                </h1>
                <p className="text-muted-foreground">
                  Manage client details and integrations
                </p>
              </div>

              <Tabs defaultValue="integrations" className="w-full">
                <TabsList>
                  <TabsTrigger value="integrations" data-testid="tab-integrations">
                    Integrations
                  </TabsTrigger>
                  <TabsTrigger value="details" data-testid="tab-details">
                    Details
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="integrations" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Google Analytics 4</CardTitle>
                          <CardDescription>
                            Connect client's GA4 property for analytics integration
                          </CardDescription>
                        </div>
                        <div>
                          {integrationLoading ? (
                            <Badge variant="outline">Loading...</Badge>
                          ) : ga4Integration?.connected ? (
                            <Badge variant="default" className="gap-1" data-testid="badge-ga4-connected">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1" data-testid="badge-ga4-disconnected">
                              <XCircle className="h-3 w-3" />
                              Not Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!ga4Integration?.connected ? (
                        <div>
                          <p className="text-sm text-muted-foreground mb-4">
                            Client needs to authorize access to their Google Analytics account.
                            Click the button below to initiate the OAuth flow.
                          </p>
                          <Button
                            onClick={() => initiateOAuthMutation.mutate()}
                            disabled={initiateOAuthMutation.isPending}
                            data-testid="button-connect-ga4"
                          >
                            {initiateOAuthMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Initiating...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Connect Google Analytics
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Connected At</p>
                              <p className="font-medium">
                                {ga4Integration.createdAt ? new Date(ga4Integration.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Updated</p>
                              <p className="font-medium">
                                {ga4Integration.updatedAt ? new Date(ga4Integration.updatedAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="ga4-property" className="text-sm font-medium">
                              GA4 Property
                            </label>
                            {propertiesLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading properties...
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Select
                                  value={selectedProperty || ga4Integration.ga4PropertyId || ""}
                                  onValueChange={setSelectedProperty}
                                >
                                  <SelectTrigger className="flex-1" data-testid="select-ga4-property">
                                    <SelectValue placeholder="Select a GA4 property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ga4Properties?.map((property) => (
                                      <SelectItem key={property.propertyId} value={property.propertyId}>
                                        {property.displayName} ({property.accountName})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  onClick={handleSaveProperty}
                                  disabled={!selectedProperty || savePropertyMutation.isPending}
                                  data-testid="button-save-property"
                                >
                                  {savePropertyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </div>
                            )}
                            {ga4Integration.ga4PropertyId && (
                              <p className="text-sm text-muted-foreground">
                                Current: {ga4Integration.ga4PropertyId}
                              </p>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => initiateOAuthMutation.mutate()}
                            disabled={initiateOAuthMutation.isPending}
                            data-testid="button-reconnect-ga4"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Reconnect
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Client Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Company Name</p>
                          <p className="font-medium">{client.companyName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Client ID</p>
                          <p className="font-mono text-xs">{client.id}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
