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
import { DailyData } from '@/lib/practiceAnalytics';

interface PracticeChartProps {
  data: DailyData[];
  timeRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';
  onHover?: (data: DailyData | null) => void;
}

// Trade Republic exact colors
const COLORS = {
  positive: '#09C651',
  negative: '#FD4136',
  muted: '#595A5F',
  unreached: '#161616',
  white: '#FFFFFF',
};

export function PracticeChart({ data, timeRange, onHover }: PracticeChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrubPercentage, setScrubPercentage] = useState<number>(100);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      index,
      // Use timestamp for continuous time scale
      timestamp: d.date.getTime(),
      displayDate: format(d.date, 'd MMM'),
      averageHours: d.cumulativeAverage,
    }));
  }, [data]);

  // Calculate exactly 5 equidistant time-based ticks
  const xAxisTicks = useMemo(() => {
    if (chartData.length < 2) return undefined;
    
    const startTime = chartData[0].timestamp;
    const endTime = chartData[chartData.length - 1].timestamp;
    const timeRange = endTime - startTime;
    
    // Generate 5 equidistant timestamps
    return [0, 0.25, 0.5, 0.75, 1].map(fraction => 
      startTime + (timeRange * fraction)
    );
  }, [chartData]);

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

  const formatXAxisTick = useCallback((timestamp: number) => {
    return format(new Date(timestamp), 'd MMM');
  }, []);

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activeTooltipIndex !== undefined) {
      const index = state.activeTooltipIndex;
      setActiveIndex(index);
      // Snap gradient to the active data point's position
      const percentage = chartData.length > 1 
        ? (index / (chartData.length - 1)) * 100 
        : 100;
      setScrubPercentage(percentage);
    }
    if (state?.activePayload?.[0]?.payload && onHover) {
      onHover(state.activePayload[0].payload as DailyData);
    }
  }, [onHover, chartData.length]);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
    setScrubPercentage(100);
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  const handleTouchStart = useCallback((state: any, event?: any) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    setIsScrubbing(true);
    handleMouseMove(state);
  }, [handleMouseMove]);

  const handleTouchMove = useCallback((state: any, event?: any) => {
    if (!isScrubbing) return;
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    handleMouseMove(state);
  }, [isScrubbing, handleMouseMove]);

  const handleTouchEnd = useCallback((_: any, event?: any) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    setIsScrubbing(false);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  // Determine line color based on last point (or selected point) vs baseline
  const lastValue = chartData[chartData.length - 1]?.averageHours || 0;
  const selectedValue = activeIndex !== null ? chartData[activeIndex]?.averageHours : null;
  const effectiveValue = selectedValue ?? lastValue;
  const isAboveBaseline = effectiveValue >= baselineValue;
  const lineColor = isAboveBaseline ? COLORS.positive : COLORS.negative;

  // Custom active dot with glow effect and pulse animation
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAboveBaseline = payload.averageHours >= baselineValue;
    const dotColor = isAboveBaseline ? COLORS.positive : COLORS.negative;
    
    return (
      <g>
        {/* Soft outer halo */}
        <circle
          cx={cx}
          cy={cy}
          r={20}
          fill={dotColor}
          opacity={0.08}
        />
        {/* Subtle glow */}
        <circle
          cx={cx}
          cy={cy}
          r={13}
          fill={dotColor}
          opacity={0.18}
        />
        {/* Solid inner dot */}
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill={dotColor}
          stroke="none"
        />
      </g>
    );
  };

  // Format hours for tooltip display
  const formatHoursMinutes = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Custom floating label tooltip with edge clamping
  const CustomTooltip = ({ active, payload, coordinate }: any) => {
    if (active && payload && payload.length && coordinate) {
      const data = payload[0].payload as DailyData;
      
      // Calculate the delta: how much this day changed the average
      const previousAverage = data.dayNumber > 1 
        ? (data.cumulativeHours - data.hoursPlayed) / (data.dayNumber - 1)
        : 0;
      const averageDelta = data.cumulativeAverage - previousAverage;
      
      // Format delta in seconds/minutes
      const formatDeltaValue = (hours: number) => {
        const totalSeconds = Math.round(Math.abs(hours) * 3600);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const sign = hours >= 0 ? '+' : '-';
        if (m === 0) return `${sign}${s}s`;
        if (s === 0) return `${sign}${m}m`;
        return `${sign}${m}m ${s}s`;
      };

      // Edge clamping calculation
      // Tooltip is roughly 180px wide, so half is 90px
      const tooltipHalfWidth = 90;
      const leftEdge = 8; // Minimum padding from left
      const rightEdge = 8; // Minimum padding from right (relative to chart)
      
      // Get approximate chart width from the container (assume ~360px mobile, will be in margin area)
      // The coordinate.x is relative to the chart plotting area
      const pointX = coordinate.x;
      
      // Calculate the offset needed to keep tooltip visible
      // Default: center the tooltip (translateX -50%)
      // If too close to left: shift right
      // If too close to right: shift left
      let offsetX = 0;
      
      if (pointX < tooltipHalfWidth + leftEdge) {
        // Near left edge - shift tooltip right
        offsetX = tooltipHalfWidth - pointX + leftEdge;
      }
      
      return (
        <div 
          className="flex items-center gap-1.5 pointer-events-none whitespace-nowrap"
          style={{ 
            transform: `translateX(calc(-50% + ${offsetX}px))`,
          }}
        >
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {format(data.date, 'd MMM')}
          </span>
          <span className="text-sm" style={{ color: COLORS.muted }}>•</span>
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {formatHoursMinutes(data.hoursPlayed)}
          </span>
          <span className="text-sm" style={{ color: COLORS.muted }}>•</span>
          <span className="text-sm" style={{ color: COLORS.muted }}>
            {formatDeltaValue(averageDelta)}
          </span>
        </div>
      );
    }
    return null;
  };

  // Generate unique gradient ID to avoid conflicts
  const scrubGradientId = `scrubGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className="w-full h-72 md:h-80 relative overscroll-none"
      style={{ touchAction: isScrubbing ? 'none' : 'pan-y' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData} 
          margin={{ top: 40, right: 24, left: 24, bottom: 20 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <defs>
            {/* Scrub gradient to dim line after selected point */}
            <linearGradient id={scrubGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset={`${scrubPercentage}%`} stopColor={lineColor} />
              <stop offset={`${scrubPercentage}%`} stopColor={COLORS.muted} stopOpacity={0.45} />
              <stop offset="100%" stopColor={COLORS.muted} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.muted, fontSize: 13 }}
            dy={10}
            ticks={xAxisTicks}
            tickFormatter={formatXAxisTick}
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
          
          {/* Single line with dynamic gradient stroke */}
          <Line
            type="linear"
            dataKey="averageHours"
            stroke={activeIndex !== null ? `url(#${scrubGradientId})` : lineColor}
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