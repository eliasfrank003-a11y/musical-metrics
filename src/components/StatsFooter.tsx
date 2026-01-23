import { Clock, Calendar, Music } from 'lucide-react';
import { formatHoursMinutes } from '@/lib/practiceAnalytics';

interface StatsFooterProps {
  totalHours: number;
  totalDays: number;
  startDate: Date;
}

export function StatsFooter({ totalHours, totalDays, startDate }: StatsFooterProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="grid grid-cols-3 gap-4">
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
      
      <div className="flex flex-col items-center p-4 rounded-xl bg-secondary/50 border border-border">
        <Music className="w-5 h-5 text-primary mb-2" />
        <span className="text-xl font-bold text-foreground">
          {formatDate(startDate)}
        </span>
        <span className="text-xs text-muted-foreground">Started</span>
      </div>
    </div>
  );
}
