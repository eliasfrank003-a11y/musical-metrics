import { useMemo, useCallback, useState } from 'react';
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
import { IntradayData } from '@/lib/practiceAnalytics';

interface IntradayChartProps {
  data: IntradayData[];
  baselineAverage: number;
  onHover?: (data: IntradayData | null) => void;
}

// Trade Republic exact colors
const COLORS = {
  positive: '#09C651',
  negative: '#FD4136',
  muted: '#595A5F',
  unreached: '#161616',
  white: '#FFFFFF',
};

export function IntradayChart({ data, baselineAverage, onHover }: IntradayChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrubPercentage, setScrubPercentage] = useState<number>(100);

  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      index,
      timestamp: d.time.getTime(),
      displayTime: d.timeStr,
      averageHours: d.cumulativeAverage,
    }));
  }, [data]);

  // Fixed 24-hour domain (00:00 to 23:59)
  const { dayStart, dayEnd, xAxisTicks } = useMemo(() => {
    if (chartData.length === 0) {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { dayStart: start.getTime(), dayEnd: end.getTime(), xAxisTicks: [] };
    }
    
    const baseDate = new Date(chartData[0].time);
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);
    
    // Fixed tick marks for the full 24-hour period
    const ticks = [0, 6, 12, 18, 23].map(hour => {
      const tickTime = new Date(baseDate);
      tickTime.setHours(hour, hour === 23 ? 59 : 0, 0, 0);
      return tickTime.getTime();
    });
    
    return { dayStart: start.getTime(), dayEnd: end.getTime(), xAxisTicks: ticks };
  }, [chartData]);

  // Calculate Y-axis domain to always include baseline and show separation
  const { yMin, yMax, range } = useMemo(() => {
    if (chartData.length === 0) return { yMin: 0, yMax: 0, range: 0 };
    const dataValues = chartData.map(d => d.averageHours);
    const allValues = [...dataValues, baselineAverage];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Add padding to ensure visual separation (at least 5% of range on each side)
    const dataRange = max - min;
    const padding = dataRange > 0 ? dataRange * 0.15 : Math.abs(min) * 0.05;
    
    return { 
      yMin: min - padding, 
      yMax: max + padding, 
      range: dataRange 
    };
  }, [chartData, baselineAverage]);

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

  const formatXAxisTick = useCallback((timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm');
  }, []);

  // Format hours for tooltip display
  const formatHoursMinutes = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activeTooltipIndex !== undefined) {
      const index = state.activeTooltipIndex;
      setActiveIndex(index);
      const percentage = chartData.length > 1 
        ? (index / (chartData.length - 1)) * 100 
        : 100;
      setScrubPercentage(percentage);
    }
    if (state?.activePayload?.[0]?.payload && onHover) {
      onHover(state.activePayload[0].payload as IntradayData);
    }
  }, [onHover, chartData.length]);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
    setScrubPercentage(100);
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No intraday data available
      </div>
    );
  }

  // Determine line color based on whether current value is above or below baseline
  const lastValue = chartData[chartData.length - 1]?.averageHours || 0;
  const isAboveBaseline = lastValue >= baselineAverage;
  const lineColor = isAboveBaseline ? COLORS.positive : COLORS.negative;

  // Custom active dot with glow effect
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAboveBaseline = payload.averageHours >= baselineAverage;
    const dotColor = isAboveBaseline ? COLORS.positive : COLORS.negative;
    
    return (
      <g>
        <circle cx={cx} cy={cy} r={24} fill={dotColor} opacity={0.1} className="animate-pulse-ring" />
        <circle cx={cx} cy={cy} r={16} fill={dotColor} opacity={0.2} className="animate-pulse-ring-delay" />
        <circle cx={cx} cy={cy} r={10} fill={dotColor} opacity={0.4} />
        <circle cx={cx} cy={cy} r={6} fill={dotColor} stroke="none" />
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, coordinate }: any) => {
    if (active && payload && payload.length && coordinate) {
      const d = payload[0].payload;
      
      // Calculate delta from previous hour
      const prevAvg = d.index > 0 ? chartData[d.index - 1]?.averageHours : d.averageHours;
      const delta = d.averageHours - prevAvg;
      
      const formatDeltaValue = (hours: number) => {
        const totalSeconds = Math.round(Math.abs(hours) * 3600);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const sign = hours >= 0 ? '+' : '-';
        if (m === 0) return `${sign}${s}s`;
        if (s === 0) return `${sign}${m}m`;
        return `${sign}${m}m ${s}s`;
      };

      // Edge clamping
      const tooltipHalfWidth = 90;
      const leftEdge = 8;
      const pointX = coordinate.x;
      let offsetX = 0;
      
      if (pointX < tooltipHalfWidth + leftEdge) {
        offsetX = tooltipHalfWidth - pointX + leftEdge;
      }
      
      return (
        <div 
          className="flex items-center gap-1.5 pointer-events-none whitespace-nowrap"
          style={{ transform: `translateX(calc(-50% + ${offsetX}px))` }}
        >
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {d.timeStr}
          </span>
          <span className="text-sm" style={{ color: COLORS.muted }}>•</span>
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {formatHoursMinutes(d.hoursPlayedThisInterval)} played
          </span>
          <span className="text-sm" style={{ color: COLORS.muted }}>•</span>
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {formatDeltaValue(delta)}
          </span>
        </div>
      );
    }
    return null;
  };

  const gradientId = `intradayGradient-${Math.random().toString(36).substr(2, 9)}`;

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
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset={`${scrubPercentage}%`} stopColor={lineColor} />
              <stop offset={`${scrubPercentage}%`} stopColor={COLORS.unreached} />
              <stop offset="100%" stopColor={COLORS.unreached} />
            </linearGradient>
          </defs>
          
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[dayStart, dayEnd]}
            scale="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.muted, fontSize: 13 }}
            dy={10}
            ticks={xAxisTicks}
            tickFormatter={formatXAxisTick}
          />
          <YAxis
            domain={[yMin, yMax]}
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
            y={baselineAverage}
            stroke={COLORS.muted}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            strokeOpacity={0.8}
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
            stroke={activeIndex !== null ? `url(#${gradientId})` : lineColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={renderActiveDot}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
