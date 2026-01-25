import { ForecastSection } from '@/components/dashboard/ForecastSection';
import { VerticalTimeline } from '@/components/dashboard/VerticalTimeline';
import { useMilestones } from '@/hooks/useMilestones';
import { AnalyticsResult } from '@/lib/practiceAnalytics';

interface TenKOverviewProps {
  analytics: AnalyticsResult | null;
}

export function TenKOverview({ analytics }: TenKOverviewProps) {
  const { milestones } = useMilestones();

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Forecast Cards */}
      <ForecastSection
        totalHours={analytics.totalHours}
        dailyAverage={analytics.currentAverage}
      />

      {/* Vertical Timeline */}
      <VerticalTimeline
        milestones={milestones}
        currentHours={analytics.totalHours}
        startDate={analytics.startDate}
      />
    </div>
  );
}
