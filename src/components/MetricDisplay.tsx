import { ChevronDown, ChevronUp } from 'lucide-react';
import { DailyData } from '@/lib/practiceAnalytics';
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
}

export function MetricDisplay({
  currentAverage,
  delta,
  isPositive,
  hoveredData
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

  // Determine display values based on hover state
  const displayValue = hoveredData ? hoveredData.cumulativeAverage : currentAverage;
  const displayLabel = hoveredData 
    ? `${format(hoveredData.date, 'd MMM')} · Day ${hoveredData.dayNumber}`
    : 'Daily Average';

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
        {!hoveredData && (
          <div 
            className="flex items-center gap-0.5 text-base font-medium"
            style={{ color: delta === 0 ? COLORS.muted : (isPositive ? COLORS.positive : COLORS.negative) }}
          >
            {delta !== 0 && (
              isPositive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
            <span>{formatDeltaPercent(delta)}</span>
          </div>
        )}
      </div>
    </div>
  );
}