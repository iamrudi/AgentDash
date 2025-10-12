import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Search, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface AuditResult {
  lighthouseReport: any;
  aiSummary: {
    summary: string;
    recommendations: string[];
  };
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  const auditMutation = useMutation({
    mutationFn: (targetUrl: string) =>
      apiRequest("POST", "/api/seo/audit", { url: targetUrl }).then(res => res.json()),
    onSuccess: (data: AuditResult) => {
      setResult(data);
    },
  });

  const handleAudit = () => {
    if (!url.trim()) return;
    setResult(null);
    auditMutation.mutate(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">SEO Website Audit</h1>
          <p className="text-muted-foreground">
            Enter a URL to get a comprehensive SEO, performance, and accessibility report powered by Google Lighthouse.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex w-full max-w-lg items-center space-x-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={auditMutation.isPending}
                data-testid="input-url"
              />
              <Button onClick={handleAudit} disabled={auditMutation.isPending} data-testid="button-audit">
                {auditMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {auditMutation.isPending ? "Auditing..." : "Audit Website"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {auditMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Audit Failed</AlertTitle>
            <AlertDescription>{(auditMutation.error as Error).message}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Summary & Recommendations
                </CardTitle>
                <CardDescription>
                  An AI-generated analysis of the Lighthouse report for quick insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Overall Summary</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-summary">{result.aiSummary.summary}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Top Recommendations</h3>
                  <ul className="list-disc list-inside space-y-2">
                    {result.aiSummary.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm" data-testid={`text-recommendation-${index}`}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lighthouse Score Summary</CardTitle>
                <CardDescription>
                  Detailed scores from the Google Lighthouse audit. Scores are out of 100.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.values(result.lighthouseReport.categories).map((category: any) => (
                  <div key={category.id} data-testid={`score-${category.id}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium capitalize">{category.title}</span>
                      <span className="text-lg font-bold">{(category.score * 100).toFixed(0)}</span>
                    </div>
                    <Progress value={category.score * 100} className={getScoreColor(category.score * 100)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
