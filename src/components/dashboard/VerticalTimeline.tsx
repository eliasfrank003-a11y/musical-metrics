import { format, addDays } from 'date-fns';

interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
  description?: string | null;
}

interface VerticalTimelineProps {
  milestones: Milestone[];
  currentHours: number;
  dailyAverage: number;
  startDate: Date;
}

const COLORS = {
  muted: '#595A5F',
  green: '#09C651',
  purple: '#A855F7',
  yellow: '#FACC15',
  card: '#161616',
  line: '#2A2A2A',
};

export function VerticalTimeline({ milestones, currentHours, dailyAverage, startDate }: VerticalTimelineProps) {
  // Calculate future milestones
  const today = new Date();
  
  // 10,000h finish
  const hoursTo10k = Math.max(0, 10000 - currentHours);
  const daysTo10k = dailyAverage > 0 ? Math.ceil(hoursTo10k / dailyAverage) : Infinity;
  const date10k = dailyAverage > 0 ? addDays(today, daysTo10k) : null;
  
  // Next 1000h milestone
  const next1k = Math.ceil(currentHours / 1000) * 1000;
  const hoursToNext1k = next1k - currentHours;
  const daysToNext1k = dailyAverage > 0 ? Math.ceil(hoursToNext1k / dailyAverage) : Infinity;
  const dateNext1k = dailyAverage > 0 ? addDays(today, daysToNext1k) : null;
  
  // Next 100h milestone
  const next100 = Math.ceil(currentHours / 100) * 100;
  const hoursToNext100 = next100 - currentHours;
  const daysToNext100 = dailyAverage > 0 ? Math.ceil(hoursToNext100 / dailyAverage) : Infinity;
  const dateNext100 = dailyAverage > 0 ? addDays(today, daysToNext100) : null;

  // Build combined timeline with future and past milestones
  type TimelineNode = {
    id: string;
    hours: number;
    date: Date | null;
    dateStr: string | null;
    average: string | null;
    description?: string | null;
    isFuture: boolean;
    isCurrent?: boolean;
    is10k?: boolean;
    is1k?: boolean;
  };

  const timelineNodes: TimelineNode[] = [];

  // Add 10k goal at top
  if (currentHours < 10000) {
    timelineNodes.push({
      id: 'goal-10k',
      hours: 10000,
      date: date10k,
      dateStr: null,
      average: null,
      isFuture: true,
      is10k: true,
    });
  }

  // Add next 1k milestone if not already achieved
  if (next1k > currentHours && next1k < 10000) {
    timelineNodes.push({
      id: `future-${next1k}`,
      hours: next1k,
      date: dateNext1k,
      dateStr: null,
      average: null,
      isFuture: true,
      is1k: true,
    });
  }

  // Add next 100h milestone if different from 1k
  if (next100 > currentHours && next100 !== next1k) {
    timelineNodes.push({
      id: `future-${next100}`,
      hours: next100,
      date: dateNext100,
      dateStr: null,
      average: null,
      isFuture: true,
    });
  }

  // Add current progress marker
  timelineNodes.push({
    id: 'current',
    hours: currentHours,
    date: today,
    dateStr: format(today, 'yyyy-MM-dd'),
    average: null,
    isFuture: false,
    isCurrent: true,
  });

  // Add achieved milestones
  milestones.forEach((m) => {
    if (m.achieved_at) {
      timelineNodes.push({
        id: `achieved-${m.id}`,
        hours: m.hours,
        date: new Date(m.achieved_at),
        dateStr: m.achieved_at,
        average: m.average_at_milestone ? formatAverage(m.average_at_milestone) : null,
        description: m.description,
        isFuture: false,
      });
    }
  });

  // Sort by hours descending
  timelineNodes.sort((a, b) => b.hours - a.hours);

  function formatAverage(avg: number): string {
    const totalSeconds = Math.round(avg * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m/day`;
    }
    return `${minutes}m/day`;
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'MMM d, yyyy');
  };

  return (
    <div className="px-4 py-6">
      {/* Timeline */}
      <div className="relative ml-[7px]">
        {/* Vertical Line */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: COLORS.line }}
        />

        {/* Timeline Nodes */}
        <div className="space-y-0">
          {timelineNodes.map((node) => {
            const getNodeColor = () => {
              if (node.isCurrent) return COLORS.green;
              if (node.is10k) return COLORS.purple;
              if (node.is1k) return COLORS.purple;
              if (node.isFuture) return COLORS.yellow;
              return COLORS.green;
            };

            const getNodeStyle = () => {
              if (node.isCurrent) {
                return { backgroundColor: COLORS.green };
              }
              if (node.isFuture) {
                return { 
                  backgroundColor: 'transparent',
                  border: `2px solid ${getNodeColor()}`,
                };
              }
              return { backgroundColor: COLORS.green };
            };

            return (
              <div 
                key={node.id} 
                className="relative flex items-start gap-4 py-3"
              >
                {/* Node Dot */}
                <div 
                  className="w-3 h-3 rounded-full -ml-[5px] mt-1 flex-shrink-0 relative z-10"
                  style={getNodeStyle()}
                />
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p 
                      className="font-medium"
                      style={{ 
                        color: node.isCurrent ? COLORS.green : 
                               node.isFuture ? (node.is10k ? COLORS.purple : node.is1k ? COLORS.purple : COLORS.yellow) : 
                               'inherit' 
                      }}
                    >
                      {node.hours.toLocaleString()} Hours
                      {node.isCurrent && <span className="ml-2 text-xs" style={{ color: COLORS.muted }}>← You are here</span>}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: COLORS.muted }}
                    >
                      {node.isFuture ? `Est. ${formatDate(node.date)}` : formatDate(node.date)}
                    </p>
                  </div>
                  {node.average && (
                    <p 
                      className="text-xs mt-0.5"
                      style={{ color: COLORS.muted }}
                    >
                      Avg: {node.average}
                    </p>
                  )}
                  {node.description && (
                    <p 
                      className="text-xs mt-0.5"
                      style={{ color: COLORS.muted }}
                    >
                      {node.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Node */}
        <div className="relative flex items-start gap-4 py-3 mt-2">
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
