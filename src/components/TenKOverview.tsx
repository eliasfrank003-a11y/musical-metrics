import { useEffect, useMemo } from 'react';
import { VerticalTimeline } from '@/components/dashboard/VerticalTimeline';
import { useMilestones } from '@/hooks/useMilestones';
import { AnalyticsResult } from '@/lib/practiceAnalytics';
import { format, startOfDay } from 'date-fns';

interface TenKOverviewProps {
  analytics: AnalyticsResult | null;
  mirrorTimeSeconds?: number;
}

export function TenKOverview({ analytics, mirrorTimeSeconds = 0 }: TenKOverviewProps) {
  const { milestones, checkAndCreateMilestones } = useMilestones();

  // Check for new 100h milestones when analytics loads
  useEffect(() => {
    if (analytics && analytics.totalHours >= 100) {
      checkAndCreateMilestones(analytics.totalHours, analytics.currentAverage);
    }
  }, [analytics?.totalHours, analytics?.currentAverage, checkAndCreateMilestones]);

  const timelineMilestones = useMemo(() => {
    if (!analytics) return milestones;

    const getCumulativeAt = (target: Date) => {
      const key = format(startOfDay(target), 'yyyy-MM-dd');
      const exact = analytics.dailyData.find(d => d.dateStr === key);
      if (exact) return exact.cumulativeHours;
      if (target < analytics.startDate) return 0;
      if (target > analytics.endDate) return analytics.totalHours;
      const fallback = [...analytics.dailyData].reverse().find(d => d.date <= target);
      return fallback ? fallback.cumulativeHours : 0;
    };

    const y1Date = new Date('2025-02-01T00:00:00');
    const y2Date = startOfDay(new Date());

    const synthetic = [
      {
        id: -1001,
        hours: Math.round(getCumulativeAt(y1Date)),
        achieved_at: y1Date.toISOString(),
        average_at_milestone: null,
        description: 'Y1',
        milestone_type: 'custom',
      },
      {
        id: -1002,
        hours: Math.round(getCumulativeAt(y2Date)),
        achieved_at: y2Date.toISOString(),
        average_at_milestone: null,
        description: 'Y2',
        milestone_type: 'custom',
      },
    ];

    return [...milestones, ...synthetic].sort((a, b) => a.hours - b.hours);
  }, [analytics, milestones]);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  // Add mirror time to total hours for display
  const mirrorTimeHours = mirrorTimeSeconds / 3600;
  const adjustedTotalHours = analytics.totalHours + mirrorTimeHours;
  const averageBump = analytics.totalDays > 0 ? mirrorTimeHours / analytics.totalDays : 0;
  const adjustedDailyAverage = analytics.currentAverage + averageBump;

  return (
    <div className="pb-8">
      {/* Unified Vertical Timeline with forecasts */}
      <VerticalTimeline
        milestones={timelineMilestones}
        currentHours={adjustedTotalHours}
        dailyAverage={adjustedDailyAverage}
        startDate={analytics.startDate}
      />
    </div>
  );
}
