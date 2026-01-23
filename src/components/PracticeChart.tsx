import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { DailyData } from '@/lib/practiceAnalytics';

interface PracticeChartProps {
  data: DailyData[];
  timeRange: '1W' | '1M' | '1Y' | 'ALL';
}

export function PracticeChart({ data, timeRange }: PracticeChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      displayDate: format(d.date, timeRange === '1W' ? 'EEE' : timeRange === '1M' ? 'MMM d' : 'MMM yyyy'),
      averageHours: d.cumulativeAverage,
    }));
  }, [data, timeRange]);

  const formatYAxis = (value: number) => {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h`;
  };

  const formatTooltipValue = (value: number) => {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  return (
    <div className="w-full h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142 76% 46%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(142 76% 46%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220 14% 16%)"
            vertical={false}
          />
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }}
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatYAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }}
            dx={-10}
            width={50}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as DailyData;
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      {format(data.date, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatTooltipValue(data.cumulativeAverage)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Day {data.dayNumber} • {formatTooltipValue(data.hoursPlayed)} played
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="averageHours"
            stroke="hsl(142 76% 46%)"
            strokeWidth={2}
            fill="url(#colorAverage)"
            dot={false}
            activeDot={{
              r: 6,
              fill: 'hsl(142 76% 46%)',
              stroke: 'hsl(220 18% 7%)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
