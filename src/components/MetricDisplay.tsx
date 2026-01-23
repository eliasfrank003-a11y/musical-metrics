import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricDisplayProps {
  currentAverage: number;
  delta: number;
  isPositive: boolean;
}

export function MetricDisplay({ currentAverage, delta, isPositive }: MetricDisplayProps) {
  const formatHoursMinutes = (hours: number): string => {
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
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

  const formatDelta = (hours: number): string => {
    const totalSeconds = Math.round(Math.abs(hours) * 3600);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    
    if (m === 0 && s === 0) {
      return '0s';
    }
    
    const signPrefix = hours >= 0 ? '+' : '-';
    
    if (m === 0) {
      return `${signPrefix}${s}s`;
    }
    
    if (s === 0) {
      return `${signPrefix}${m}m`;
    }
    
    return `${signPrefix}${m}m ${s}s`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
        Lifetime Daily Average
      </p>
      <div className="flex items-baseline gap-4">
        <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground">
          {formatHoursMinutes(currentAverage)}
        </h1>
        <div
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
            isPositive
              ? 'bg-chart-positive/10 text-chart-positive'
              : delta === 0
              ? 'bg-secondary text-muted-foreground'
              : 'bg-chart-negative/10 text-chart-negative'
          }`}
        >
          {delta !== 0 && (
            isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )
          )}
          <span>{formatDelta(delta)}</span>
        </div>
      </div>
    </div>
  );
}
