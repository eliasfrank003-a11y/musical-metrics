import { useState } from 'react';
import { format, addDays, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';

interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
  description?: string | null;
  milestone_type?: string | null;
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
  line: '#2A2A2A',
};

export function VerticalTimeline({ milestones, currentHours, dailyAverage, startDate }: VerticalTimelineProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const today = new Date();
  
  // Calculate future milestones
  const hoursTo10k = Math.max(0, 10000 - currentHours);
  const daysTo10k = dailyAverage > 0 ? Math.ceil(hoursTo10k / dailyAverage) : Infinity;
  const date10k = dailyAverage > 0 ? addDays(today, daysTo10k) : null;
  
  const next1k = Math.ceil(currentHours / 1000) * 1000;
  const hoursToNext1k = next1k - currentHours;
  const daysToNext1k = dailyAverage > 0 ? Math.ceil(hoursToNext1k / dailyAverage) : Infinity;
  const dateNext1k = dailyAverage > 0 ? addDays(today, daysToNext1k) : null;
  
  const next100 = Math.ceil(currentHours / 100) * 100;
  const hoursToNext100 = next100 - currentHours;
  const daysToNext100 = dailyAverage > 0 ? Math.ceil(hoursToNext100 / dailyAverage) : Infinity;
  const dateNext100 = dailyAverage > 0 ? addDays(today, daysToNext100) : null;

  type TimelineNode = {
    id: string;
    hours: number;
    title: string;
    date: Date | null;
    average: string | null;
    description?: string | null;
    isFuture: boolean;
    isCurrent?: boolean;
    is10k?: boolean;
    is1k?: boolean;
    isCustom?: boolean;
    isStart?: boolean;
  };

  const timelineNodes: TimelineNode[] = [];

  // Add 10k goal at top
  if (currentHours < 10000) {
    timelineNodes.push({
      id: 'goal-10k',
      hours: 10000,
      title: '10,000 Hours',
      date: date10k,
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
      title: `${next1k.toLocaleString()} Hours`,
      date: dateNext1k,
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
      title: `${next100.toLocaleString()} Hours`,
      date: dateNext100,
      average: null,
      isFuture: true,
    });
  }

  // Add current progress marker
  timelineNodes.push({
    id: 'current',
    hours: currentHours,
    title: `${Math.floor(currentHours).toLocaleString()} Hours`,
    date: today,
    average: null,
    isFuture: false,
    isCurrent: true,
  });

  // Add achieved milestones
  milestones.forEach((m) => {
    if (m.achieved_at) {
      const isCustom = m.milestone_type === 'custom';
      let customTitle = `${m.hours.toLocaleString()} Hours`;
      
      if (isCustom && m.description) {
        const lines = m.description.split('\n').map(l => l.trim()).filter(l => l);
        // Skip date line if present
        const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{2}\/\d{2}\/\d{2}$/.test(s);
        const locations = ['Maastricht', 'Rungan Sari', 'Florence'];
        const equipment = ['Roland FP-30X', 'Kawai RX1', 'Kawai CA901'];
        
        // Find the "name" line - not a date, not a location, not equipment
        const nameLine = lines.find(l => !isDate(l) && !locations.includes(l) && !equipment.includes(l));
        
        if (nameLine) {
          if (nameLine.toLowerCase().includes('splitting')) {
            customTitle = 'Split Time';
          } else if (nameLine.toLowerCase().includes('v1')) {
            customTitle = 'Piano v1';
          } else {
            // It's a teacher/person name
            customTitle = nameLine;
          }
        }
        
        // Special handling for Florence location-based milestones
        if (lines.includes('Florence')) {
          if (m.hours === 250) {
            customTitle = 'Florence →';
          } else if (m.hours === 447) {
            customTitle = '→ Florence';
          }
        }
        
        // Special handling for teacher milestones
        if (nameLine === 'Ibu Septi') {
          if (m.hours === 530) {
            customTitle = 'Ibu Septi →';
          } else if (m.hours === 641) {
            customTitle = '→ Ibu Septi';
          }
        }
        
        if (nameLine === 'Didier') {
          customTitle = 'Didier →';
        }
      }
      
      timelineNodes.push({
        id: `achieved-${m.id}`,
        hours: m.hours,
        title: isCustom ? customTitle : `${m.hours.toLocaleString()} Hours`,
        date: new Date(m.achieved_at),
        average: m.average_at_milestone ? formatAverage(m.average_at_milestone) : null,
        description: m.description,
        isFuture: false,
        isCustom,
      });
    }
  });

  // Add journey start
  timelineNodes.push({
    id: 'start',
    hours: 0,
    title: 'Journey Started',
    date: startDate,
    average: null,
    isFuture: false,
    isStart: true,
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

  function formatTimeAgo(date: Date): string {
    const days = differenceInDays(today, date);
    return `${days} days ago`;
  }

  function formatTimeSinceStart(date: Date): string {
    const years = differenceInYears(today, date);
    const months = differenceInMonths(today, date) % 12;
    
    if (years > 0 && months > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'MMM d, yyyy');
  };

  return (
    <div className="px-4 py-6">
      <div className="relative ml-[7px]">
        {/* Timeline Nodes */}
        <div className="space-y-0">
          {timelineNodes.map((node, index) => {
            const isFirst = index === 0;
            const isLast = index === timelineNodes.length - 1;
            const getNodeStyle = () => {
              if (node.isCurrent) {
                return { backgroundColor: COLORS.green };
              }
              if (node.isFuture) {
                const color = node.is10k || node.is1k ? COLORS.purple : COLORS.yellow;
                return { 
                  backgroundColor: 'transparent',
                  border: `2px solid ${color}`,
                };
              }
              if (node.isStart) {
                return { 
                  backgroundColor: COLORS.muted,
                };
              }
              return { backgroundColor: COLORS.green };
            };

            const getNodeSize = () => {
              if (node.isStart) return 'w-2 h-2 -ml-[3px]';
              return 'w-3 h-3 -ml-[5px]';
            };

            const getTitleColor = () => {
              if (node.isCurrent) return COLORS.green;
              if (node.isFuture) return node.is10k || node.is1k ? COLORS.purple : COLORS.yellow;
              if (node.isStart) return COLORS.muted;
              return 'inherit';
            };

            const getRightContent = () => {
              if (node.isFuture) {
                return `Est. ${formatDate(node.date)}`;
              }
              if (node.isCurrent) {
                return '← You are here';
              }
              if (node.isStart && node.date) {
                return formatTimeSinceStart(node.date);
              }
              if (node.isCustom) {
                return `${node.hours} h`;
              }
              return node.average || '';
            };

            return (
              <div key={node.id} className="relative">
                {/* Vertical line segment - don't show above first or below last */}
                {!isFirst && (
                  <div 
                    className="absolute left-0 w-0.5 -top-3 h-3"
                    style={{ backgroundColor: COLORS.line }}
                  />
                )}
                {!isLast && (
                  <div 
                    className="absolute left-0 w-0.5 top-4 bottom-0 h-[calc(100%-1rem)]"
                    style={{ backgroundColor: COLORS.line }}
                  />
                )}
                
                <div className="relative flex items-start gap-4 py-3">
                  {/* Node Dot */}
                  <div 
                    className={`${getNodeSize()} rounded-full mt-1 flex-shrink-0 relative z-10`}
                    style={getNodeStyle()}
                  />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        {node.isCustom && node.description ? (
                          <button
                            onClick={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}
                            className="font-medium text-left hover:opacity-80 transition-opacity"
                            style={{ color: getTitleColor() }}
                          >
                            {node.title}
                          </button>
                        ) : (
                          <p 
                            className="font-medium"
                            style={{ color: getTitleColor() }}
                          >
                            {node.title}
                          </p>
                        )}
                        {!node.isFuture && !node.isCurrent && node.date && (
                          <p 
                            className="text-xs mt-0.5"
                            style={{ color: COLORS.muted }}
                          >
                            {node.isStart ? formatDate(node.date) : formatTimeAgo(node.date)}
                          </p>
                        )}
                      </div>
                      <p 
                        className="text-xs text-right flex-shrink-0"
                        style={{ color: node.isCurrent ? COLORS.green : COLORS.muted }}
                      >
                        {getRightContent()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description block for custom milestones - only show when expanded */}
                {node.description && expandedNodeId === node.id && (
                  <div 
                    className="ml-[19px] pl-4 py-2 border-l"
                    style={{ borderColor: COLORS.line }}
                  >
                    {node.description.split('\n').map((line, i) => (
                      <p 
                        key={i}
                        className="text-xs"
                        style={{ color: COLORS.muted }}
                      >
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
