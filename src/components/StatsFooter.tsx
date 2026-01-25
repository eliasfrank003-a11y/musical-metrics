import { Plus } from 'lucide-react';
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
  onAddMilestone?: () => void;
}

export function StatsFooter({ totalHours, totalDays, onAddMilestone }: StatsFooterProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div 
        className="flex flex-col px-2 py-2 rounded-lg"
        style={{ backgroundColor: COLORS.unreached }}
      >
        <span className="text-[10px]" style={{ color: COLORS.muted }}>Total Hours</span>
        <span className="text-sm font-semibold" style={{ color: COLORS.white }}>
          {formatHoursMinutes(totalHours)}
        </span>
      </div>
      
      <div 
        className="flex flex-col px-2 py-2 rounded-lg"
        style={{ backgroundColor: COLORS.unreached }}
      >
        <span className="text-[10px]" style={{ color: COLORS.muted }}>Day Counter</span>
        <span className="text-sm font-semibold" style={{ color: COLORS.white }}>{totalDays}</span>
      </div>

      <button
        onClick={onAddMilestone}
        className="flex flex-col items-start px-2 py-2 rounded-lg transition-opacity hover:opacity-80 text-left"
        style={{ backgroundColor: COLORS.unreached }}
      >
        <span className="text-[10px]" style={{ color: COLORS.muted }}>Add Milestone</span>
        <span className="text-sm font-semibold" style={{ color: COLORS.white }}>+</span>
      </button>
    </div>
  );
}
