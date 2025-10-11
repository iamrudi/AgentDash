import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, Users, Eye, MousePointer, ArrowUp, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Bar, BarChart } from "recharts";
import { useToast } from "@/hooks/use-toast";
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
  totals?: Array<{
    metricValues: Array<{ value: string }>;
  }>;
}

export default function Reports() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Get current user's client ID and token from localStorage
  const authUser = localStorage.getItem("authUser");
  const parsedAuthUser = authUser ? JSON.parse(authUser) : null;
  const clientId = parsedAuthUser?.clientId || null;
  const token = parsedAuthUser?.token || null;

  // Calculate date ranges
  const startDate = format(dateFrom, 'yyyy-MM-dd');
  const endDate = format(dateTo, 'yyyy-MM-dd');
  
  // Calculate comparison period (same length as selected period)
  const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
  const compareStartDate = format(subDays(dateFrom, daysDiff + 1), 'yyyy-MM-dd');
  const compareEndDate = format(subDays(dateFrom, 1), 'yyyy-MM-dd');

  // Fetch GA4 data
  const { data: ga4Data, isLoading: ga4Loading } = useQuery<GA4Data>({
    queryKey: ["/api/analytics/ga4", clientId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ga4/${clientId}?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch GA4 data');
      return res.json();
    },
    enabled: !!clientId && !!token,
  });

  // Fetch GSC data
  const { data: gscData, isLoading: gscLoading } = useQuery<GSCData>({
    queryKey: ["/api/analytics/gsc", clientId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/gsc/${clientId}?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch GSC data');
      return res.json();
    },
    enabled: !!clientId && !!token,
  });

  // Fetch comparison data if enabled
  const { data: ga4CompareData } = useQuery<GA4Data>({
    queryKey: ["/api/analytics/ga4", clientId, compareStartDate, compareEndDate, "compare"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ga4/${clientId}?startDate=${compareStartDate}&endDate=${compareEndDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch comparison GA4 data');
      return res.json();
    },
    enabled: !!clientId && !!token && compareEnabled,
  });

  const { data: gscCompareData } = useQuery<GSCData>({
    queryKey: ["/api/analytics/gsc", clientId, compareStartDate, compareEndDate, "compare"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/gsc/${clientId}?startDate=${compareStartDate}&endDate=${compareEndDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch comparison GSC data');
      return res.json();
    },
    enabled: !!clientId && !!token && compareEnabled,
  });

  // Fetch acquisition channels data
  const { data: channelsData, isLoading: channelsLoading } = useQuery<AcquisitionChannelsData>({
    queryKey: ["/api/analytics/ga4", clientId, "channels", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ga4/${clientId}/channels?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch acquisition channels data');
      return res.json();
    },
    enabled: !!clientId && !!token,
  });

  // Helper function to parse GA4 date format (YYYYMMDD)
  const parseGA4Date = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return 'Invalid Date';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Process GA4 data for charts
  const ga4ChartData = (ga4Data?.rows ?? []).map(row => {
    const dateStr = row.dimensionValues[0]?.value || '';
    // Parse YYYYMMDD to actual Date for proper sorting
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const dateObj = new Date(`${year}-${month}-${day}`);
    
    return {
      dateObj,
      date: parseGA4Date(dateStr),
      sessions: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
      pageviews: parseInt(row.metricValues[2]?.value || '0'),
    };
  }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Process GSC data for charts
  const gscChartData = gscData?.rows?.map(row => ({
    date: row.keys[0] ? new Date(row.keys[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  })) || [];

  // Process acquisition channels data for charts
  const channelsChartData = channelsData?.rows?.map(row => ({
    channel: row.dimensionValues[0]?.value || 'Unknown',
    sessions: parseInt(row.metricValues[0]?.value || '0'),
    users: parseInt(row.metricValues[1]?.value || '0'),
  })).sort((a, b) => b.sessions - a.sessions) || [];

  // Calculate totals from row data (GA4 API doesn't always return totals)
  const totalSessions = ga4ChartData.reduce((sum, row) => sum + row.sessions, 0);
  const totalUsers = ga4ChartData.reduce((sum, row) => sum + row.users, 0);
  const totalPageviews = ga4ChartData.reduce((sum, row) => sum + row.pageviews, 0);
  
  // Engaged sessions need to be fetched separately or calculated from row data
  const ga4Totals = ga4Data?.totals?.[0]?.metricValues || [];
  const totalEngagedSessions = parseInt(ga4Totals[3]?.value || '0');

  const totalClicks = gscData?.rows?.reduce((sum, row) => sum + (row.clicks || 0), 0) || 0;
  const totalImpressions = gscData?.rows?.reduce((sum, row) => sum + (row.impressions || 0), 0) || 0;
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const avgPosition = gscData?.rows?.length 
    ? (gscData.rows.reduce((sum, row) => sum + (row.position || 0), 0) / gscData.rows.length).toFixed(1)
    : '0';

  // Calculate comparison totals from row data (GA4 API doesn't always return totals)
  const ga4CompareChartData = (ga4CompareData?.rows ?? []).map(row => ({
    sessions: parseInt(row.metricValues[0]?.value || '0'),
    users: parseInt(row.metricValues[1]?.value || '0'),
    pageviews: parseInt(row.metricValues[2]?.value || '0'),
  }));
  
  const compareSessionsTotal = ga4CompareChartData.reduce((sum, row) => sum + row.sessions, 0);
  const compareUsersTotal = ga4CompareChartData.reduce((sum, row) => sum + row.users, 0);
  const comparePageviewsTotal = ga4CompareChartData.reduce((sum, row) => sum + row.pageviews, 0);
  
  const ga4CompareTotals = ga4CompareData?.totals?.[0]?.metricValues || [];
  const compareEngagedSessionsTotal = parseInt(ga4CompareTotals[3]?.value || '0');

  const compareClicksTotal = gscCompareData?.rows?.reduce((sum, row) => sum + (row.clicks || 0), 0) || 0;
  const compareImpressionsTotal = gscCompareData?.rows?.reduce((sum, row) => sum + (row.impressions || 0), 0) || 0;
  const compareAvgCTR = compareImpressionsTotal > 0 ? ((compareClicksTotal / compareImpressionsTotal) * 100).toFixed(2) : '0';
  const compareAvgPosition = gscCompareData?.rows?.length 
    ? (gscCompareData.rows.reduce((sum, row) => sum + (row.position || 0), 0) / gscCompareData.rows.length).toFixed(1)
    : '0';

  // Helper to calculate percentage change
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) {
      // If previous is 0 and current is greater than 0, it's a new metric (infinite growth)
      if (current > 0) return Infinity;
      // If both are 0, no change
      return 0;
    }
    return ((current - previous) / previous) * 100;
  };

  // Helper to render comparison badge
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-reports">Analytics Reports</h1>
          <p className="text-muted-foreground mt-1">Google Analytics 4 and Search Console metrics</p>
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Total user sessions</p>
                <ComparisonBadge current={totalSessions} previous={compareSessionsTotal} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalUsers.toLocaleString()}</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Total unique users</p>
                <ComparisonBadge current={totalUsers} previous={compareUsersTotal} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pageviews">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pageviews</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalPageviews.toLocaleString()}</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Total page views</p>
                <ComparisonBadge current={totalPageviews} previous={comparePageviewsTotal} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-engaged-sessions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engaged Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ga4Loading ? '...' : totalEngagedSessions.toLocaleString()}</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Sessions with engagement</p>
                <ComparisonBadge current={totalEngagedSessions} previous={compareEngagedSessionsTotal} />
              </div>
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
        {/* Acquisition Channels Chart */}
        {channelsChartData.length > 0 ? (
          <Card data-testid="card-acquisition-channels">
            <CardHeader>
              <CardTitle>Acquisition Channels</CardTitle>
              <CardDescription>Traffic sources and channel performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={channelsChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="channel" type="category" width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sessions" fill="hsl(var(--primary))" name="Sessions" />
                  <Bar dataKey="users" fill="hsl(var(--chart-2))" name="Users" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : !channelsLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No acquisition channels data available.
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Total search clicks</p>
                <ComparisonBadge current={totalClicks} previous={compareClicksTotal} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-impressions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impressions</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : totalImpressions.toLocaleString()}</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Total search impressions</p>
                <ComparisonBadge current={totalImpressions} previous={compareImpressionsTotal} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-ctr">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CTR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : avgCTR}%</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Click-through rate</p>
                <ComparisonBadge current={parseFloat(avgCTR)} previous={parseFloat(compareAvgCTR)} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-position">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Position</CardTitle>
              <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gscLoading ? '...' : avgPosition}</div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Average search position</p>
                <ComparisonBadge current={parseFloat(avgPosition)} previous={parseFloat(compareAvgPosition)} />
              </div>
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
