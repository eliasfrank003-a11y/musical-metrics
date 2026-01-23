import { Clock, Calendar } from 'lucide-react';
import { formatHoursMinutes } from '@/lib/practiceAnalytics';

interface StatsFooterProps {
  totalHours: number;
  totalDays: number;
}

export function StatsFooter({ totalHours, totalDays }: StatsFooterProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col items-center p-4 rounded-xl bg-secondary/50 border border-border">
        <Clock className="w-5 h-5 text-primary mb-2" />
        <span className="text-xl font-bold text-foreground">
          {formatHoursMinutes(totalHours)}
        </span>
        <span className="text-xs text-muted-foreground">Total Hours</span>
      </div>
      
      <div className="flex flex-col items-center p-4 rounded-xl bg-secondary/50 border border-border">
        <Calendar className="w-5 h-5 text-primary mb-2" />
        <span className="text-xl font-bold text-foreground">{totalDays}</span>
        <span className="text-xs text-muted-foreground">Days Tracked</span>
      </div>
    </div>
  );
}
