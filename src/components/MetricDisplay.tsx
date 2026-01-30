import { ChevronDown, ChevronUp } from 'lucide-react';
import { DailyData, IntradayData } from '@/lib/practiceAnalytics';
import { format } from 'date-fns';

// Trade Republic exact colors
const COLORS = {
  positive: '#09C651',
  negative: '#FD4136',
  muted: '#595A5F',
  white: '#FFFFFF',
};

interface MetricDisplayProps {
  currentAverage: number;
  delta: number;
  isPositive: boolean;
  hoveredData?: DailyData | null;
  hoveredIntradayData?: IntradayData | null;
  baselineAverage?: number;
  isIntradayView?: boolean;
  todayPlayTime?: number; // Today's total play time in hours
}

export function MetricDisplay({
  currentAverage,
  delta,
  isPositive,
  hoveredData,
  hoveredIntradayData,
  baselineAverage = 0,
  isIntradayView = false,
  todayPlayTime = 0,
}: MetricDisplayProps) {
  const formatHoursMinutes = (hours: number): string => {
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor(totalSeconds % 3600 / 60);
    const s = totalSeconds % 60;
    if (h === 0 && m === 0 && s === 0) {
      return '0s';
    }
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  };

  // Format play time without seconds (h m format)
  const formatPlayTime = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatDeltaPercent = (hours: number): string => {
    const totalSeconds = Math.round(Math.abs(hours) * 3600);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m === 0 && s === 0) {
      return '0s';
    }
    if (m === 0) {
      return `${s}s`;
    }
    if (s === 0) {
      return `${m}m`;
    }
    return `${m}m ${s}s`;
  };

  // Format time difference (e.g., +10m, -1h 20m) - only show hours if > 0
  const formatTimeDifference = (hours: number): string => {
    const totalMinutes = Math.round(Math.abs(hours) * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const sign = hours >= 0 ? '+' : '-';
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${sign}${m}m`;
    if (m === 0) return `${sign}${h}h`;
    return `${sign}${h}h ${m}m`;
  };

  // Format delta for display in label (e.g., "+ 7s", "- 3s")
  const formatDeltaLabel = (hours: number): string => {
    const totalSeconds = Math.round(Math.abs(hours) * 3600);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const sign = hours >= 0 ? '+' : '-';
    if (m === 0 && s === 0) return '0s';
    if (m === 0) return `${sign} ${s}s`;
    if (s === 0) return `${sign} ${m}m`;
    return `${sign} ${m}m ${s}s`;
  };

  // Calculate delta caused by a specific day
  const calculateDayDelta = (data: DailyData): number => {
    if (data.dayNumber <= 1) return 0;
    const previousAverage = (data.cumulativeHours - data.hoursPlayed) / (data.dayNumber - 1);
    return data.cumulativeAverage - previousAverage;
  };

  // Determine display values based on hover state
  let displayValue: number;
  let displayLabel: string;
  let showDelta = true;
  let effectiveDelta = delta;
  let effectivePlayTime: number | null = null;
  let timeDifference: number | null = null;

  if (hoveredData) {
    displayValue = hoveredData.cumulativeAverage;
    effectivePlayTime = hoveredData.hoursPlayed;
    effectiveDelta = calculateDayDelta(hoveredData);
    // Format: date • day • play time • delta
    displayLabel = `${format(hoveredData.date, 'd MMM')} · Day ${hoveredData.dayNumber} · ${formatPlayTime(hoveredData.hoursPlayed)} · ${formatDeltaLabel(effectiveDelta)}`;
    showDelta = false; // Don't show delta indicator in the row below since it's in the label
  } else if (hoveredIntradayData) {
    displayValue = hoveredIntradayData.cumulativeAverage;
    // Calculate delta from baseline for this point
    effectiveDelta = hoveredIntradayData.cumulativeAverage - baselineAverage;
    // Time difference: how much played up to this point vs what the average was
    timeDifference = hoveredIntradayData.cumulativeTodayHours - baselineAverage;
    displayLabel = `${format(hoveredIntradayData.time, 'd MMM')} · ${hoveredIntradayData.timeStr} · ${formatPlayTime(hoveredIntradayData.cumulativeTodayHours)}`;
  } else if (isIntradayView) {
    displayValue = currentAverage;
    timeDifference = todayPlayTime - baselineAverage;
    displayLabel = 'Daily Average';
  } else {
    displayValue = currentAverage;
    displayLabel = 'Daily Average';
  }

  const deltaIsPositive = effectiveDelta >= 0;
  const timeDiffIsPositive = timeDifference !== null ? timeDifference >= 0 : true;

  return (
    <div className="flex flex-col items-start py-4">
      <span 
        className="text-sm mb-1 transition-all duration-150"
        style={{ color: COLORS.muted }}
      >
        {displayLabel}
      </span>
      <div className="flex items-center gap-3">
        <h1 
          className="text-4xl font-bold tracking-tight transition-all duration-150"
          style={{ color: COLORS.white }}
        >
          {formatHoursMinutes(displayValue)}
        </h1>
        {showDelta && (
          <div className="flex items-center gap-2">
            {/* Delta in average (seconds) */}
            <div 
              className="flex items-center gap-0.5 text-base font-medium"
              style={{ color: effectiveDelta === 0 ? COLORS.muted : (deltaIsPositive ? COLORS.positive : COLORS.negative) }}
            >
              {effectiveDelta !== 0 && (
                deltaIsPositive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
              <span>{formatDeltaPercent(effectiveDelta)}</span>
            </div>
            {/* Time difference from average (for 1D view) */}
            {timeDifference !== null && (
              <span 
                className="text-base font-medium"
                style={{ color: timeDifference === 0 ? COLORS.muted : (timeDiffIsPositive ? COLORS.positive : COLORS.negative) }}
              >
                {formatTimeDifference(timeDifference)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}