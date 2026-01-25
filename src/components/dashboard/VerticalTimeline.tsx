import { format } from 'date-fns';

interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
}

interface VerticalTimelineProps {
  milestones: Milestone[];
  currentHours: number;
  startDate: Date;
}

const COLORS = {
  muted: '#595A5F',
  green: '#09C651',
  purple: '#A855F7',
  card: '#161616',
  line: '#2A2A2A',
};

export function VerticalTimeline({ milestones, currentHours, startDate }: VerticalTimelineProps) {
  // Sort milestones by hours descending (highest first)
  const sortedMilestones = [...milestones].sort((a, b) => b.hours - a.hours);

  const formatMilestoneDate = (dateStr: string | null) => {
    if (!dateStr) return 'In Progress';
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const formatAverage = (avg: number | null) => {
    if (avg === null) return '—';
    const totalSeconds = Math.round(avg * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m/day`;
    }
    return `${minutes}m/day`;
  };

  return (
    <div className="px-4 py-6">
      {/* Current Progress Indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: COLORS.green }}
        />
        <div>
          <p className="font-semibold">
            {currentHours.toFixed(0)} Hours
          </p>
          <p className="text-xs" style={{ color: COLORS.muted }}>
            Current Progress • {format(new Date(), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative ml-[7px]">
        {/* Vertical Line */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: COLORS.line }}
        />

        {/* Milestone Nodes */}
        <div className="space-y-0">
          {sortedMilestones.map((milestone) => {
            const isAchieved = milestone.achieved_at !== null;
            const isNext = !isAchieved && milestone.hours <= Math.ceil(currentHours / 100) * 100;
            
            return (
              <div 
                key={milestone.id} 
                className="relative flex items-start gap-4 py-4"
              >
                {/* Node Dot */}
                <div 
                  className="w-3 h-3 rounded-full -ml-[5px] mt-1 flex-shrink-0 relative z-10"
                  style={{ 
                    backgroundColor: isAchieved ? COLORS.green : COLORS.muted,
                    border: isNext ? `2px solid ${COLORS.purple}` : undefined,
                  }}
                />
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p 
                      className="font-medium"
                      style={{ color: isAchieved ? 'inherit' : COLORS.muted }}
                    >
                      {milestone.hours.toLocaleString()} Hours
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: COLORS.muted }}
                    >
                      {formatMilestoneDate(milestone.achieved_at)}
                    </p>
                  </div>
                  {isAchieved && milestone.average_at_milestone && (
                    <p 
                      className="text-xs mt-0.5"
                      style={{ color: COLORS.muted }}
                    >
                      Avg: {formatAverage(milestone.average_at_milestone)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Node */}
        <div className="relative flex items-start gap-4 py-4 mt-2">
          <div 
            className="w-3 h-3 rounded-full -ml-[5px] mt-1 flex-shrink-0 relative z-10 border-2"
            style={{ 
              backgroundColor: 'transparent',
              borderColor: COLORS.muted,
            }}
          />
          <div>
            <p className="font-medium" style={{ color: COLORS.muted }}>
              Journey Started
            </p>
            <p 
              className="text-xs"
              style={{ color: COLORS.muted }}
            >
              {format(startDate, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
