import { useState, useRef } from 'react';
import { Info } from 'lucide-react';
import { formatHoursMinutes } from '@/lib/practiceAnalytics';
import { AverageInfoDialog } from './AverageInfoDialog';

// Trade Republic exact colors
const COLORS = {
  unreached: '#161616',
  muted: '#595A5F',
  white: '#FFFFFF',
};

interface StatsFooterProps {
  totalHours: number;
  totalDays: number;
  currentAverage?: number;
  onAddMilestone?: () => void;
}

export function StatsFooter({ totalHours, totalDays, currentAverage, onAddMilestone }: StatsFooterProps) {
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cards: { key: string; label: string; value: React.ReactNode; onClick?: () => void }[] = [
    {
      key: 'total-hours',
      label: 'Total Hours',
      value: formatHoursMinutes(totalHours),
      onClick: undefined,
    },
    {
      key: 'day-counter',
      label: 'Day Counter',
      value: String(totalDays),
      onClick: undefined,
    },
    {
      key: 'add-milestone',
      label: 'Add Milestone',
      value: '+',
      onClick: onAddMilestone,
    },
    {
      key: 'info',
      label: 'Time Info',
      value: <Info className="h-4 w-4" style={{ color: COLORS.white }} />,
      onClick: () => setShowInfo(true),
    },
  ];

  return (
    <>
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {cards.map((card) => {
          const Component = card.onClick ? 'button' : 'div';
          return (
            <Component
              key={card.key}
              onClick={card.onClick}
              className="flex flex-col px-3 py-2 rounded-lg flex-shrink-0 min-w-[calc(33.333%-6px)] text-left transition-opacity active:opacity-80"
              style={{ 
                backgroundColor: COLORS.unreached,
                scrollSnapAlign: 'start',
              }}
            >
              <span className="text-[10px] whitespace-nowrap" style={{ color: COLORS.muted }}>{card.label}</span>
              <span className="text-sm font-semibold" style={{ color: COLORS.white }}>
                {card.value}
              </span>
            </Component>
          );
        })}
      </div>

      <AverageInfoDialog
        open={showInfo}
        onOpenChange={setShowInfo}
        currentAverage={currentAverage ?? (totalDays > 0 ? totalHours / totalDays : 0)}
        totalHours={totalHours}
        totalDays={totalDays}
      />
    </>
  );
}
