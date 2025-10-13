import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, BrainCircuit, Target, MessageSquare, TrendingUp, TrendingDown, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { ClientObjective } from "@shared/schema";

interface StrategyCardData {
  businessContext: string | null;
  clientObjectives: ClientObjective[];
  summaryKpis: {
    totalSessions: number;
    totalConversions: number;
    totalSpend: number;
  };
  chatAnalysis: {
    painPoints: string[];
    recentWins: string[];
    activeQuestions: string[];
  };
}

export function ClientStrategyCard({ clientId }: { clientId: string }) {
  const { data, isLoading, error } = useQuery<StrategyCardData>({
    queryKey: ['/api/agency/clients', clientId, 'strategy-card'],
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card data-testid="client-strategy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          AI-Powered Client Strategy Map
        </CardTitle>
        <CardDescription>
          A consolidated overview of this client's strategic context, goals, and recent activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Qualitative Context */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Business Context</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="business-context">
              {data?.businessContext || "No business context provided."}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Active Strategic Goals</h4>
            {data?.clientObjectives.length ? (
              <ul className="list-disc list-inside space-y-1" data-testid="strategic-goals">
                {data.clientObjectives.map(obj => (
                  <li key={obj.id} className="text-sm flex items-start gap-2" data-testid={`goal-${obj.id}`}>
                    <Target className="h-4 w-4 mt-1 text-primary shrink-0" />
                    <span>{obj.description}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground" data-testid="no-goals">No active goals set.</p>}
          </div>
        </div>

        {/* Column 2: AI-Analyzed Chat Insights */}
        <div className="space-y-4">
          <h4 className="font-semibold">Recent Conversation Insights</h4>
          <div className="space-y-3" data-testid="chat-insights">
            {data?.chatAnalysis.painPoints.length ? (
              <div data-testid="pain-points">
                <h5 className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Client Pain Points</h5>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {data.chatAnalysis.painPoints.map((point, i) => <li key={i} data-testid={`pain-point-${i}`}>{point}</li>)}
                </ul>
              </div>
            ) : null}
            {data?.chatAnalysis.recentWins.length ? (
              <div data-testid="recent-wins">
                <h5 className="text-xs font-semibold text-green-500 mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Recent Wins</h5>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {data.chatAnalysis.recentWins.map((win, i) => <li key={i} data-testid={`recent-win-${i}`}>{win}</li>)}
                </ul>
              </div>
            ) : null}
            {data?.chatAnalysis.activeQuestions.length ? (
              <div data-testid="active-questions">
                <h5 className="text-xs font-semibold text-yellow-500 mb-1 flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Active Questions</h5>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {data.chatAnalysis.activeQuestions.map((q, i) => <li key={i} data-testid={`active-question-${i}`}>{q}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Column 3: Analytical Snapshot */}
        <div className="space-y-4">
          <h4 className="font-semibold">30-Day Performance Snapshot</h4>
          <div className="space-y-3" data-testid="performance-snapshot">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid="total-sessions">
              <span className="text-sm font-medium">Total Sessions</span>
              <span className="text-lg font-bold font-mono">{data?.summaryKpis.totalSessions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid="total-conversions">
              <span className="text-sm font-medium">Total Conversions</span>
              <span className="text-lg font-bold font-mono">{data?.summaryKpis.totalConversions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid="total-spend">
              <span className="text-sm font-medium">Total Ad Spend</span>
              <span className="text-lg font-bold font-mono">${data?.summaryKpis.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
