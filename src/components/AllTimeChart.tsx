import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { format } from 'date-fns';
import { DailyData } from '@/lib/practiceAnalytics';

interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
  description: string | null;
  milestone_type: string;
}

interface AllTimeChartProps {
  data: DailyData[];
  milestones: Milestone[];
  onHover?: (data: DailyData | null) => void;
}

// Minimalist color palette
const COLORS = {
  line: '#6B7280',        // Neutral gray for the main line
  muted: '#595A5F',       // Muted text for axes
  white: '#FFFFFF',       // White for active dot
  annotation: '#9CA3AF',  // Single color for most annotations
  teachers: '#F59E0B',    // Warm amber for teachers
  milestone: '#A78BFA',   // Soft purple for special milestones (Split Time, App v1)
};

// Special milestone hours that get purple color
const specialMilestoneHours = [373, 960]; // Split Time, App v1

// Determine if a milestone is teacher-related
const isTeacherMilestone = (m: Milestone): boolean => {
  // Only check custom milestones for teacher association
  if (m.milestone_type !== 'custom') return false;
  
  const teacherKeywords = ['Florence', 'Ibu Septi', 'Didier', 'teacher', 'Teacher', 'lesson'];
  if (m.description && teacherKeywords.some(kw => m.description!.includes(kw))) return true;
  // Check by hours for known teacher milestones
  const teacherHours = [250, 447, 530, 641]; // Florence and Ibu Septi transitions
  return teacherHours.includes(m.hours);
};

// Get proper title for a milestone - matching VerticalTimeline logic exactly
const getMilestoneTitle = (m: Milestone): string | null => {
  const isCustom = m.milestone_type === 'custom';
  
  // Format hours with dot separator (e.g., 1.000h)
  const formatHours = (h: number) => h.toLocaleString('de-DE') + 'h';
  
  if (!isCustom) {
    // Regular 100h/1k milestones - just show hours
    return formatHours(m.hours);
  }
  
  // Direct mapping for known custom milestones
  const customTitles: Record<number, string> = {
    373: 'Split Time',
    447: '→ Florence',
    250: 'Florence →',
    530: 'Ibu Septi →',
    641: '→ Ibu Septi',
    960: 'App v1',
  };
  
  if (customTitles[m.hours]) {
    return customTitles[m.hours];
  }
  
  if (m.description) {
    const lines = m.description.split('\n').map(l => l.trim()).filter(l => l);
    const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{2}\/\d{2}\/\d{2}$/.test(s);
    const locations = ['Maastricht', 'Rungan Sari', 'Florence'];
    const equipment = ['Roland FP-30X', 'Kawai RX1', 'Kawai CA901'];
    
    const nameLine = lines.find(l => !isDate(l) && !locations.includes(l) && !equipment.includes(l));
    
    if (nameLine) {
      if (nameLine === 'Didier') {
        return 'Didier →';
      } else if (nameLine.toLowerCase().includes('splitting') || nameLine.toLowerCase().includes('v1')) {
        // Split Time and Piano v1 revert to normal hours display
        return m.hours.toLocaleString('de-DE') + 'h';
      } else {
        return nameLine;
      }
    }
  }
  
  // Fallback - but this shouldn't happen if data is correct
  return null;
};

