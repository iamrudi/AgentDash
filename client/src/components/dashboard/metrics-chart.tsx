import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyMetric } from "@shared/schema";

interface MetricsChartProps {
  data: DailyMetric[];
  metric: "sessions" | "conversions" | "spend" | "clicks";
  title: string;
  chartType?: "line" | "area" | "bar";
}

export function MetricsChart({ data, metric, title, chartType = "line" }: MetricsChartProps) {
  // Transform data for recharts with null safety
  const chartData = data.map((item) => {
    const rawValue = item[metric];
    const value = metric === "spend" 
      ? parseFloat(String(rawValue || "0"))
      : (typeof rawValue === 'number' ? rawValue : 0);
    
    return {
      date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value,
      source: item.source,
    };
  });

  const formatValue = (value?: number | null) => {
    if (value == null) return "N/A";
    if (metric === "spend") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { date?: string; value?: number; source?: string }; value?: number }> }) => {
    if (active && payload && payload.length && payload[0].value != null) {
      return (
        <div className="bg-card border border-border rounded-md p-3 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].payload?.date || "Unknown"}</p>
          <p className="text-sm text-primary">
            {title}: {formatValue(payload[0].value)}
          </p>
          {payload[0].payload?.source && (
            <p className="text-xs text-muted-foreground">{payload[0].payload.source}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (chartType) {
      case "line":
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        );
      case "bar":
      default:
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
