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

  // Add achieved milestones
  milestones.forEach((m) => {
    if (m.achieved_at) {
      const isCustom = m.milestone_type === 'custom';
      let customTitle = `${m.hours.toLocaleString()} Hours`;
      
      if (isCustom) {
        // Direct mapping for known custom milestones
        const customTitles: Record<number, string> = {
          447: '→ Florence',
          250: 'Florence →',
          530: 'Ibu Septi →',
          641: '→ Ibu Septi',
        };
        
        if (customTitles[m.hours]) {
          customTitle = customTitles[m.hours];
        } else if (m.description) {
          const lines = m.description.split('\n').map(l => l.trim()).filter(l => l);
          const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{2}\/\d{2}\/\d{2}$/.test(s);
          const locations = ['Maastricht', 'Rungan Sari', 'Florence'];
          const equipment = ['Roland FP-30X', 'Kawai RX1', 'Kawai CA901'];
          
          const nameLine = lines.find(l => !isDate(l) && !locations.includes(l) && !equipment.includes(l));
          
          if (nameLine) {
            if (nameLine.toLowerCase().includes('splitting')) {
              customTitle = 'Split Time';
            } else if (nameLine.toLowerCase().includes('v1')) {
              customTitle = 'Piano v1';
            } else if (nameLine === 'Didier') {
              customTitle = 'Didier →';
            } else {
              customTitle = nameLine;
            }
          }
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

  function formatTimeRemaining(date: Date | null): string {
    if (!date) return '—';
    const years = differenceInYears(date, today);
    const months = differenceInMonths(date, today) % 12;
    
    if (years > 0 && months > 0) {
      return `${years}y ${months}m`;
    } else if (years > 0) {
      return `${years}y`;
    } else if (months > 0) {
      return `${months}m`;
    } else {
      const days = differenceInDays(date, today);
      return `${days}d`;
    }
  }

  function formatTotalTime(targetDate: Date | null): string {
    if (!targetDate) return '—';
    // Total time = time from startDate to targetDate
    const years = differenceInYears(targetDate, startDate);
    const months = differenceInMonths(targetDate, startDate) % 12;
    
    if (years > 0 && months > 0) {
      return `${years}y ${months}m`;
    } else if (years > 0) {
      return `${years}y`;
    } else if (months > 0) {
      return `${months}m`;
    } else {
      const days = differenceInDays(targetDate, startDate);
      return `${days}d`;
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'MMM d, yyyy');
  };

  // Find where achieved nodes start and end (future nodes are first due to descending sort)
  const firstAchievedIndex = timelineNodes.findIndex(node => !node.isFuture);
  const hasAchievedNodes = firstAchievedIndex !== -1;

  // Progress percentage towards 10k
  const progressPercentage = Math.min(100, (currentHours / 10000) * 100);
  
  // Calculate color from red (0%) to green (100%)
  // Red: #FD4136, Green: #09C651
  const getProgressColor = (percentage: number) => {
    const red = { r: 253, g: 65, b: 54 };
    const green = { r: 9, g: 198, b: 81 };
    const ratio = percentage / 100;
    const r = Math.round(red.r + (green.r - red.r) * ratio);
    const g = Math.round(red.g + (green.g - red.g) * ratio);
    const b = Math.round(red.b + (green.b - red.b) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="px-4 py-6">
      {/* Progress Bar */}
      <div className="mb-6">
        <div 
          className="relative w-full h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(89, 90, 95, 0.3)' }}
        >
          <div 
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${progressPercentage}%`,
              backgroundColor: getProgressColor(progressPercentage),
            }}
          />
          {/* 10% divider lines - rendered on top of progress fill */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((percent) => (
            <div
              key={percent}
              className="absolute top-0 h-full w-px z-10"
              style={{ 
                left: `${percent}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
              }}
            />
          ))}
          <span 
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold z-20"
            style={{ color: COLORS.muted }}
          >
            {progressPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative ml-[7px]">
        {/* Single continuous vertical line - starts at first milestone dot and ends at last */}
        <div 
          className="absolute left-0 w-0.5"
          style={{ 
            backgroundColor: COLORS.line,
            top: '2.75rem',
            bottom: '2.5rem',
          }}
        />

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
                return { 
                  backgroundColor: COLORS.muted,
                };
              }
              if (node.isStart) {
                return { 
                  backgroundColor: COLORS.muted,
                };
              }
              return { backgroundColor: COLORS.muted };
            };

            const getNodeSize = () => {
              if (node.isStart) return 'w-2 h-2 -ml-[3px]';
              return 'w-3 h-3 -ml-[5px]';
            };

            const getTitleColor = () => {
              if (node.isCurrent) return COLORS.green;
              if (node.isFuture) {
                if (node.is10k || node.is1k) return COLORS.purple;
                // NEXT GOAL uses white color
                return '#FFFFFF';
              }
              if (node.isStart) return COLORS.muted;
              return 'inherit';
            };

            const getRightContent = () => {
              if (node.isFuture) {
                const daysRemaining = node.id === 'goal-10k' ? daysTo10k : 
                                      node.hours === next1k ? daysToNext1k : 
                                      daysToNext100;
                return daysRemaining !== Infinity ? String(daysRemaining) : '—';
              }
              if (node.isCurrent) {
                return '';
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
                <div className={`relative flex gap-4 ${node.isFuture ? 'items-center py-2' : 'items-start py-3'}`}>
                  {/* Node Dot */}
                  <div 
                    className={`${getNodeSize()} rounded-full ${node.isFuture ? '' : 'mt-1'} flex-shrink-0 relative z-10`}
                    style={getNodeStyle()}
                  />
                  
                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${node.isFuture ? 'px-4 py-3 rounded-xl flex items-center' : ''}`} style={node.isFuture ? { backgroundColor: 'rgba(89, 90, 95, 0.15)', border: `1px solid rgba(89, 90, 95, 0.3)` } : {}}>
                    <div className={`flex ${node.isFuture ? 'items-center w-full' : 'items-baseline'} justify-between gap-4`}>
                      <div className="flex-1">
                        {node.isFuture && (
                          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: node.is10k ? COLORS.muted : node.is1k ? COLORS.purple : COLORS.yellow, marginBottom: '4px' }}>
                            {node.is10k ? 'ESTIMATED FINISH' : node.is1k ? 'NEXT 1K' : 'Next 100h'}
                          </p>
                        )}
                        {node.is10k ? (
                          node.date && (
                            <p 
                              className="text-sm font-medium"
                              style={{ color: '#FFFFFF' }}
                            >
                              {formatDate(node.date)}
                            </p>
                          )
                        ) : node.isCustom && node.description ? (
                          <button
                            onClick={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}
                            className={`text-left hover:opacity-80 transition-opacity ${node.isFuture ? 'text-xl font-bold' : 'font-medium'}`}
                            style={{ color: getTitleColor() }}
                          >
                            {node.title}
                          </button>
                        ) : (
                          <p 
                            className={node.isFuture ? 'text-xl font-bold leading-none' : 'font-medium'}
                            style={{ color: node.is1k ? '#FFFFFF' : getTitleColor() }}
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
                      <div className={`${node.isFuture ? 'flex flex-col items-end justify-center' : 'text-right flex-shrink-0'}`}>
                        {node.isFuture ? (
                          node.is10k ? (
                            <>
                              <p 
                                className="text-[10px] font-medium uppercase tracking-wide"
                                style={{ color: COLORS.muted }}
                              >
                                TOTAL {formatTotalTime(node.date)} • REMAINING {formatTimeRemaining(node.date)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p 
                                className="text-2xl font-bold leading-none"
                                style={{ color: node.is1k ? COLORS.purple : COLORS.yellow }}
                              >
                                {getRightContent()}
                              </p>
                              {node.date && (
                                <p 
                                  className="text-[10px] mt-1 uppercase tracking-wide"
                                  style={{ color: COLORS.muted }}
                                >
                                  {formatDate(node.date)}
                                </p>
                              )}
                            </>
                          )
                        ) : (
                          <p 
                            className="text-xs"
                            style={{ color: node.isCurrent ? COLORS.green : COLORS.muted }}
                          >
                            {getRightContent()}
                          </p>
                        )}
                      </div>
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
