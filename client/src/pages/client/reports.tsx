import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Users, Eye, MousePointer, ArrowUp, Calendar } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface GA4Data {
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
  totals: Array<{
    metricValues: Array<{ value: string }>;
  }>;
}

interface GSCData {
  rows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export default function Reports() {
  const [dateRange, setDateRange] = useState("30"); // days
  const { toast } = useToast();

  // Get current user's client ID from localStorage
  const authUser = localStorage.getItem("authUser");
  const clientId = authUser ? JSON.parse(authUser).clientId : null;

  // Calculate date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch GA4 data
  const { data: ga4Data, isLoading: ga4Loading } = useQuery<GA4Data>({
    queryKey: ["/api/analytics/ga4", clientId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ga4?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch GA4 data');
      return res.json();
    },
    enabled: !!clientId,
  });

  // Fetch GSC data
  const { data: gscData, isLoading: gscLoading } = useQuery<GSCData>({
    queryKey: ["/api/analytics/gsc", clientId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/gsc?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch GSC data');
      return res.json();
    },
    enabled: !!clientId,
  });

  // Process GA4 data for charts
  const ga4ChartData = ga4Data?.rows?.map(row => ({
    date: new Date(row.dimensionValues[0].value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sessions: parseInt(row.metricValues[0]?.value || '0'),
    users: parseInt(row.metricValues[1]?.value || '0'),
    pageviews: parseInt(row.metricValues[2]?.value || '0'),
  })) || [];

  // Process GSC data for charts
  const gscChartData = gscData?.rows?.map(row => ({
    date: row.keys[0] ? new Date(row.keys[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  })) || [];

  // Calculate totals
  const ga4Totals = ga4Data?.totals?.[0]?.metricValues || [];
  const totalSessions = parseInt(ga4Totals[0]?.value || '0');
  const totalUsers = parseInt(ga4Totals[1]?.value || '0');
  const totalPageviews = parseInt(ga4Totals[2]?.value || '0');
  const avgSessionDuration = parseFloat(ga4Totals[3]?.value || '0');
  const bounceRate = (parseFloat(ga4Totals[4]?.value || '0') * 100).toFixed(1);

  const totalClicks = gscData?.rows?.reduce((sum, row) => sum + (row.clicks || 0), 0) || 0;
  const totalImpressions = gscData?.rows?.reduce((sum, row) => sum + (row.impressions || 0), 0) || 0;
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const avgPosition = gscData?.rows?.length 
    ? (gscData.rows.reduce((sum, row) => sum + (row.position || 0), 0) / gscData.rows.length).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-reports">Analytics Reports</h1>
          <p className="text-muted-foreground mt-1">Google Analytics 4 and Search Console metrics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Google Analytics 4 Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Google Analytics 4</h2>
        </div>

        {/* GA4 Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-sessions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalSessions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total user sessions</p>
            </CardContent>
          </Card>

          <Card data-testid="card-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total unique users</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pageviews">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pageviews</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalPageviews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total page views</p>
            </CardContent>
          </Card>

          <Card data-testid="card-bounce-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
              <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : bounceRate}%</div>
              <p className="text-xs text-muted-foreground">Session bounce rate</p>
            </CardContent>
          </Card>
        </div>

        {/* GA4 Chart */}
        {ga4ChartData.length > 0 ? (
          <Card data-testid="card-ga4-chart">
            <CardHeader>
              <CardTitle>Traffic Overview</CardTitle>
              <CardDescription>Sessions, users, and pageviews over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ga4ChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} name="Sessions" />
                  <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Users" />
                  <Line type="monotone" dataKey="pageviews" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Pageviews" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : !ga4Loading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No GA4 data available. Make sure your Google Analytics 4 integration is connected.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Google Search Console Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MousePointer className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Google Search Console</h2>
        </div>

        {/* GSC Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-clicks">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : totalClicks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total search clicks</p>
            </CardContent>
          </Card>

          <Card data-testid="card-impressions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impressions</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : totalImpressions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total search impressions</p>
            </CardContent>
          </Card>

          <Card data-testid="card-ctr">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CTR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : avgCTR}%</div>
              <p className="text-xs text-muted-foreground">Click-through rate</p>
            </CardContent>
          </Card>

          <Card data-testid="card-position">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Position</CardTitle>
              <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : avgPosition}</div>
              <p className="text-xs text-muted-foreground">Average search position</p>
            </CardContent>
          </Card>
        </div>

        {/* GSC Chart */}
        {gscChartData.length > 0 ? (
          <Card data-testid="card-gsc-chart">
            <CardHeader>
              <CardTitle>Search Performance</CardTitle>
              <CardDescription>Clicks and impressions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gscChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} name="Clicks" />
                  <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Impressions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : !gscLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No Search Console data available. Make sure your Google Search Console integration is connected.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
