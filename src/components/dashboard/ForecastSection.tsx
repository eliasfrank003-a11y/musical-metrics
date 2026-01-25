import { useMemo } from 'react';
import { format, addDays } from 'date-fns';

interface ForecastSectionProps {
  totalHours: number;
  dailyAverage: number;
}

const COLORS = {
  muted: '#595A5F',
  purple: '#A855F7',
  yellow: '#FACC15',
  card: '#161616',
};

export function ForecastSection({ totalHours, dailyAverage }: ForecastSectionProps) {
  const forecasts = useMemo(() => {
    const today = new Date();
    
    // Calculate hours remaining to 10,000
    const hoursTo10k = Math.max(0, 10000 - totalHours);
    const daysTo10k = dailyAverage > 0 ? Math.ceil(hoursTo10k / dailyAverage) : Infinity;
    const date10k = dailyAverage > 0 ? addDays(today, daysTo10k) : null;
    
    // Next 1000-hour milestone (e.g., if at 1045h, next is 2000h)
    const next1k = Math.ceil(totalHours / 1000) * 1000;
    const hoursToNext1k = next1k - totalHours;
    const daysToNext1k = dailyAverage > 0 ? Math.ceil(hoursToNext1k / dailyAverage) : Infinity;
    const dateNext1k = dailyAverage > 0 ? addDays(today, daysToNext1k) : null;
    
    // Next 100-hour milestone
    const next100 = Math.ceil(totalHours / 100) * 100;
    const hoursToNext100 = next100 - totalHours;
    const daysToNext100 = dailyAverage > 0 ? Math.ceil(hoursToNext100 / dailyAverage) : Infinity;
    const dateNext100 = dailyAverage > 0 ? addDays(today, daysToNext100) : null;
    
    return {
      to10k: { hours: hoursTo10k, days: daysTo10k, date: date10k },
      next1k: { milestone: next1k, hours: hoursToNext1k, days: daysToNext1k, date: dateNext1k },
      next100: { milestone: next100, hours: hoursToNext100, days: daysToNext100, date: dateNext100 },
    };
  }, [totalHours, dailyAverage]);

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'MMM d, yyyy');
  };

  return (
    <div className="space-y-4 px-4">
      {/* 10k Finish Card */}
      <div 
        className="rounded-lg p-4"
        style={{ backgroundColor: COLORS.card }}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs" style={{ color: COLORS.muted }}>Estimated 10,000h</p>
            <p className="text-2xl font-semibold mt-1">
              {formatDate(forecasts.to10k.date)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: COLORS.muted }}>
              {forecasts.to10k.hours.toFixed(0)}h remaining
            </p>
            <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
              ~{forecasts.to10k.days.toLocaleString()} days
            </p>
          </div>
        </div>
      </div>

      {/* Milestone Cards Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Next 1k Milestone */}
        <div 
          className="rounded-lg p-3"
          style={{ backgroundColor: COLORS.card }}
        >
          <p className="text-xs" style={{ color: COLORS.muted }}>Next 1,000h</p>
          <p 
            className="text-lg font-semibold mt-1"
            style={{ color: COLORS.purple }}
          >
            {forecasts.next1k.milestone.toLocaleString()}h
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
            {formatDate(forecasts.next1k.date)}
          </p>
        </div>

        {/* Next 100h Milestone */}
        <div 
          className="rounded-lg p-3"
          style={{ backgroundColor: COLORS.card }}
        >
          <p className="text-xs" style={{ color: COLORS.muted }}>Next 100h</p>
          <p 
            className="text-lg font-semibold mt-1"
            style={{ color: COLORS.yellow }}
          >
            {forecasts.next100.milestone.toLocaleString()}h
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
            {formatDate(forecasts.next100.date)}
          </p>
        </div>
      </div>
    </div>
  );
}
