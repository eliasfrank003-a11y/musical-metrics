import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricDisplayProps {
  currentAverage: number;
  delta: number;
  isPositive: boolean;
}

export function MetricDisplay({ currentAverage, delta, isPositive }: MetricDisplayProps) {
  const formatHoursMinutes = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    
    if (h === 0 && m === 0) {
      return '0m';
    }
    
    if (h === 0) {
      return `${m}m`;
    }
    
    if (m === 0) {
      return `${h}h`;
    }
    
    return `${h}h ${m}m`;
  };

  const formatDelta = (hours: number): string => {
    const sign = hours >= 0 ? '+' : '';
    const m = Math.round(hours * 60);
    
    if (Math.abs(m) < 1) {
      return '0m';
    }
    
    return `${sign}${m}m`;
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
