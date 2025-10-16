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
  const [dataForSeoDialogOpen, setDataForSeoDialogOpen] = useState(false);
  const [agencyDataForSeoDialogOpen, setAgencyDataForSeoDialogOpen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState("");
  const [selectedGA4Property, setSelectedGA4Property] = useState("");
  const [leadEventName, setLeadEventName] = useState("");
  const [selectedGSCSite, setSelectedGSCSite] = useState("");
  const [dataForSeoLogin, setDataForSeoLogin] = useState("");
  const [dataForSeoPassword, setDataForSeoPassword] = useState("");
  const [agencyDataForSeoLogin, setAgencyDataForSeoLogin] = useState("");
  const [agencyDataForSeoPassword, setAgencyDataForSeoPassword] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  
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

  // Fetch agency-level Data for SEO integration
  const { data: agencyDataForSeo } = useQuery<{
    connected: boolean;
    integrationId?: string;
    clientAccess: string[];
    createdAt?: string;
    updatedAt?: string;
  }>({
    queryKey: ["/api/agency/integrations/dataforseo"],
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

      const response = await fetch(`/api/oauth/google/initiate?clientId=${clientId}&service=${service}`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth");
      }

      const data = await response.json();
      window.location.href = data.authUrl;
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

  // Connect Data for SEO mutation
  const connectDataForSeoMutation = useMutation({
    mutationFn: async ({ clientId, login, password }: { clientId: string; login: string; password: string }) => {
      await apiRequest("POST", `/api/integrations/dataforseo/${clientId}/connect`, {
        login,
        password
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/dataforseo", variables.clientId] });
      toast({
        title: "Success",
        description: "Data for SEO integration connected successfully",
      });
      setDataForSeoLogin("");
      setDataForSeoPassword("");
      setDataForSeoDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect Data for SEO mutation
  const disconnectDataForSeoMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/integrations/dataforseo/${clientId}`);
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/dataforseo", clientId] });
      toast({
        title: "Disconnected",
        description: "Data for SEO integration disconnected successfully",
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

  // Save agency-level Data for SEO mutation
  const saveAgencyDataForSeoMutation = useMutation({
    mutationFn: async ({ login, password }: { login: string; password: string }) => {
      return await apiRequest("POST", "/api/agency/integrations/dataforseo", { login, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/integrations/dataforseo"] });
      toast({
        title: "Success",
        description: "Agency Data for SEO integration saved successfully",
      });
      setAgencyDataForSeoLogin("");
      setAgencyDataForSeoPassword("");
      setAgencyDataForSeoDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client access mutation
  const updateClientAccessMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      return await apiRequest("POST", "/api/agency/integrations/dataforseo/client-access", { clientIds });
    },
    onMutate: async (newClientIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/agency/integrations/dataforseo"] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["/api/agency/integrations/dataforseo"]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["/api/agency/integrations/dataforseo"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          clientAccess: newClientIds,
        };
      });
      
      // Return context with the snapshot
      return { previousData };
    },
    onError: (error: Error, _newClientIds, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["/api/agency/integrations/dataforseo"], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Client access updated successfully",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync
      queryClient.invalidateQueries({ queryKey: ["/api/agency/integrations/dataforseo"] });
    },
  });

  const handleDisconnect = (clientId: string, service: 'GA4' | 'GSC' | 'DataForSEO') => {
    if (service === 'GA4') {
      disconnectGA4Mutation.mutate(clientId);
    } else if (service === 'GSC') {
      disconnectGSCMutation.mutate(clientId);
    } else {
      disconnectDataForSeoMutation.mutate(clientId);
    }
  };

  const handleDataForSeoConnect = (clientId: string) => {
    setCurrentClientId(clientId);
    setDataForSeoDialogOpen(true);
  };

  const handleDataForSeoSave = () => {
    if (!dataForSeoLogin || !dataForSeoPassword) {
      toast({
        title: "Error",
        description: "Please provide both login and password",
        variant: "destructive",
      });
      return;
    }

    connectDataForSeoMutation.mutate({
      clientId: currentClientId,
      login: dataForSeoLogin,
      password: dataForSeoPassword,
    });
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
              Manage Google Analytics 4, Search Console, and Data for SEO connections for clients
            </p>
          </div>
          <ClientFilter
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
          />
        </div>

        {/* Agency-Level Data for SEO Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agency-Level Data for SEO</span>
              {agencyDataForSeo?.connected && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure Data for SEO credentials once for your agency and control which clients can access it
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setAgencyDataForSeoDialogOpen(true)}
                data-testid="button-configure-agency-dataforseo"
              >
                {agencyDataForSeo?.connected ? "Update Credentials" : "Configure Credentials"}
              </Button>
            </div>

            {agencyDataForSeo?.connected && clients && clients.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-medium">Client Access ({agencyDataForSeo.clientAccess.length} of {clients.length})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {clients.map((client) => {
                    const hasAccess = agencyDataForSeo.clientAccess.includes(client.id);
                    return (
                      <div key={client.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`client-access-${client.id}`}
                          checked={hasAccess}
                          onChange={(e) => {
                            const newAccess = e.target.checked
                              ? [...agencyDataForSeo.clientAccess, client.id]
                              : agencyDataForSeo.clientAccess.filter(id => id !== client.id);
                            updateClientAccessMutation.mutate(newAccess);
                          }}
                          className="h-4 w-4 rounded border-input"
                          data-testid={`checkbox-client-access-${client.id}`}
                        />
                        <Label htmlFor={`client-access-${client.id}`} className="text-sm cursor-pointer">
                          {client.companyName}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                onDataForSeoConnect={handleDataForSeoConnect}
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

      {/* Data for SEO Connection Dialog */}
      <Dialog open={dataForSeoDialogOpen} onOpenChange={(open) => {
        setDataForSeoDialogOpen(open);
        if (!open) {
          setDataForSeoLogin("");
          setDataForSeoPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Data for SEO</DialogTitle>
            <DialogDescription>
              Enter your Data for SEO API credentials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dataforseo-login">API Login</Label>
              <Input
                id="dataforseo-login"
                type="text"
                placeholder="Enter your Data for SEO login"
                value={dataForSeoLogin}
                onChange={(e) => setDataForSeoLogin(e.target.value)}
                data-testid="input-dataforseo-login"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dataforseo-password">API Password/Key</Label>
              <Input
                id="dataforseo-password"
                type="password"
                placeholder="Enter your Data for SEO password/key"
                value={dataForSeoPassword}
                onChange={(e) => setDataForSeoPassword(e.target.value)}
                data-testid="input-dataforseo-password"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDataForSeoDialogOpen(false)}
                data-testid="button-cancel-dataforseo"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDataForSeoSave}
                disabled={connectDataForSeoMutation.isPending}
                data-testid="button-save-dataforseo"
              >
                {connectDataForSeoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agency-Level Data for SEO Configuration Dialog */}
      <Dialog open={agencyDataForSeoDialogOpen} onOpenChange={(open) => {
        setAgencyDataForSeoDialogOpen(open);
        if (!open) {
          setAgencyDataForSeoLogin("");
          setAgencyDataForSeoPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Agency Data for SEO</DialogTitle>
            <DialogDescription>
              Enter Data for SEO API credentials for your agency. You can then control which clients have access to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agency-dataforseo-login">API Login</Label>
              <Input
                id="agency-dataforseo-login"
                type="text"
                placeholder="Enter your Data for SEO login"
                value={agencyDataForSeoLogin}
                onChange={(e) => setAgencyDataForSeoLogin(e.target.value)}
                data-testid="input-agency-dataforseo-login"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="agency-dataforseo-password">API Password/Key</Label>
              <Input
                id="agency-dataforseo-password"
                type="password"
                placeholder="Enter your Data for SEO password/key"
                value={agencyDataForSeoPassword}
                onChange={(e) => setAgencyDataForSeoPassword(e.target.value)}
                data-testid="input-agency-dataforseo-password"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setAgencyDataForSeoDialogOpen(false)}
                data-testid="button-cancel-agency-dataforseo"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!agencyDataForSeoLogin || !agencyDataForSeoPassword) {
                    toast({
                      title: "Error",
                      description: "Please provide both login and password",
                      variant: "destructive",
                    });
                    return;
                  }
                  saveAgencyDataForSeoMutation.mutate({
                    login: agencyDataForSeoLogin,
                    password: agencyDataForSeoPassword,
                  });
                }}
                disabled={saveAgencyDataForSeoMutation.isPending}
                data-testid="button-save-agency-dataforseo"
              >
                {saveAgencyDataForSeoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClientIntegrationCard({ 
  client, 
  onConnect,
  onDisconnect,
  onEditLeadEvent,
  onDataForSeoConnect
}: { 
  client: Client; 
  onConnect: (clientId: string, service: 'GA4' | 'GSC') => void;
  onDisconnect: (clientId: string, service: 'GA4' | 'GSC' | 'DataForSEO') => void;
  onEditLeadEvent: (clientId: string, currentLeadEvent: string) => void;
  onDataForSeoConnect: (clientId: string) => void;
}) {
  const { data: ga4Status } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/ga4", client.id],
  });

  const { data: gscStatus } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/gsc", client.id],
  });

  const { data: dataForSeoStatus } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/dataforseo", client.id],
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

        {/* Data for SEO */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <LinkIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium">Data for SEO</p>
              <p className="text-xs text-muted-foreground">
                Content research & SERP analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dataForSeoStatus?.connected ? (
              <>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDataForSeoConnect(client.id)}
                  data-testid={`button-reconnect-dataforseo-${client.id}`}
                >
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDisconnect(client.id, 'DataForSEO')}
                  data-testid={`button-disconnect-dataforseo-${client.id}`}
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
                  onClick={() => onDataForSeoConnect(client.id)}
                  data-testid={`button-connect-dataforseo-${client.id}`}
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
