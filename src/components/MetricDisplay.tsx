import { ChevronDown, ChevronUp } from 'lucide-react';
import { DailyData } from '@/lib/practiceAnalytics';
import { format } from 'date-fns';

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
    ? format(hoveredData.date, 'd. MMM · HH:mm')
    : 'Daily Average';

  return (
    <div className="flex flex-col items-start py-4">
      <span className="text-sm text-muted-foreground mb-1 transition-all duration-150">
        {displayLabel}
      </span>
      <div className="flex items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-foreground transition-all duration-150">
          {formatHoursMinutes(displayValue)}
        </h1>
        {!hoveredData && (
          <div className={`flex items-center gap-0.5 text-base font-medium ${
            isPositive ? 'text-chart-positive' : delta === 0 ? 'text-muted-foreground' : 'text-chart-negative'
          }`}>
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
