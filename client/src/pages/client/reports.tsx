import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, DollarSign, Users, MousePointer, Sparkles, ExternalLink } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { format, subDays } from "date-fns";

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

interface AcquisitionChannelsData {
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

interface OutcomeMetrics {
  conversions: number;
  estimatedPipelineValue: number;
  cpa: number;
  organicClicks: number;
  spend: number;
  pipelineCalculation: {
    leadToOpportunityRate: number;
    opportunityToCloseRate: number;
    averageDealSize: number;
  };
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [compareEnabled, setCompareEnabled] = useState(false);

  const authUser = localStorage.getItem("authUser");
  const parsedAuthUser = authUser ? JSON.parse(authUser) : null;
  const clientId = parsedAuthUser?.clientId || null;
  const token = parsedAuthUser?.token || null;

  const startDate = format(dateFrom, 'yyyy-MM-dd');
  const endDate = format(dateTo, 'yyyy-MM-dd');
  
  const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
  const compareStartDate = format(subDays(dateFrom, daysDiff + 1), 'yyyy-MM-dd');
  const compareEndDate = format(subDays(dateFrom, 1), 'yyyy-MM-dd');

  // Fetch GA4 data
  const { data: ga4Data, isLoading: ga4Loading } = useQuery<GA4Data>({
    queryKey: ["/api/analytics/ga4", clientId, startDate, endDate],
    enabled: !!clientId && !!token,
  });

  // Fetch GSC data
  const { data: gscData, isLoading: gscLoading } = useQuery<GSCData>({
    queryKey: ["/api/analytics/gsc", clientId, startDate, endDate],
    enabled: !!clientId && !!token,
  });

  // Fetch acquisition channels
  const { data: channelsData } = useQuery<AcquisitionChannelsData>({
    queryKey: ["/api/analytics/ga4", clientId, "channels", startDate, endDate],
    enabled: !!clientId && !!token,
  });

  // Fetch outcome metrics
  const { data: outcomeMetrics, isLoading: outcomeLoading } = useQuery<OutcomeMetrics>({
    queryKey: ["/api/analytics/outcome-metrics", clientId, startDate, endDate],
    enabled: !!clientId && !!token,
  });

  // Fetch comparison data
  const { data: outcomeCompareMetrics } = useQuery<OutcomeMetrics>({
    queryKey: ["/api/analytics/outcome-metrics", clientId, compareStartDate, compareEndDate, "compare"],
    enabled: !!clientId && !!token && compareEnabled,
  });

