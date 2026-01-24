import { useMemo, useCallback } from 'react';
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
  onHover?: (data: DailyData | null) => void;
}

// Trade Republic colors
const COLORS = {
  positive: '#00CC66',
  negative: '#FC4236',
  muted: '#7F8494',
  unreached: '#161616',
};

export function PracticeChart({ data, timeRange, onHover }: PracticeChartProps) {
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
  const { range, baselineValue } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, range: 0, baselineValue: 0 };
    const values = chartData.map(d => d.averageHours);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const baseline = chartData[0]?.averageHours || 0;
    return { minValue: min, maxValue: max, range: max - min, baselineValue: baseline };
  }, [chartData]);

  const formatYAxis = useCallback((value: number) => {
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
  }, [range]);

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activePayload?.[0]?.payload && onHover) {
      onHover(state.activePayload[0].payload as DailyData);
    }
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  // Determine line color based on trend (last value vs first value)
  const lastValue = chartData[chartData.length - 1]?.averageHours || 0;
  const firstValue = chartData[0]?.averageHours || 0;
  const isPositiveTrend = lastValue >= firstValue;
  const lineColor = isPositiveTrend ? COLORS.positive : COLORS.negative;

  // Custom active dot with glow effect and pulse animation
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAboveBaseline = payload.averageHours >= baselineValue;
    const dotColor = isAboveBaseline ? COLORS.positive : COLORS.negative;
    
    return (
      <g>
        {/* Outer pulse ring */}
        <circle
          cx={cx}
          cy={cy}
          r={24}
          fill={dotColor}
          opacity={0.1}
          className="animate-pulse-ring"
        />
        {/* Middle glow */}
        <circle
          cx={cx}
          cy={cy}
          r={16}
          fill={dotColor}
          opacity={0.2}
          className="animate-pulse-ring-delay"
        />
        {/* Inner glow */}
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={dotColor}
          opacity={0.4}
        />
        {/* Solid inner dot */}
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

  // Custom floating label tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DailyData;
      return (
        <div className="flex flex-col items-center pointer-events-none">
          <span className="text-sm font-medium" style={{ color: COLORS.muted }}>
            {format(data.date, 'd MMM')}
          </span>
          <span className="text-xs" style={{ color: COLORS.muted }}>
            Day {data.dayNumber}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72 md:h-80 relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData} 
          margin={{ top: 40, right: 0, left: 0, bottom: 20 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Gradient for the active (colored) portion */}
            <linearGradient id="coloredLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={lineColor} />
              <stop offset="100%" stopColor={lineColor} />
            </linearGradient>
          </defs>
          
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.muted, fontSize: 13 }}
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
            tick={{ fill: COLORS.muted, fontSize: 13 }}
            orientation="right"
            mirror={true}
            dx={-10}
            width={0}
          />
          <ReferenceLine
            y={baselineValue}
            stroke={COLORS.muted}
            strokeDasharray="2 4"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <Tooltip
            cursor={false}
            content={<CustomTooltip />}
            position={{ y: 0 }}
            wrapperStyle={{ zIndex: 100 }}
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
