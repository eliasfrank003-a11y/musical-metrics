import { formatHoursMinutes } from '@/lib/practiceAnalytics';

// Trade Republic exact colors
const COLORS = {
  unreached: '#161616',
  muted: '#595A5F',
  white: '#FFFFFF',
};

interface StatsFooterProps {
  totalHours: number;
  totalDays: number;
}

export function StatsFooter({ totalHours, totalDays }: StatsFooterProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div 
        className="flex flex-col px-3 py-2 rounded-lg"
        style={{ backgroundColor: COLORS.unreached }}
      >
        <span className="text-xs" style={{ color: COLORS.muted }}>Total Hours</span>
        <span className="text-base font-semibold" style={{ color: COLORS.white }}>
          {formatHoursMinutes(totalHours)}
        </span>
      </div>
      
      <div 
        className="flex flex-col px-3 py-2 rounded-lg"
        style={{ backgroundColor: COLORS.unreached }}
      >
        <span className="text-xs" style={{ color: COLORS.muted }}>Day Counter</span>
        <span className="text-base font-semibold" style={{ color: COLORS.white }}>{totalDays}</span>
      </div>
    </div>
  );
}