export function AllTimeChart({ data, milestones, onHover }: AllTimeChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrubPercentage, setScrubPercentage] = useState<number>(100);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      index,
      timestamp: d.date.getTime(),
      displayDate: format(d.date, 'd MMM yyyy'),
      averageHours: d.cumulativeAverage,
    }));
  }, [data]);

  // Map milestones to chart data points - only show ones with proper titles
  const milestoneMarkers = useMemo(() => {
    if (chartData.length === 0) return [];
    
    const startTime = chartData[0].timestamp;
    const endTime = chartData[chartData.length - 1].timestamp;
    
    const markers = milestones
      .filter(m => m.achieved_at && m.milestone_type !== 'next')
      .map((m, idx) => {
        const milestoneTime = new Date(m.achieved_at!).getTime();
        const title = getMilestoneTitle(m);
        
        // Skip if no proper title
        if (!title) return null;
        
        // Find the closest data point
        let closestDataIdx = 0;
        let closestDistance = Infinity;
        chartData.forEach((d, i) => {
          const distance = Math.abs(d.timestamp - milestoneTime);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestDataIdx = i;
          }
        });
        
        const is1k = m.hours >= 1000 && m.hours % 1000 === 0;
        const isCustom = m.milestone_type === 'custom';
        const isTeacher = isTeacherMilestone(m);
        
        // Determine category for coloring
        let category: 'hours1k' | 'teacher' | 'custom' | 'hours100';
        if (is1k) {
          category = 'hours1k';
        } else if (isTeacher) {
          category = 'teacher';
        } else if (isCustom) {
          category = 'custom';
        } else {
          category = 'hours100';
        }
        
        return {
          ...m,
          title,
          category,
          closestDataIdx,
          timestamp: chartData[closestDataIdx]?.timestamp || milestoneTime,
          yValue: chartData[closestDataIdx]?.averageHours || 0,
          is1k,
          isCustom,
          isTeacher,
          labelAbove: idx % 2 === 0,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
    
    return markers;
  }, [milestones, chartData]);

  // Calculate exactly 5 equidistant time-based ticks
  const xAxisTicks = useMemo(() => {
    if (chartData.length < 2) return undefined;
    
    const startTime = chartData[0].timestamp;
    const endTime = chartData[chartData.length - 1].timestamp;
    const timeRange = endTime - startTime;
    
    return [0, 0.25, 0.5, 0.75, 1].map(fraction => 
      startTime + (timeRange * fraction)
    );
  }, [chartData]);

  // Calculate the data range
  const { range } = useMemo(() => {
    if (chartData.length === 0) return { range: 0 };
    const values = chartData.map(d => d.averageHours);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { range: max - min };
  }, [chartData]);

  const formatYAxis = useCallback((value: number) => {
    const totalSeconds = Math.round(value * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (range < 1) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, [range]);

  const formatXAxisTick = useCallback((timestamp: number) => {
    return format(new Date(timestamp), 'MMM yyyy');
  }, []);

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

  const updateFromClientX = useCallback((clientX: number) => {
    if (!chartWrapperRef.current || chartData.length === 0) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const index = Math.round(ratio * (chartData.length - 1));
    const clampedIndex = Math.min(Math.max(index, 0), chartData.length - 1);

    setActiveIndex(clampedIndex);
    setScrubPercentage(chartData.length > 1 ? (clampedIndex / (chartData.length - 1)) * 100 : 100);
    if (onHover) {
      onHover(chartData[clampedIndex] as DailyData);
    }
  }, [chartData, onHover]);

  const handleScrubStart = useCallback((clientX: number, event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsScrubbing(true);
    updateFromClientX(clientX);
  }, [updateFromClientX]);

  // Attach global listeners when scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMove = (e: TouchEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX !== undefined) updateFromClientX(clientX);
    };

    const handleGlobalEnd = () => {
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
        No data available
      </div>
    );
  }

  // Custom active dot - minimal white
  const renderActiveDot = (props: any) => {
    const { cx, cy } = props;
    
    return (
      <g>
        <circle cx={cx} cy={cy} r={16} fill={COLORS.white} opacity={0.06} />
        <circle cx={cx} cy={cy} r={10} fill={COLORS.white} opacity={0.12} />
        <circle cx={cx} cy={cy} r={4} fill={COLORS.white} stroke="none" />
      </g>
    );
  };

  // Milestone annotation - uniform styling, only teachers get different color
  const renderMilestoneLabel = (props: any) => {
    const { viewBox, milestone } = props;
    if (!viewBox || viewBox.x === undefined || viewBox.y === undefined) return null;
    
    const { x, y } = viewBox;
    const labelOffset = milestone.labelAbove ? -36 : 32;
    const lineLength = milestone.labelAbove ? -24 : 20;
    
    // Color based on type: 1k = white, teachers = amber, special = purple, others = gray
    const is1k = milestone.hours >= 1000 && milestone.hours % 1000 === 0;
    const isSpecial = specialMilestoneHours.includes(milestone.hours);
    const color = is1k ? COLORS.white : milestone.isTeacher ? COLORS.teachers : isSpecial ? COLORS.milestone : COLORS.annotation;
    
    // Uniform sizing for all
    const fontSize = 10;
    const fontWeight = 500;
    const dotRadius = 3;
    const lineWidth = 1.5;  // Thicker lines
    
    return (
      <g>
        {/* Vertical connecting line - thicker */}
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={y + lineLength}
          stroke={color}
          strokeWidth={lineWidth}
          strokeOpacity={0.7}
        />
        {/* Dot at the data point */}
        <circle
          cx={x}
          cy={y}
          r={dotRadius}
          fill={color}
        />
        {/* Label text */}
        <text
          x={x}
          y={y + labelOffset}
          textAnchor="middle"
          fill={color}
          fontSize={fontSize}
          fontWeight={fontWeight}
        >
          {milestone.title}
        </text>
      </g>
    );
  };

  const scrubGradientId = `scrubGradient-alltime-${Math.random().toString(36).substr(2, 9)}`;

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
          margin={{ top: 45, right: 24, left: 24, bottom: 20 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={scrubGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset={`${scrubPercentage}%`} stopColor={COLORS.line} />
              <stop offset={`${scrubPercentage}%`} stopColor={COLORS.muted} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.muted} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.muted, fontSize: 12 }}
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
            tick={{ fill: COLORS.muted, fontSize: 12 }}
            orientation="right"
            mirror={true}
            dx={-10}
            width={0}
          />
          <Tooltip
            cursor={false}
            content={() => null}
            wrapperStyle={{ display: 'none' }}
          />
          
          {/* The main line - neutral gray (rendered first so annotations appear on top) */}
          <Line
            type="linear"
            dataKey="averageHours"
            stroke={activeIndex !== null ? `url(#${scrubGradientId})` : COLORS.line}
            strokeWidth={2}
            dot={(props: any) => (props.index === activeIndex ? renderActiveDot(props) : null)}
            activeDot={false}
            isAnimationActive={false}
          />
          
          {/* Milestone annotations (rendered after line so they appear on top) */}
          {milestoneMarkers.map((m) => (
            <ReferenceDot
              key={m.id}
              x={m.timestamp}
              y={m.yValue}
              r={0}
              label={(props: any) => renderMilestoneLabel({ ...props, milestone: m })}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
