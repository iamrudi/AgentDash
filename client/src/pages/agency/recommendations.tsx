import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recommendation, Client } from "@shared/schema";
import { Lightbulb, Send, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AgencyRecommendationsPage() {
  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/agency/recommendations"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      return await apiRequest(`/api/recommendations/${recommendationId}/send`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/recommendations"] });
      toast({
        title: "Recommendation sent",
        description: "The recommendation has been sent to the client.",
      });
    },
  });

  const handleSendToClient = (id: string) => {
    sendMutation.mutate(id);
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">AI Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered recommendations based on GA4 and GSC data
          </p>
        </div>

        {!recommendations || recommendations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recommendations available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => {
              const client = clients?.find(c => c.id === rec.clientId);
              return (
                <Card key={rec.id} data-testid={`recommendation-${rec.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{client?.companyName || "Unknown Client"}</span>
                          <Badge variant={rec.status === "New" ? "default" : "secondary"}>
                            {rec.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendToClient(rec.id)}
                        disabled={sendMutation.isPending}
                        data-testid={`button-send-${rec.id}`}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send to Client
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rec.observation && (
                      <div>
                        <p className="text-sm font-medium mb-1">Observation</p>
                        <p className="text-sm text-muted-foreground">{rec.observation}</p>
                      </div>
                    )}
                    {rec.proposedAction && (
                      <div>
                        <p className="text-sm font-medium mb-1">Proposed Action</p>
                        <p className="text-sm text-muted-foreground">{rec.proposedAction}</p>
                      </div>
                    )}
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
