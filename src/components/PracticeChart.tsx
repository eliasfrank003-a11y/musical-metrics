import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { DailyData } from '@/lib/practiceAnalytics';

interface PracticeChartProps {
  data: DailyData[];
  timeRange: '1W' | '1M' | '6M' | '1Y' | 'ALL';
}

export function PracticeChart({ data, timeRange }: PracticeChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      displayDate: format(
        d.date, 
        timeRange === '1W' ? 'd. MMM' : 
        timeRange === '1M' ? 'd. MMM' : 
        'MMM yy'
      ),
      averageHours: d.cumulativeAverage,
    }));
  }, [data, timeRange]);

  // Calculate tick indices to show exactly 5 ticks
  const xAxisTicks = useMemo(() => {
    if (chartData.length <= 5) return undefined;
    const step = (chartData.length - 1) / 4;
    return [0, 1, 2, 3, 4].map(i => Math.round(i * step));
  }, [chartData.length]);

  // Calculate the data range to determine formatting precision
  const { minValue, maxValue, range, baselineValue } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, range: 0, baselineValue: 0 };
    const values = chartData.map(d => d.averageHours);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Baseline is the first value in the range
    const baseline = chartData[0]?.averageHours || 0;
    return { minValue: min, maxValue: max, range: max - min, baselineValue: baseline };
  }, [chartData]);

  const formatYAxis = (value: number) => {
    const totalSeconds = Math.round(value * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (range < 10 / 60) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    if (range < 1) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatTooltipValue = (value: number) => {
    const totalSeconds = Math.round(value * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (range < 1) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}m ${s}s`;
    return `${h}h ${m}m ${s}s`;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  // Trade Republic colors
  const positiveColor = '#00CC66';
  const negativeColor = '#FC4236';
  const mutedColor = '#7F8494';

  // Determine line color based on trend (last value vs first value)
  const lastValue = chartData[chartData.length - 1]?.averageHours || 0;
  const firstValue = chartData[0]?.averageHours || 0;
  const isPositiveTrend = lastValue >= firstValue;
  const lineColor = isPositiveTrend ? positiveColor : negativeColor;

  // Custom active dot with glow effect
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAboveBaseline = payload.averageHours >= baselineValue;
    const dotColor = isAboveBaseline ? positiveColor : negativeColor;
    
    return (
      <g>
        {/* Outer glow */}
        <circle
          cx={cx}
          cy={cy}
          r={20}
          fill={dotColor}
          opacity={0.15}
        />
        {/* Middle glow */}
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill={dotColor}
          opacity={0.3}
        />
        {/* Inner dot */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={dotColor}
          stroke="none"
        />
      </g>
    );
  };

  return (
    <div className="w-full h-72 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 5, left: 0, bottom: 20 }}>
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: mutedColor, fontSize: 13 }}
            dy={10}
            ticks={xAxisTicks?.map(i => chartData[i]?.displayDate)}
            interval={0}
          />
          <YAxis
            domain={['dataMin', 'dataMax']}
            tickCount={4}
            allowDecimals={true}
            tickFormatter={formatYAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: mutedColor, fontSize: 13 }}
            orientation="right"
            dx={10}
            width={60}
          />
          <ReferenceLine
            y={baselineValue}
            stroke={mutedColor}
            strokeDasharray="2 4"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <Tooltip
            cursor={false}
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
          <Line
            type="linear"
            dataKey="averageHours"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={renderActiveDot}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
