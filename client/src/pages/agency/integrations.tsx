import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Client } from "@shared/schema";
import { Building2, CheckCircle2, XCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuthStatus } from "@/context/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface IntegrationStatus {
  connected: boolean;
  ga4PropertyId?: string;
  ga4LeadEventName?: string;
  gscSiteUrl?: string;
  expiresAt?: Date;
}

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export default function AgencyIntegrationsPage() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { authReady } = useAuthStatus();
  
  // Dialog states
  const [ga4DialogOpen, setGa4DialogOpen] = useState(false);
  const [gscDialogOpen, setGscDialogOpen] = useState(false);
  const [editLeadEventDialogOpen, setEditLeadEventDialogOpen] = useState(false);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [linkedinDialogOpen, setLinkedinDialogOpen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState("");
  const [selectedGA4Property, setSelectedGA4Property] = useState("");
  const [leadEventName, setLeadEventName] = useState("");
  const [selectedGSCSite, setSelectedGSCSite] = useState("");
  const [hubspotToken, setHubspotToken] = useState("");
  const [linkedinAccessToken, setLinkedinAccessToken] = useState("");
  const [linkedinOrganizationId, setLinkedinOrganizationId] = useState("");
  
  // Check for OAuth success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const clientId = params.get("clientId");
    const service = params.get("service") as 'GA4' | 'GSC' | null;
    const oauthError = params.get("oauth_error");

    if (success === "google_connected" && clientId && service) {
      toast({
        title: "OAuth Successful",
        description: "Google integration connected. Please select a property/site.",
      });
      
      // Open appropriate dialog(s) based on service
      setCurrentClientId(clientId);
      if (service === 'GA4') {
        setGa4DialogOpen(true);
      } else if (service === 'GSC') {
        setGscDialogOpen(true);
      }
      
      // Clean URL
      window.history.replaceState({}, "", "/agency/integrations");
    }

    if (oauthError) {
      toast({
        title: "OAuth Failed",
        description: `Authentication error: ${oauthError}`,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/agency/integrations");
    }
  }, [toast]);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
    enabled: authReady,
  });

  // Fetch HubSpot connection status
  const { data: hubspotStatus } = useQuery<{ connected: boolean; contactCount?: number; dealCount?: number; companyCount?: number }>({
    queryKey: ["/api/integrations/hubspot/status"],
    enabled: authReady,
  });

  // Fetch LinkedIn connection status
  const { data: linkedinStatus } = useQuery<{ connected: boolean; followerCount?: number; recentPostCount?: number; totalEngagement?: number }>({
    queryKey: ["/api/integrations/linkedin/status"],
    enabled: authReady,
  });

  // Filter clients based on selection
  const filteredClients = selectedClientId === "ALL"
    ? clients
    : clients?.filter(c => c.id === selectedClientId);

  // Fetch GA4 properties
  const { data: ga4Properties, isLoading: loadingGA4Properties } = useQuery<GA4Property[]>({
    queryKey: ["/api/integrations/ga4", currentClientId, "properties"],
    enabled: authReady && ga4DialogOpen && !!currentClientId,
  });

  // Fetch GSC sites
  const { data: gscSites, isLoading: loadingGSCSites } = useQuery<GSCSite[]>({
    queryKey: ["/api/integrations/gsc", currentClientId, "sites"],
    enabled: authReady && gscDialogOpen && !!currentClientId,
  });

  // Save GA4 property mutation
  const saveGA4PropertyMutation = useMutation({
    mutationFn: async ({ clientId, propertyId, leadEventName }: { clientId: string; propertyId: string; leadEventName: string | null }) => {
      // Get auth token for Authorization header
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).token : null;

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/integrations/ga4/${clientId}/property`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ ga4PropertyId: propertyId, ga4LeadEventName: leadEventName }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/ga4", variables.clientId] });
      toast({
        title: "Success",
        description: "GA4 property and lead event saved successfully",
      });
      setSelectedGA4Property("");
      setLeadEventName("");
      setGa4DialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update lead event name mutation (without reconnecting GA4)
  const updateLeadEventMutation = useMutation({
    mutationFn: async ({ clientId, leadEventName }: { clientId: string; leadEventName: string | null }) => {
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).token : null;

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/integrations/ga4/${clientId}/lead-event`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ ga4LeadEventName: leadEventName }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/ga4", variables.clientId] });
      toast({
        title: "Success",
        description: "Lead event configuration updated successfully",
      });
      setLeadEventName("");
      setEditLeadEventDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save GSC site mutation
  const saveGSCSiteMutation = useMutation({
    mutationFn: async ({ clientId, siteUrl }: { clientId: string; siteUrl: string }) => {
      // Get auth token for Authorization header
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).token : null;

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/integrations/gsc/${clientId}/site`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ gscSiteUrl: siteUrl }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gsc", variables.clientId] });
      toast({
        title: "Success",
        description: "Search Console site saved successfully",
      });
      setSelectedGSCSite("");
      setGscDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = async (clientId: string, service: 'GA4' | 'GSC') => {
    try {
      // Get auth token for Authorization header
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).token : null;

      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Include returnTo parameter and popup indicator for OAuth callback
      const returnTo = encodeURIComponent(window.location.pathname);
      const response = await fetch(`/api/oauth/google/initiate?clientId=${clientId}&service=${service}&returnTo=${returnTo}&popup=true`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth");
      }

      const data = await response.json();
      
      // Open OAuth in popup window to avoid iframe X-Frame-Options issues
      const width = 600;
      const height = 700;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);
      
      const popup = window.open(
        data.authUrl,
        'GoogleOAuth',
        `width=${width},height=${height},top=${top},left=${left},popup=1`
      );

      if (!popup) {
        // Popup blocked - fall back to top-level navigation
        if (window.top) {
          window.top.location.href = data.authUrl;
        } else {
          window.location.href = data.authUrl;
        }
        return;
      }

      // Listen for OAuth completion message from popup
      const messageHandler = (event: MessageEvent) => {
        // Verify message origin matches our domain
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          
          // Trigger the same flow as if we returned from redirect
          const { clientId: receivedClientId, service: receivedService } = event.data;
          setCurrentClientId(receivedClientId);
          
          if (receivedService === 'GA4') {
            setGa4DialogOpen(true);
          } else if (receivedService === 'GSC') {
            setGscDialogOpen(true);
          }
          
          toast({
            title: "OAuth Successful",
            description: "Google integration connected. Please select a property/site.",
          });
        } else if (event.data?.type === 'GOOGLE_OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          
          toast({
            title: "OAuth Failed",
            description: `Authentication error: ${event.data.error}`,
            variant: "destructive",
          });
        }
      };

      window.addEventListener('message', messageHandler);
      
      // Clean up listener if popup is closed manually
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckInterval);
          window.removeEventListener('message', messageHandler);
        }
      }, 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initiate OAuth";
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleGA4PropertySave = () => {
    if (!selectedGA4Property) {
      toast({
        title: "Error",
        description: "Please select a GA4 property",
        variant: "destructive",
      });
      return;
    }
    
    saveGA4PropertyMutation.mutate({
      clientId: currentClientId,
      propertyId: selectedGA4Property,
      leadEventName: leadEventName || null,
    });
  };

  const handleGSCSiteSave = () => {
    if (!selectedGSCSite) {
      toast({
        title: "Error",
        description: "Please select a Search Console site",
        variant: "destructive",
      });
      return;
    }
    
    saveGSCSiteMutation.mutate({
      clientId: currentClientId,
      siteUrl: selectedGSCSite,
    });
  };

  // Disconnect GA4 mutation
  const disconnectGA4Mutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/integrations/ga4/${clientId}`);
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/ga4", clientId] });
      toast({
        title: "Disconnected",
        description: "GA4 integration disconnected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect GSC mutation
  const disconnectGSCMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/integrations/gsc/${clientId}`);
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gsc", clientId] });
      toast({
        title: "Disconnected",
        description: "Search Console integration disconnected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Connect HubSpot mutation (agency-wide)
  const connectHubSpotMutation = useMutation({
    mutationFn: async (accessToken: string) => {
      await apiRequest("POST", "/api/integrations/hubspot/connect", { accessToken });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/hubspot/status"] });
      setHubspotDialogOpen(false);
      setHubspotToken("");
      toast({
        title: "Connected",
        description: "HubSpot CRM connected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect HubSpot mutation (agency-wide)
  const disconnectHubSpotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/integrations/hubspot/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/hubspot/status"] });
      toast({
        title: "Disconnected",
        description: "HubSpot CRM disconnected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Connect LinkedIn mutation (agency-wide)
  const connectLinkedInMutation = useMutation({
    mutationFn: async ({ accessToken, organizationId }: { accessToken: string; organizationId: string }) => {
      await apiRequest("POST", "/api/integrations/linkedin/connect", { accessToken, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/linkedin/status"] });
      setLinkedinDialogOpen(false);
      setLinkedinAccessToken("");
      setLinkedinOrganizationId("");
      toast({
        title: "Connected",
        description: "LinkedIn integration connected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect LinkedIn mutation (agency-wide)
  const disconnectLinkedInMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/integrations/linkedin/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/linkedin/status"] });
      toast({
        title: "Disconnected",
        description: "LinkedIn integration disconnected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDisconnect = (clientId: string, service: 'GA4' | 'GSC') => {
    if (service === 'GA4') {
      disconnectGA4Mutation.mutate(clientId);
    } else if (service === 'GSC') {
      disconnectGSCMutation.mutate(clientId);
    }
  };

  // Show loading state while auth is being initialized
  if (!authReady) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-9 w-64 bg-muted animate-pulse rounded" />
            <div className="h-5 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-4">
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">API Integrations</h1>
            <p className="text-muted-foreground">
              Manage Google Analytics 4, Search Console, and HubSpot CRM connections
            </p>
          </div>
          <ClientFilter
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
          />
        </div>

        {/* HubSpot CRM Integration (Agency-wide) */}
        <Card data-testid="hubspot-integration-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <LinkIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">HubSpot CRM</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Agency-wide CRM integration for contacts, deals, and companies
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <LinkIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-medium">HubSpot CRM Data</p>
                  {hubspotStatus?.connected && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Contacts: {hubspotStatus.contactCount?.toLocaleString() || 0}</p>
                      <p>Companies: {hubspotStatus.companyCount?.toLocaleString() || 0}</p>
                      <p>Deals: {hubspotStatus.dealCount?.toLocaleString() || 0}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hubspotStatus?.connected ? (
                  <>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => disconnectHubSpotMutation.mutate()}
                      disabled={disconnectHubSpotMutation.isPending}
                      data-testid="button-disconnect-hubspot"
                    >
                      {disconnectHubSpotMutation.isPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setHubspotDialogOpen(true)}
                      data-testid="button-connect-hubspot"
                    >
                      Connect
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LinkedIn Integration (Agency-wide) */}
        <Card data-testid="linkedin-integration-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">LinkedIn</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Agency-wide social media integration for engagement metrics
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">LinkedIn Data</p>
                  {linkedinStatus?.connected && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Followers: {linkedinStatus.followerCount?.toLocaleString() || 0}</p>
                      <p>Recent Posts: {linkedinStatus.recentPostCount || 0}</p>
                      <p>Total Engagement: {linkedinStatus.totalEngagement?.toLocaleString() || 0}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {linkedinStatus?.connected ? (
                  <>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => disconnectLinkedInMutation.mutate()}
                      disabled={disconnectLinkedInMutation.isPending}
                      data-testid="button-disconnect-linkedin"
                    >
                      {disconnectLinkedInMutation.isPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setLinkedinDialogOpen(true)}
                      data-testid="button-connect-linkedin"
                    >
                      Connect
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Client Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect Google Analytics 4 and Search Console for individual clients
          </p>
        </div>

        {!filteredClients || filteredClients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No clients found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredClients.map((client) => {
              return <ClientIntegrationCard 
                key={client.id} 
                client={client} 
                onConnect={handleConnect} 
                onDisconnect={handleDisconnect}
                onEditLeadEvent={(clientId, currentLeadEvent) => {
                  setCurrentClientId(clientId);
                  setLeadEventName(currentLeadEvent);
                  setEditLeadEventDialogOpen(true);
                }}
              />;
            })}
          </div>
        )}
      </div>

      {/* GA4 Property Selection Dialog */}
      <Dialog open={ga4DialogOpen} onOpenChange={(open) => {
        setGa4DialogOpen(open);
        if (!open) {
          setSelectedGA4Property("");
          setLeadEventName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select GA4 Property</DialogTitle>
            <DialogDescription>
              Choose the Google Analytics 4 property to use for this client
            </DialogDescription>
          </DialogHeader>
          {loadingGA4Properties ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ga4Properties && ga4Properties.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ga4-property">GA4 Property</Label>
                <Select value={selectedGA4Property} onValueChange={setSelectedGA4Property}>
                  <SelectTrigger data-testid="select-ga4-property" id="ga4-property">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {ga4Properties.map((property) => (
                      <SelectItem key={property.propertyId} value={property.propertyId}>
                        {property.displayName} ({property.accountName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lead-event-name">Primary Lead Event Name (Optional)</Label>
                <Input
                  id="lead-event-name"
                  placeholder="e.g., form_submit or generate_lead (one event only)"
                  value={leadEventName}
                  onChange={(e) => setLeadEventName(e.target.value)}
                  data-testid="input-lead-event-name"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter ONE GA4 Key Event name (must match exactly - no commas or multiple events)
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setGa4DialogOpen(false)}
                  data-testid="button-cancel-ga4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGA4PropertySave}
                  disabled={!selectedGA4Property || saveGA4PropertyMutation.isPending}
                  data-testid="button-save-ga4"
                >
                  {saveGA4PropertyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No GA4 properties found for this account
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* GSC Site Selection Dialog */}
      <Dialog open={gscDialogOpen} onOpenChange={(open) => {
        setGscDialogOpen(open);
        if (!open) setSelectedGSCSite("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Search Console Site</DialogTitle>
            <DialogDescription>
              Choose the Search Console site to use for this client
            </DialogDescription>
          </DialogHeader>
          {loadingGSCSites ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gscSites && gscSites.length > 0 ? (
            <div className="space-y-4">
              <Select value={selectedGSCSite} onValueChange={setSelectedGSCSite}>
                <SelectTrigger data-testid="select-gsc-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {gscSites.map((site) => (
                    <SelectItem key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl} ({site.permissionLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setGscDialogOpen(false)}
                  data-testid="button-cancel-gsc"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGSCSiteSave}
                  disabled={!selectedGSCSite || saveGSCSiteMutation.isPending}
                  data-testid="button-save-gsc"
                >
                  {saveGSCSiteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No Search Console sites found for this account
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Event Dialog */}
      <LeadEventsDialog
        clientId={currentClientId}
        open={editLeadEventDialogOpen}
        onOpenChange={(open) => {
          setEditLeadEventDialogOpen(open);
          if (!open) setLeadEventName("");
        }}
      />

      {/* HubSpot Connect Dialog */}
      <HubSpotConnectDialog
        open={hubspotDialogOpen}
        onOpenChange={setHubspotDialogOpen}
        token={hubspotToken}
        setToken={setHubspotToken}
        onConnect={() => connectHubSpotMutation.mutate(hubspotToken)}
        isPending={connectHubSpotMutation.isPending}
      />

      {/* LinkedIn Connect Dialog */}
      <LinkedInConnectDialog
        open={linkedinDialogOpen}
        onOpenChange={setLinkedinDialogOpen}
        accessToken={linkedinAccessToken}
        setAccessToken={setLinkedinAccessToken}
        organizationId={linkedinOrganizationId}
        setOrganizationId={setLinkedinOrganizationId}
        onConnect={() => connectLinkedInMutation.mutate({ accessToken: linkedinAccessToken, organizationId: linkedinOrganizationId })}
        isPending={connectLinkedInMutation.isPending}
      />
    </>
  );
}

function ClientIntegrationCard({ 
  client, 
  onConnect,
  onDisconnect,
  onEditLeadEvent
}: { 
  client: Client; 
  onConnect: (clientId: string, service: 'GA4' | 'GSC') => void;
  onDisconnect: (clientId: string, service: 'GA4' | 'GSC') => void;
  onEditLeadEvent: (clientId: string, currentLeadEvent: string) => void;
}) {
  const { data: ga4Status } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/ga4", client.id],
  });

  const { data: gscStatus } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/gsc", client.id],
  });

  return (
    <Card data-testid={`integration-card-${client.id}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{client.companyName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Client ID: {client.id.slice(0, 8)}...
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google Analytics 4 */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium">Google Analytics 4</p>
              {ga4Status?.ga4PropertyId && (
                <p className="text-xs text-muted-foreground">
                  Property: {ga4Status.ga4PropertyId}
                </p>
              )}
              {ga4Status?.connected && (
                <p className="text-xs text-muted-foreground">
                  Lead Events: {client.leadEvents && client.leadEvents.length > 0 
                    ? client.leadEvents.join(', ') 
                    : <span className="text-orange-500">Not configured</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ga4Status?.connected ? (
              <>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditLeadEvent(client.id, "")}
                  data-testid={`button-edit-lead-event-${client.id}`}
                >
                  Edit Lead Events
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConnect(client.id, 'GA4')}
                  data-testid={`button-reconnect-ga4-${client.id}`}
                >
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDisconnect(client.id, 'GA4')}
                  data-testid={`button-disconnect-ga4-${client.id}`}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onConnect(client.id, 'GA4')}
                  data-testid={`button-connect-ga4-${client.id}`}
                >
                  Connect
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Google Search Console */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <LinkIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">Google Search Console</p>
              {gscStatus?.gscSiteUrl && (
                <p className="text-xs text-muted-foreground">
                  Site: {gscStatus.gscSiteUrl}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gscStatus?.connected ? (
              <>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConnect(client.id, 'GSC')}
                  data-testid={`button-reconnect-gsc-${client.id}`}
                >
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDisconnect(client.id, 'GSC')}
                  data-testid={`button-disconnect-gsc-${client.id}`}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onConnect(client.id, 'GSC')}
                  data-testid={`button-connect-gsc-${client.id}`}
                >
                  Connect
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadEventsDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Fetch client data to get current lead events
  const { data: client } = useQuery<Client>({
    queryKey: ["/api/agency/clients", clientId],
    enabled: open && !!clientId,
  });

  // Fetch available GA4 key events
  const { data: keyEventsData, isLoading } = useQuery<{ events: Array<{ eventName: string; eventCount: number }> }>({
    queryKey: ["/api/integrations/ga4", clientId, "key-events"],
    enabled: open && !!clientId,
  });

  // Initialize selected events when client data loads
  useEffect(() => {
    if (client?.leadEvents) {
      setSelectedEvents(client.leadEvents);
    } else {
      setSelectedEvents([]);
    }
  }, [client]);

  const saveLeadEventsMutation = useMutation({
    mutationFn: async (leadEvents: string[]) => {
      return await apiRequest("POST", `/api/clients/${clientId}/lead-events`, { leadEvents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/ga4", clientId] });
      toast({
        title: "Success",
        description: "Lead events updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lead events",
        variant: "destructive",
      });
    },
  });

  const handleToggleEvent = (eventName: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventName)
        ? prev.filter(e => e !== eventName)
        : [...prev, eventName]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Lead Events</DialogTitle>
          <DialogDescription>
            Select which GA4 Key Events should be tracked as leads for this client
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keyEventsData && keyEventsData.events.length > 0 ? (
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-4">
              {keyEventsData.events.map((event) => (
                <div key={event.eventName} className="flex items-center justify-between py-2 px-3 hover-elevate rounded-md">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={`event-${event.eventName}`}
                      checked={selectedEvents.includes(event.eventName)}
                      onCheckedChange={() => handleToggleEvent(event.eventName)}
                      data-testid={`checkbox-lead-event-${event.eventName}`}
                    />
                    <Label htmlFor={`event-${event.eventName}`} className="text-sm font-medium cursor-pointer flex-1">
                      {event.eventName}
                    </Label>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {event.eventCount.toLocaleString()} events (30d)
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <p>{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} selected</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-lead-events"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveLeadEventsMutation.mutate(selectedEvents)}
                disabled={saveLeadEventsMutation.isPending}
                data-testid="button-save-lead-events"
              >
                {saveLeadEventsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No key events found for this GA4 property.</p>
            <p className="text-sm mt-2">Make sure your GA4 property has key events configured.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HubSpotConnectDialog({
  open,
  onOpenChange,
  token,
  setToken,
  onConnect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  setToken: (token: string) => void;
  onConnect: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect HubSpot CRM</DialogTitle>
          <DialogDescription>
            Enter your HubSpot Private App Access Token to connect your CRM data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hubspot-token">Access Token</Label>
            <Input
              id="hubspot-token"
              type="password"
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              data-testid="input-hubspot-token"
            />
            <p className="text-xs text-muted-foreground">
              Create a Private App in HubSpot with CRM read permissions to get your access token.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-hubspot"
            >
              Cancel
            </Button>
            <Button
              onClick={onConnect}
              disabled={!token || isPending}
              data-testid="button-submit-hubspot"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkedInConnectDialog({
  open,
  onOpenChange,
  accessToken,
  setAccessToken,
  organizationId,
  setOrganizationId,
  onConnect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  organizationId: string;
  setOrganizationId: (id: string) => void;
  onConnect: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect LinkedIn</DialogTitle>
          <DialogDescription>
            Enter your LinkedIn access token and organization ID to connect social media data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-token">Access Token</Label>
            <Input
              id="linkedin-token"
              type="password"
              placeholder="AQV..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              data-testid="input-linkedin-token"
            />
            <p className="text-xs text-muted-foreground">
              Create a LinkedIn app with organization access to get your access token.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin-org-id">Organization ID</Label>
            <Input
              id="linkedin-org-id"
              type="text"
              placeholder="12345678"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              data-testid="input-linkedin-org-id"
            />
            <p className="text-xs text-muted-foreground">
              Your LinkedIn organization's numeric ID.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-linkedin"
            >
              Cancel
            </Button>
            <Button
              onClick={onConnect}
              disabled={!accessToken || !organizationId || isPending}
              data-testid="button-submit-linkedin"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