  const parseGA4Date = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return 'Invalid Date';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Process combined traffic chart data (GA4 Sessions + GSC Clicks)
  const trafficChartData = (ga4Data?.rows ?? []).map(row => {
    const dateStr = row.dimensionValues[0]?.value || '';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const dateObj = new Date(`${year}-${month}-${day}`);
    
    return {
      dateObj,
      date: parseGA4Date(dateStr),
      sessions: parseInt(row.metricValues[0]?.value || '0'),
    };
  }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Add GSC clicks to traffic data
  const gscChartData = (gscData?.rows ?? []).map(row => ({
    date: row.keys[0] ? new Date(row.keys[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    clicks: row.clicks || 0,
  }));

  // Merge GA4 and GSC data by date
  const combinedTrafficData = trafficChartData.map(ga4Point => {
    const gscPoint = gscChartData.find(gsc => gsc.date === ga4Point.date);
    return {
      date: ga4Point.date,
      sessions: ga4Point.sessions,
      clicks: gscPoint?.clicks || 0,
    };
  });

  // Process GSC impressions chart data
  const impressionsChartData = (gscData?.rows ?? []).map(row => ({
    date: row.keys[0] ? new Date(row.keys[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    impressions: row.impressions || 0,
  }));

  // Process acquisition channels for donut chart
  const channelsChartData = (channelsData?.rows ?? []).map(row => ({
    channel: row.dimensionValues[0]?.value || 'Unknown',
    sessions: parseInt(row.metricValues[0]?.value || '0'),
  })).sort((a, b) => b.sessions - a.sessions);

  // Top performing queries
  const topQueries = (gscData?.rows ?? [])
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // Channel colors for donut chart
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) {
      if (current > 0) return Infinity;
      return 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const ComparisonBadge = ({ current, previous }: { current: number; previous: number }) => {
    if (!compareEnabled) return null;
    const change = calcChange(current, previous);
    const isPositive = change > 0;
    const isNegative = change < 0;
    const isInfinite = change === Infinity;
    
    return (
      <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'}`}>
        {isPositive && <ArrowUpRight className="h-3 w-3" />}
        {isNegative && <ArrowDownRight className="h-3 w-3" />}
        <span>{isInfinite ? 'New' : `${Math.abs(change).toFixed(1)}%`}</span>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-reports">Analytics Reports</h1>
          <p className="text-muted-foreground mt-1">Outcome-focused insights and performance metrics</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="compare-toggle" className="text-sm">Compare to previous period</Label>
            <Switch 
              id="compare-toggle"
              checked={compareEnabled} 
              onCheckedChange={setCompareEnabled}
              data-testid="switch-compare-period"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-picker">
                <Calendar className="h-4 w-4" />
                {format(dateFrom, "MMM d")} - {format(dateTo, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex gap-2 p-3">
                <div>
                  <p className="text-sm font-medium mb-2">From</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    disabled={(date) => date > dateTo || date > new Date()}
                    data-testid="calendar-date-from"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">To</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    disabled={(date) => date < dateFrom || date > new Date()}
                    data-testid="calendar-date-to"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" className="gap-2" data-testid="button-looker-studio">
            <ExternalLink className="h-4 w-4" />
            View Full Report
          </Button>
        </div>
      </div>

      {/* Outcome Scorecards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-conversions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads/Conversions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outcomeLoading ? '...' : (outcomeMetrics?.conversions || 0).toLocaleString()}</div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Total conversions</p>
              <ComparisonBadge 
                current={outcomeMetrics?.conversions || 0} 
                previous={outcomeCompareMetrics?.conversions || 0} 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pipeline-value">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outcomeLoading ? '...' : `$${(outcomeMetrics?.estimatedPipelineValue || 0).toLocaleString()}`}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Projected revenue</p>
              <ComparisonBadge 
                current={outcomeMetrics?.estimatedPipelineValue || 0} 
                previous={outcomeCompareMetrics?.estimatedPipelineValue || 0} 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cpa">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPA</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outcomeLoading ? '...' : `$${(outcomeMetrics?.cpa || 0).toLocaleString()}`}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Cost per acquisition</p>
              <ComparisonBadge 
                current={outcomeMetrics?.cpa || 0} 
                previous={outcomeCompareMetrics?.cpa || 0} 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-organic-clicks">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organic Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outcomeLoading ? '...' : (outcomeMetrics?.organicClicks || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">From search results</p>
              <ComparisonBadge 
                current={outcomeMetrics?.organicClicks || 0} 
                previous={outcomeCompareMetrics?.organicClicks || 0} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Traffic Story */}
        <div className="space-y-6">
          {/* Combined Traffic Chart */}
          <Card data-testid="card-traffic-overview">
            <CardHeader>
              <CardTitle>Traffic Overview</CardTitle>
              <CardDescription>GA4 Sessions and GSC Clicks over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={combinedTrafficData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} name="Sessions" />
                  <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Organic Clicks" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Traffic by Channel Donut Chart */}
          <Card data-testid="card-traffic-channels">
            <CardHeader>
              <CardTitle>Traffic by Channel</CardTitle>
              <CardDescription>Session distribution across sources</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={channelsChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.channel}: ${entry.sessions}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="sessions"
                  >
                    {channelsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: SEO Story */}
        <div className="space-y-6">
          {/* GSC Impressions Chart */}
          <Card data-testid="card-seo-impressions">
            <CardHeader>
              <CardTitle>Search Impressions</CardTitle>
              <CardDescription>Organic visibility over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={impressionsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="impressions" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Impressions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Performing Queries Table */}
          <Card data-testid="card-top-queries">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Performing Queries</CardTitle>
                  <CardDescription>Your best organic search terms</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-ask-ai">
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {topQueries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Pos.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topQueries.map((query, index) => (
                      <TableRow key={index} data-testid={`row-query-${index}`}>
                        <TableCell className="font-medium">{query.keys[0]}</TableCell>
                        <TableCell className="text-right">{query.clicks}</TableCell>
                        <TableCell className="text-right">{query.impressions}</TableCell>
                        <TableCell className="text-right">{(query.ctr * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{query.position.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {gscLoading ? 'Loading...' : 'No query data available'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
