import { formatHoursMinutes } from '@/lib/practiceAnalytics';

interface StatsFooterProps {
  totalHours: number;
  totalDays: number;
}

export function StatsFooter({ totalHours, totalDays }: StatsFooterProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div 
        className="flex flex-col px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#161616' }}
      >
        <span className="text-sm" style={{ color: '#7F8494' }}>Total Hours</span>
        <span className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>
          {formatHoursMinutes(totalHours)}
        </span>
      </div>
      
      <div 
        className="flex flex-col px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#161616' }}
      >
        <span className="text-sm" style={{ color: '#7F8494' }}>Days Tracked</span>
        <span className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{totalDays}</span>
      </div>
    </div>
  );
}
