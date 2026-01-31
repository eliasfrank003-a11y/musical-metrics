import { useEffect } from 'react';
import { VerticalTimeline } from '@/components/dashboard/VerticalTimeline';
import { useMilestones } from '@/hooks/useMilestones';
import { AnalyticsResult } from '@/lib/practiceAnalytics';

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

  return (
    <div className="pb-8">
      {/* Unified Vertical Timeline with forecasts */}
      <VerticalTimeline
        milestones={milestones}
        currentHours={adjustedTotalHours}
        dailyAverage={analytics.currentAverage}
        startDate={analytics.startDate}
      />
    </div>
  );
}
