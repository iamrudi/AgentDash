import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertCircle } from "lucide-react";
import { RecommendationWithClient } from "@shared/schema";
import { format } from "date-fns";

export default function Recommendations() {
  const { data: recommendations = [], isLoading } = useQuery<RecommendationWithClient[]>({
    queryKey: ["/api/client/recommendations"],
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-recommendations">Recommendations</h1>
        <p className="text-muted-foreground mt-1">AI-powered insights and suggestions for your business</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">Loading recommendations...</div>
            </CardContent>
          </Card>
        ) : recommendations.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No recommendations available</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          recommendations.map((recommendation) => (
            <Card key={recommendation.id} data-testid={`recommendation-card-${recommendation.id}`} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <span data-testid={`recommendation-title-${recommendation.id}`}>
                        {recommendation.title}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {format(new Date(recommendation.createdAt), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" data-testid={`recommendation-status-${recommendation.id}`}>
                    {recommendation.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold mb-1">Observation</h4>
                  <p className="text-sm text-muted-foreground" data-testid={`recommendation-observation-${recommendation.id}`}>
                    {recommendation.observation}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1">Proposed Action</h4>
                  <p className="text-sm text-muted-foreground" data-testid={`recommendation-action-${recommendation.id}`}>
                    {recommendation.proposedAction}
                  </p>
                </div>
                {recommendation.impact && (
                  <Badge variant="secondary" data-testid={`recommendation-impact-${recommendation.id}`}>
                    Impact: {recommendation.impact}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
