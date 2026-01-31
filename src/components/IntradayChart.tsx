import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
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
  const [isScrubbing, setIsScrubbing] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  const chartData = useMemo(() => {
    // Filter out data before 6am
    return data
      .filter(d => d.time.getHours() >= 6)
      .map((d, index) => ({
        ...d,
        index,
        timestamp: d.time.getTime(),
        displayTime: d.timeStr,
        averageHours: d.cumulativeAverage,
      }));
  }, [data]);

  // Domain from 6am to 23:59, with ticks at 6, 10, 14, 18, 22
  const { dayStart, dayEnd, xAxisTicks } = useMemo(() => {
    if (chartData.length === 0) {
      const now = new Date();
      const start = new Date(now);
      start.setHours(6, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { dayStart: start.getTime(), dayEnd: end.getTime(), xAxisTicks: [] };
    }
    
    const baseDate = new Date(chartData[0].time);
    const start = new Date(baseDate);
    start.setHours(6, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);
    
    // 5 evenly spaced ticks from 6am to 10pm (4-hour intervals)
    const ticks = [6, 10, 14, 18, 22].map(hour => {
      const tickTime = new Date(baseDate);
      tickTime.setHours(hour, 0, 0, 0);
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

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activeTooltipIndex !== undefined) {
      const index = state.activeTooltipIndex;
      setActiveIndex(index);
    }
    if (state?.activePayload?.[0]?.payload && onHover) {
      onHover(state.activePayload[0].payload as IntradayData);
    }
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  const updateFromClientX = useCallback((clientX: number) => {
    if (!chartWrapperRef.current || chartData.length === 0) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    // Account for chart margins (left: 24, right: 24)
    const chartLeft = 24;
    const chartRight = 24;
    const chartWidth = rect.width - chartLeft - chartRight;
    const x = Math.min(Math.max(clientX - rect.left - chartLeft, 0), chartWidth);
    const ratio = chartWidth > 0 ? x / chartWidth : 0;
    const index = Math.round(ratio * (chartData.length - 1));
    const clampedIndex = Math.min(Math.max(index, 0), chartData.length - 1);

    setActiveIndex(clampedIndex);
    if (onHover) {
      onHover(chartData[clampedIndex] as IntradayData);
    }
  }, [chartData, onHover]);

  const handleScrubStart = useCallback((clientX: number, event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsScrubbing(true);
    updateFromClientX(clientX);
  }, [updateFromClientX]);

  const handleScrubMove = useCallback((clientX: number, event?: React.SyntheticEvent) => {
    if (!isScrubbing) return;
    event?.preventDefault();
    event?.stopPropagation();
    updateFromClientX(clientX);
  }, [isScrubbing, updateFromClientX]);

  const handleScrubEnd = useCallback((event?: React.SyntheticEvent | Event) => {
    if (event && 'preventDefault' in event) event.preventDefault();
    if (event && 'stopPropagation' in event) event.stopPropagation();
    setIsScrubbing(false);
    handleMouseLeave();
  }, [handleMouseLeave]);

  // Attach global listeners when scrubbing to track finger anywhere on screen
  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMove = (e: TouchEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX !== undefined) updateFromClientX(clientX);
    };

    const handleGlobalEnd = (e: TouchEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsScrubbing(false);
      handleMouseLeave();
    };

    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd, { passive: false });
    window.addEventListener('touchcancel', handleGlobalEnd, { passive: false });
    window.addEventListener('pointermove', handleGlobalMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalEnd, { passive: false });
    window.addEventListener('pointercancel', handleGlobalEnd, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('touchcancel', handleGlobalEnd);
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalEnd);
      window.removeEventListener('pointercancel', handleGlobalEnd);
    };
  }, [isScrubbing, updateFromClientX, handleMouseLeave]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No intraday data available
      </div>
    );
  }

  // Determine line color based on whether current value is above or below baseline
  const lastValue = chartData[chartData.length - 1]?.averageHours || 0;
  const selectedValue = activeIndex !== null ? chartData[activeIndex]?.averageHours : null;
  const effectiveValue = selectedValue ?? lastValue;
  const isAboveBaseline = effectiveValue >= baselineAverage;
  const lineColor = isAboveBaseline ? COLORS.positive : COLORS.negative;

  // Custom active dot with glow effect
  const renderActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAboveBaseline = payload.averageHours >= baselineAverage;
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

  // Generate unique gradient ID to avoid conflicts
  const scrubGradientId = `scrubGradient-intraday-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate gradient percentage based on active point's position within the LINE (not full X-axis)
  // The gradient applies to the line path, which spans from first to last data point
  const scrubPercentage = useMemo(() => {
    if (activeIndex === null || chartData.length < 2) return 100;
    
    const firstTimestamp = chartData[0].timestamp;
    const lastTimestamp = chartData[chartData.length - 1].timestamp;
    const activeTimestamp = chartData[activeIndex]?.timestamp;
    
    if (!activeTimestamp || firstTimestamp === lastTimestamp) return 100;
    
    // Calculate as percentage of the line's span (first to last data point)
    const percentage = ((activeTimestamp - firstTimestamp) / (lastTimestamp - firstTimestamp)) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [activeIndex, chartData]);

  return (
    <div
      ref={chartWrapperRef}
      className="w-full h-72 md:h-80 relative overscroll-none"
      style={{ touchAction: isScrubbing ? 'none' : 'pan-y' }}
    >
      <div
        className="absolute left-0 right-0 top-[-16px] bottom-[-24px] z-20"
        style={{ pointerEvents: isCoarsePointer || isScrubbing ? 'auto' : 'none' }}
        onPointerDown={(event) => handleScrubStart(event.clientX, event)}
        onTouchStartCapture={(event) => handleScrubStart(event.touches[0].clientX, event)}
      />
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData} 
          margin={{ top: 40, right: 24, left: 24, bottom: 20 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
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
            content={() => null}
            wrapperStyle={{ display: 'none' }}
          />
          
          {/* Single line with dynamic gradient stroke */}
          <Line
            type="linear"
            dataKey="averageHours"
            stroke={activeIndex !== null ? `url(#${scrubGradientId})` : lineColor}
            strokeWidth={2.5}
            dot={(props: any) => (props.index === activeIndex ? renderActiveDot(props) : null)}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
