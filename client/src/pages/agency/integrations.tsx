import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Client } from "@shared/schema";
import { Building2, CheckCircle2, XCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  
  // Dialog states
  const [ga4DialogOpen, setGa4DialogOpen] = useState(false);
  const [gscDialogOpen, setGscDialogOpen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState("");
  const [selectedGA4Property, setSelectedGA4Property] = useState("");
  const [selectedGSCSite, setSelectedGSCSite] = useState("");
  
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
  });

  // Filter clients based on selection
  const filteredClients = selectedClientId === "ALL"
    ? clients
    : clients?.filter(c => c.id === selectedClientId);

  // Fetch GA4 properties
  const { data: ga4Properties, isLoading: loadingGA4Properties } = useQuery<GA4Property[]>({
    queryKey: ["/api/integrations/ga4", currentClientId, "properties"],
    enabled: ga4DialogOpen && !!currentClientId,
  });

  // Fetch GSC sites
  const { data: gscSites, isLoading: loadingGSCSites } = useQuery<GSCSite[]>({
    queryKey: ["/api/integrations/gsc", currentClientId, "sites"],
    enabled: gscDialogOpen && !!currentClientId,
  });

  // Save GA4 property mutation
  const saveGA4PropertyMutation = useMutation({
    mutationFn: async ({ clientId, propertyId }: { clientId: string; propertyId: string }) => {
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
        body: JSON.stringify({ ga4PropertyId: propertyId }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/ga4", variables.clientId] });
      toast({
        title: "Success",
        description: "GA4 property saved successfully",
      });
      setSelectedGA4Property("");
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
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message,
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

  const handleDisconnect = (clientId: string, service: 'GA4' | 'GSC') => {
    if (service === 'GA4') {
      disconnectGA4Mutation.mutate(clientId);
    } else {
      disconnectGSCMutation.mutate(clientId);
    }
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Google Integrations</h1>
            <p className="text-muted-foreground">
              Manage Google Analytics 4 and Search Console connections for clients
            </p>
          </div>
          <ClientFilter
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
          />
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
              return <ClientIntegrationCard key={client.id} client={client} onConnect={handleConnect} onDisconnect={handleDisconnect} />;
            })}
          </div>
        )}
      </div>

      {/* GA4 Property Selection Dialog */}
      <Dialog open={ga4DialogOpen} onOpenChange={(open) => {
        setGa4DialogOpen(open);
        if (!open) setSelectedGA4Property("");
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
              <Select value={selectedGA4Property} onValueChange={setSelectedGA4Property}>
                <SelectTrigger data-testid="select-ga4-property">
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
    </AgencyLayout>
  );
}

function ClientIntegrationCard({ 
  client, 
  onConnect,
  onDisconnect
}: { 
  client: Client; 
  onConnect: (clientId: string, service: 'GA4' | 'GSC') => void;
  onDisconnect: (clientId: string, service: 'GA4' | 'GSC') => void;
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
