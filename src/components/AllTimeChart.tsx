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
  line: 'hsl(var(--muted-foreground))',        // Neutral line color
  muted: 'hsl(var(--muted-foreground))',       // Muted text for axes
  white: 'hsl(var(--foreground))',             // Foreground for active dot
  annotation: 'hsl(var(--muted-foreground))',  // Neutral for annotations
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
    const explicitLabel = lines.find(l => l === 'Y1' || l === 'Y2');
    const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{2}\/\d{2}\/\d{2}$/.test(s);
    const locations = ['Maastricht', 'Rungan Sari', 'Florence'];
    const equipment = ['Roland FP-30X', 'Kawai RX1', 'Kawai CA901'];
    
    const nameLine = explicitLabel ?? lines.find(l => !isDate(l) && !locations.includes(l) && !equipment.includes(l));
    
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
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [viewStart, setViewStart] = useState<number | null>(null);
  const [viewEnd, setViewEnd] = useState<number | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const touchHoldRef = useRef<{ x: number; y: number; timeoutId: number | null } | null>(null);
  const panStateRef = useRef<{ startX: number; startViewStart: number; startViewEnd: number } | null>(null);
  const pinchStateRef = useRef<{ startDistance: number; startViewStart: number; startViewEnd: number } | null>(null);
  const panRafRef = useRef<number | null>(null);
  const panPendingRef = useRef<{ start: number; end: number } | null>(null);
  const isCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    []
  );
  const TOUCH_HOLD_MS = 140;
  const MOVE_CANCEL_THRESHOLD = 10;

  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      index,
      timestamp: d.date.getTime(),
      displayDate: format(d.date, 'd MMM yyyy'),
      averageHours: d.cumulativeAverage,
    }));
  }, [data]);

  const { dataMin, dataMax } = useMemo(() => {
    if (chartData.length === 0) return { dataMin: 0, dataMax: 0 };
    return {
      dataMin: chartData[0].timestamp,
      dataMax: chartData[chartData.length - 1].timestamp,
    };
  }, [chartData]);

  useEffect(() => {
    if (chartData.length === 0) return;
    setViewStart(dataMin);
    setViewEnd(dataMax);
  }, [chartData.length, dataMin, dataMax]);

  const fullRangeMs = dataMax - dataMin;
  const viewWindowMs = viewStart !== null && viewEnd !== null ? viewEnd - viewStart : 0;
  const minWindowMs = Math.min(fullRangeMs, 1000 * 60 * 60 * 24 * 365);
  const isZoomed = viewWindowMs > 0 && viewWindowMs < fullRangeMs;

  const visibleChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (viewStart === null || viewEnd === null) return chartData;

    const startIndex = chartData.findIndex(d => d.timestamp >= viewStart);
    const endIndex = chartData.findIndex(d => d.timestamp > viewEnd);

    const sliceStart = startIndex === -1 ? 0 : Math.max(0, startIndex - 1);
    const sliceEnd = endIndex === -1 ? chartData.length : Math.min(chartData.length, endIndex + 1);

    return chartData.slice(sliceStart, sliceEnd);
  }, [chartData, viewStart, viewEnd]);

  const displayData = visibleChartData.length > 0 ? visibleChartData : chartData;

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
      .filter(m => m.timestamp >= startTime && m.timestamp <= endTime)
      .filter(m => (viewStart === null || m.timestamp >= viewStart) && (viewEnd === null || m.timestamp <= viewEnd));
    
    return markers;
  }, [milestones, chartData, viewStart, viewEnd]);

  // Calculate exactly 5 equidistant time-based ticks
  const xAxisTicks = useMemo(() => {
    if (displayData.length < 2) return undefined;

    const startTime = viewStart ?? chartData[0].timestamp;
    const endTime = viewEnd ?? chartData[chartData.length - 1].timestamp;
    const timeRange = endTime - startTime;

    return [0, 0.25, 0.5, 0.75, 1].map(fraction =>
      startTime + (timeRange * fraction)
    );
  }, [chartData, displayData.length, viewStart, viewEnd]);

  const xAxisLabels = useMemo(() => {
    if (displayData.length < 2) return [];

    const startTime = viewStart ?? chartData[0].timestamp;
    const endTime = viewEnd ?? chartData[chartData.length - 1].timestamp;
    const timeRange = endTime - startTime;

    return [0, 0.25, 0.5, 0.75, 1].map(fraction =>
      format(new Date(startTime + (timeRange * fraction)), 'MMM yyyy')
    );
  }, [chartData, displayData.length, viewStart, viewEnd]);

  // Keep Y-scale stable while panning by using full-range min/max
  const { range, yDomain } = useMemo(() => {
    if (chartData.length === 0) return { range: 0, yDomain: [0, 0] as [number, number] };
    const values = chartData.map(d => d.averageHours);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const dataRange = max - min;
    const padding = dataRange > 0 ? dataRange * 0.08 : Math.abs(min) * 0.05;
    return { range: dataRange, yDomain: [min - padding, max + padding] as [number, number] };
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

  const renderXAxisTick = useCallback((props: any) => {
    const { y, index, viewBox, payload } = props;
    if (!viewBox || index === undefined) return null;
    const fraction = index / 4;
    const x = viewBox.x + viewBox.width * fraction;
    const label = xAxisLabels[index] ?? '';

    return (
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fill={COLORS.muted}
        fontSize={12}
      >
        {label}
      </text>
    );
  }, [formatXAxisTick, xAxisLabels]);

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activeTooltipIndex !== undefined) {
      const index = state.activeTooltipIndex;
      setActiveIndex(index);
      const percentage = displayData.length > 1 
        ? (index / (displayData.length - 1)) * 100 
        : 100;
      setScrubPercentage(percentage);
    }
    if (state?.activePayload?.[0]?.payload && onHover) {
      onHover(state.activePayload[0].payload as DailyData);
    }
  }, [onHover, displayData.length]);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
    setScrubPercentage(100);
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  const updateFromClientX = useCallback((clientX: number) => {
    if (!chartWrapperRef.current || displayData.length === 0) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const index = Math.round(ratio * (displayData.length - 1));
    const clampedIndex = Math.min(Math.max(index, 0), displayData.length - 1);

    setActiveIndex(clampedIndex);
    setScrubPercentage(displayData.length > 1 ? (clampedIndex / (displayData.length - 1)) * 100 : 100);
    if (onHover) {
      onHover(displayData[clampedIndex] as DailyData);
    }
  }, [displayData, onHover]);

  const handleScrubStart = useCallback((clientX: number, event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsScrubbing(true);
    updateFromClientX(clientX);
  }, [updateFromClientX]);

  const clearTouchHold = useCallback(() => {
    if (touchHoldRef.current?.timeoutId) {
      window.clearTimeout(touchHoldRef.current.timeoutId);
    }
    touchHoldRef.current = null;
  }, []);


  const clampViewRange = useCallback((start: number, end: number) => {
    let newStart = start;
    let newEnd = end;
    if (newStart < dataMin) {
      newEnd += dataMin - newStart;
      newStart = dataMin;
    }
    if (newEnd > dataMax) {
      newStart -= newEnd - dataMax;
      newEnd = dataMax;
    }
    newStart = Math.max(newStart, dataMin);
    newEnd = Math.min(newEnd, dataMax);
    return { start: newStart, end: newEnd };
  }, [dataMin, dataMax]);

  const zoomBy = useCallback((factor: number) => {
    if (viewStart === null || viewEnd === null || fullRangeMs <= 0) return;
    const windowMs = viewEnd - viewStart;
    const targetWindow = windowMs * factor;
    const newWindow = Math.max(minWindowMs, Math.min(fullRangeMs, targetWindow));
    const center = (viewStart + viewEnd) / 2;
    const newStart = center - newWindow / 2;
    const newEnd = center + newWindow / 2;
    const clamped = clampViewRange(newStart, newEnd);
    setViewStart(clamped.start);
    setViewEnd(clamped.end);
  }, [viewStart, viewEnd, fullRangeMs, minWindowMs, clampViewRange]);

  const handlePanStart = useCallback((clientX: number, event?: React.SyntheticEvent) => {
    if (!isZoomed || viewStart === null || viewEnd === null || isZooming || isScrubbing) return;
    event?.preventDefault();
    event?.stopPropagation();
    panStateRef.current = { startX: clientX, startViewStart: viewStart, startViewEnd: viewEnd };
    setIsPanning(true);
  }, [isZoomed, viewStart, viewEnd, isZooming, isScrubbing]);

  const scheduleTouchHold = useCallback((clientX: number, clientY: number) => {
    clearTouchHold();
    const timeoutId = window.setTimeout(() => {
      touchHoldRef.current = null;
      if (isZoomed && !isZooming) {
        handlePanStart(clientX);
      } else {
        handleScrubStart(clientX);
      }
    }, TOUCH_HOLD_MS);
    touchHoldRef.current = { x: clientX, y: clientY, timeoutId };
  }, [clearTouchHold, handlePanStart, handleScrubStart, isZoomed, isZooming, TOUCH_HOLD_MS]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current || fullRangeMs <= 0) return;
    if (isPanning) return;

    const isPinch = event.ctrlKey;
    const hasHorizontalScroll = Math.abs(event.deltaX) > Math.abs(event.deltaY);

    if (isPinch) {
      if (isPanning) return;
      event.preventDefault();
      event.stopPropagation();
      setIsZooming(true);
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      zoomBy(factor);
      window.setTimeout(() => setIsZooming(false), 120);
      return;
    }

    if (isZoomed && !isZooming && (hasHorizontalScroll || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      const rect = chartWrapperRef.current.getBoundingClientRect();
      const deltaX = hasHorizontalScroll ? event.deltaX : event.deltaY;
      const windowMs = viewWindowMs || fullRangeMs;
      const deltaTime = rect.width > 0 ? (deltaX / rect.width) * windowMs : 0;
      if (viewStart !== null && viewEnd !== null) {
        const clamped = clampViewRange(viewStart + deltaTime, viewEnd + deltaTime);
        setViewStart(clamped.start);
        setViewEnd(clamped.end);
      }
    }
  }, [clampViewRange, fullRangeMs, isPanning, isZoomed, isZooming, viewEnd, viewStart, viewWindowMs, zoomBy]);

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

  useEffect(() => () => clearTouchHold(), [clearTouchHold]);

  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMove = (e: TouchEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined || !chartWrapperRef.current || !panStateRef.current) return;

      const rect = chartWrapperRef.current.getBoundingClientRect();
      const deltaX = clientX - panStateRef.current.startX;
      const windowMs = panStateRef.current.startViewEnd - panStateRef.current.startViewStart;
      const deltaTime = rect.width > 0 ? -(deltaX / rect.width) * windowMs : 0;

      const newStart = panStateRef.current.startViewStart + deltaTime;
      const newEnd = panStateRef.current.startViewEnd + deltaTime;
      const clamped = clampViewRange(newStart, newEnd);
      panPendingRef.current = { start: clamped.start, end: clamped.end };

      if (panRafRef.current === null) {
        panRafRef.current = window.requestAnimationFrame(() => {
          if (panPendingRef.current) {
            setViewStart(panPendingRef.current.start);
            setViewEnd(panPendingRef.current.end);
          }
          panRafRef.current = null;
        });
      }
    };

    const handleGlobalEnd = () => {
      setIsPanning(false);
      panStateRef.current = null;
      if (panRafRef.current !== null) {
        window.cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      panPendingRef.current = null;
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
  }, [isPanning, clampViewRange]);

  useEffect(() => {
    if (!isZooming) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isZooming]);

  useEffect(() => {
    if (!(isPanning || isScrubbing)) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPanning, isScrubbing]);

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

  const canZoomIn = viewWindowMs > minWindowMs + 1;
  const canZoomOut = viewWindowMs < fullRangeMs - 1;
  const handleZoomIn = () => zoomBy(0.7);
  const handleZoomOut = () => zoomBy(1 / 0.7);

  return (
    <div
      ref={chartWrapperRef}
      className="w-full h-72 md:h-80 relative overscroll-none"
      style={{ touchAction: isScrubbing || isPanning || isZooming ? 'none' : 'pan-y' }}
      onWheel={handleWheel}
    >
      <div
        className="absolute left-0 right-0 top-[-16px] bottom-[-24px] z-20"
        style={{ pointerEvents: isCoarsePointer || isScrubbing ? 'auto' : 'none' }}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') return;
          if (isZoomed && isCoarsePointer) {
            handlePanStart(event.clientX, event);
          } else {
            handleScrubStart(event.clientX, event);
          }
        }}
        onTouchStartCapture={(event) => {
          if (event.touches.length >= 2) {
            if (isPanning || isScrubbing) return;
            event.preventDefault();
            event.stopPropagation();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            if (viewStart !== null && viewEnd !== null) {
              pinchStateRef.current = { startDistance: distance, startViewStart: viewStart, startViewEnd: viewEnd };
              setIsZooming(true);
            }
            return;
          }
          scheduleTouchHold(event.touches[0].clientX, event.touches[0].clientY);
        }}
        onTouchMoveCapture={(event) => {
          if (pinchStateRef.current && event.touches.length >= 2) {
            event.preventDefault();
            event.stopPropagation();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            const ratio = pinchStateRef.current.startDistance > 0 ? distance / pinchStateRef.current.startDistance : 1;
            const targetWindow = (pinchStateRef.current.startViewEnd - pinchStateRef.current.startViewStart) / ratio;
            const newWindow = Math.max(minWindowMs, Math.min(fullRangeMs, targetWindow));
            const center = (pinchStateRef.current.startViewStart + pinchStateRef.current.startViewEnd) / 2;
            const newStart = center - newWindow / 2;
            const newEnd = center + newWindow / 2;
            const clamped = clampViewRange(newStart, newEnd);
            setViewStart(clamped.start);
            setViewEnd(clamped.end);
            return;
          }

          if (event.touches.length !== 1) return;
          const touch = event.touches[0];
          if (touchHoldRef.current) {
            const deltaX = touch.clientX - touchHoldRef.current.x;
            const deltaY = touch.clientY - touchHoldRef.current.y;
            if (Math.abs(deltaX) > MOVE_CANCEL_THRESHOLD || Math.abs(deltaY) > MOVE_CANCEL_THRESHOLD) {
              clearTouchHold();
            }
          }

          if (isScrubbing) {
            event.preventDefault();
            event.stopPropagation();
            updateFromClientX(touch.clientX);
          } else if (isPanning) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onTouchEndCapture={(event) => {
          clearTouchHold();
          pinchStateRef.current = null;
          setIsZooming(false);
          if (isScrubbing) {
            if ('preventDefault' in event) event.preventDefault();
            if ('stopPropagation' in event) event.stopPropagation();
            setIsScrubbing(false);
            handleMouseLeave();
          }
        }}
        onTouchCancelCapture={(event) => {
          clearTouchHold();
          pinchStateRef.current = null;
          setIsZooming(false);
          if (isScrubbing) {
            if ('preventDefault' in event) event.preventDefault();
            if ('stopPropagation' in event) event.stopPropagation();
            setIsScrubbing(false);
            handleMouseLeave();
          }
        }}
      />
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={displayData} 
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
            domain={[viewStart ?? 'dataMin', viewEnd ?? 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            tick={renderXAxisTick}
            ticks={xAxisTicks}
            tickFormatter={formatXAxisTick}
            interval={0}
          />
          <YAxis
            domain={yDomain}
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
