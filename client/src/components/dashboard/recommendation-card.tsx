import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecommendationWithClient } from "@shared/schema";
import { Lightbulb, TrendingUp, DollarSign } from "lucide-react";

interface RecommendationCardProps {
  recommendation: RecommendationWithClient;
  onView?: () => void;
}

export function RecommendationCard({ recommendation, onView }: RecommendationCardProps) {
  const statusColors: Record<string, string> = {
    New: "bg-chart-1/20 text-chart-1",
    "In Review": "bg-chart-3/20 text-chart-3",
    Approved: "bg-accent/20 text-accent",
    Rejected: "bg-destructive/20 text-destructive",
    Implemented: "bg-muted text-muted-foreground",
  };

  const impactColors: Record<string, string> = {
    High: "text-destructive",
    Medium: "text-chart-3",
    Low: "text-chart-1",
  };

  const cost = recommendation.cost ? parseFloat(recommendation.cost) : null;

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      onClick={onView}
      data-testid={`card-recommendation-${recommendation.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 bg-accent/10 rounded-md">
              <Lightbulb className="h-4 w-4 text-accent" />
            </div>
            <h3 className="font-semibold text-sm truncate flex-1" data-testid={`text-recommendation-title-${recommendation.id}`}>
              {recommendation.title}
            </h3>
          </div>
          <Badge
            variant="secondary"
            className={statusColors[recommendation.status]}
            data-testid={`badge-recommendation-status-${recommendation.id}`}
          >
            {recommendation.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Observation</p>
          <p className="text-sm line-clamp-2">{recommendation.observation}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Proposed Action</p>
          <p className="text-sm line-clamp-2">{recommendation.proposedAction}</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          {recommendation.impact && (
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-3 w-3 ${impactColors[recommendation.impact]}`} />
              <span className={`text-xs font-medium ${impactColors[recommendation.impact]}`}>
                {recommendation.impact} Impact
              </span>
            </div>
          )}
          {cost !== null && (
            <div className="flex items-center gap-1 text-xs font-mono font-semibold">
              <DollarSign className="h-3 w-3" />
              <span data-testid={`text-recommendation-cost-${recommendation.id}`}>
                {cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
