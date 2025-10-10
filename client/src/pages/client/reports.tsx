import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-reports">Reports</h1>
        <p className="text-muted-foreground mt-1">Analytics and performance reports</p>
      </div>

      <Card data-testid="card-reports-placeholder">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reports Coming Soon
          </CardTitle>
          <CardDescription>Analytics and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Detailed reports and analytics will be available here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
