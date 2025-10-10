import { useQuery } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Client, ClientIntegration } from "@shared/schema";
import { Building2, CheckCircle2, XCircle, Link as LinkIcon } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { useState } from "react";

export default function AgencyIntegrationsPage() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: integrations } = useQuery<ClientIntegration[]>({
    queryKey: ["/api/agency/integrations"],
  });

  // Filter clients based on selection
  const filteredClients = selectedClientId === "ALL"
    ? clients
    : clients?.filter(c => c.id === selectedClientId);

  const getIntegrationStatus = (clientId: string, serviceName: string) => {
    return integrations?.find(
      i => i.clientId === clientId && i.serviceName === serviceName
    );
  };

  const handleConnect = (clientId: string, serviceName: string) => {
    // TODO: Implement OAuth flow initiation
    console.log(`Connecting ${serviceName} for client ${clientId}`);
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
              const ga4Integration = getIntegrationStatus(client.id, "GA4");
              const gscIntegration = getIntegrationStatus(client.id, "Google Search Console");

              return (
                <Card key={client.id} data-testid={`integration-card-${client.id}`}>
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
                          {ga4Integration && ga4Integration.ga4PropertyId && (
                            <p className="text-xs text-muted-foreground">
                              Property: {ga4Integration.ga4PropertyId}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ga4Integration ? (
                          <>
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(client.id, "GA4")}
                              data-testid={`button-reconnect-ga4-${client.id}`}
                            >
                              Reconnect
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
                              onClick={() => handleConnect(client.id, "GA4")}
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gscIntegration ? (
                          <>
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(client.id, "Google Search Console")}
                              data-testid={`button-reconnect-gsc-${client.id}`}
                            >
                              Reconnect
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
                              onClick={() => handleConnect(client.id, "Google Search Console")}
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
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
