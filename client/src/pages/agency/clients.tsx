import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Client } from "@shared/schema";
import { Building2, ChevronRight } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { useState } from "react";

export default function AgencyClientsPage() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  // Filter clients based on selection
  const filteredClients = selectedClientId === "ALL"
    ? clients
    : clients?.filter(c => c.id === selectedClientId);

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Clients</h1>
            <p className="text-muted-foreground">
              Manage client information, integrations, and objectives
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
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <Card key={client.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg" data-testid={`text-client-${client.id}`}>
                          {client.companyName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Client ID: {client.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <Link href={`/agency/clients/${client.id}`}>
                      <Button variant="ghost" data-testid={`button-view-client-${client.id}`}>
                        Manage Client
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
