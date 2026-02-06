import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfDay } from 'date-fns';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { IntradayChart } from '@/components/IntradayChart';
import { AllTimeChart } from '@/components/AllTimeChart';
import { StatsFooter } from '@/components/StatsFooter';
import { calculateAnalytics, filterDataByRange, downsampleData, calculateDelta, calculateIntradayData, AnalyticsResult, DailyData, IntradayData } from '@/lib/practiceAnalytics';
import { PracticeSession } from '@/lib/csvParser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '@/lib/version';
type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL' | 'MAX';

interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
  description: string | null;
  milestone_type: string;
}

interface DailyAverageSectionProps {
  onAnalyticsUpdate?: (analytics: AnalyticsResult | null) => void;
  mirrorTimeSeconds?: number;
}

interface RawSession {
  started_at: string;
  duration_seconds: number;
}

export function DailyAverageSection({ onAnalyticsUpdate, mirrorTimeSeconds = 0 }: DailyAverageSectionProps) {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState<DailyData | null>(null);
  const [hoveredIntradayData, setHoveredIntradayData] = useState<IntradayData | null>(null);
  const { toast } = useToast();
  const { syncCalendar, isSyncing } = useCalendarSync();

  // Fetch all data from Supabase (paginated)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let data;

      do {
        const { data: pageData, error } = await supabase
          .from('practice_sessions')
          .select('*')
          .order('started_at', { ascending: true })
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        data = pageData;
        if (data && data.length > 0) {
          allData.push(...data);
        }
        from += pageSize;
      } while (data && data.length === pageSize);

      if (allData.length === 0) {
        setAnalytics(null);
        setRawSessions([]);
        onAnalyticsUpdate?.(null);
        return;
      }

      // Store raw sessions for intraday calculation
      setRawSessions(allData.map(row => ({
        started_at: row.started_at,
        duration_seconds: row.duration_seconds,
      })));

      const sessions: PracticeSession[] = allData.map(row => ({
        taskName: 'Practice',
        startTime: new Date(row.started_at),
        endTime: new Date(new Date(row.started_at).getTime() + row.duration_seconds * 1000),
        duration: '',
        durationInHours: row.duration_seconds / 3600,
      }));

      const result = calculateAnalytics(sessions);
      setAnalytics(result);
      onAnalyticsUpdate?.(result);
      
      // Also fetch milestones for the ALL view
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select('*')
        .order('hours', { ascending: true });

      const getCumulativeAt = (target: Date) => {
        const key = format(startOfDay(target), 'yyyy-MM-dd');
        const exact = result.dailyData.find(d => d.dateStr === key);
        if (exact) return exact.cumulativeHours;
        if (target < result.startDate) return 0;
        if (target > result.endDate) return result.totalHours;
        const fallback = [...result.dailyData].reverse().find(d => d.date <= target);
        return fallback ? fallback.cumulativeHours : 0;
      };

      const y1Date = new Date('2025-02-01T00:00:00');
      const y2Date = startOfDay(new Date());

      const syntheticMilestones: Milestone[] = [
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

      const combined = [...(milestonesData ?? []), ...syntheticMilestones]
        .sort((a, b) => a.hours - b.hours);

      setMilestones(combined as Milestone[]);
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, onAnalyticsUpdate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-sync calendar on mount
  useEffect(() => {
    let cancelled = false;
    const autoSync = async () => {
      try {
        const hasNewData = await syncCalendar(false);
        if (!cancelled && hasNewData) {
          await fetchData();
        }
      } catch (error) {
        console.error('[DailyAverageSection] Auto-sync error:', error);
      }
    };
    const timer = setTimeout(autoSync, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const { filteredData, delta, intradayData, baselineAverage, todayPlayTime, adjustedCurrentAverage, adjustedTotalHours, averageProgressPercent } = useMemo(() => {
    if (!analytics) {
      return { filteredData: [], delta: { value: 0, percentage: 0 }, intradayData: [], baselineAverage: 0, todayPlayTime: 0, adjustedCurrentAverage: 0, adjustedTotalHours: 0, averageProgressPercent: 0 };
    }
    
    // Convert mirror time to hours
    const mirrorTimeHours = mirrorTimeSeconds / 3600;
    
    // Adjusted total hours (includes mirror time)
    const adjustedTotal = analytics.totalHours + mirrorTimeHours;
    // Adjusted current average (includes mirror time distributed over total days)
    const adjustedAvg = analytics.currentAverage + (mirrorTimeHours / analytics.totalDays);
    
    // Calculate progress toward next second in the average
    // The display uses Math.round(), so we need to track when the rounded value changes
    // Total seconds with mirror time
    const totalSecondsWithMirror = (analytics.totalHours * 3600) + mirrorTimeSeconds;
    // Exact average in seconds (e.g., 5234.67)
    const exactAverageSeconds = totalSecondsWithMirror / analytics.totalDays;
    // Current displayed value (rounded)
    const displayedSeconds = Math.round(exactAverageSeconds);
    // The threshold where rounding changes is at X.5
    // Progress from (displayedSeconds - 0.5) to (displayedSeconds + 0.5)
    const lowerBound = displayedSeconds - 0.5;
    const upperBound = displayedSeconds + 0.5;
    // Progress within this 1-second window (0% at lower bound, 100% at upper bound)
    const progressPercent = ((exactAverageSeconds - lowerBound) / (upperBound - lowerBound)) * 100;
    
    // For 1D view, calculate intraday data with plateau-slope model
    if (timeRange === '1D') {
      const { intradayData: intraday, baselineAverage: baseline } = calculateIntradayData(analytics.dailyData, rawSessions);
      
      // Add mirror time to the current average for display
      const lastIntraday = intraday.length > 0 ? intraday[intraday.length - 1] : null;
      const currentAvg = lastIntraday ? lastIntraday.cumulativeAverage : analytics.currentAverage;
      const intradayAdjustedAvg = currentAvg + (mirrorTimeHours / analytics.totalDays);
      const intradayDelta = intradayAdjustedAvg - baseline;
      
      // Calculate today's total play time from raw sessions + mirror time
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySessions = rawSessions.filter(s => {
        const sessionDate = new Date(s.started_at);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === today.getTime();
      });
      const todayPlayTimeHours = todaySessions.reduce((sum, s) => sum + s.duration_seconds / 3600, 0) + mirrorTimeHours;
      
      // Add virtual point for mirror time if timer is running
      // Only update graph every minute (round mirror time down to full minutes)
      let augmentedIntraday = [...intraday];
      const mirrorMinutes = Math.floor(mirrorTimeSeconds / 60);
      if (mirrorMinutes > 0 && intraday.length > 0) {
        const now = new Date();
        const lastPoint = intraday[intraday.length - 1];
        // Only add if current time is after the last point
        if (now.getTime() > lastPoint.time.getTime()) {
          // Use floored minutes for smoother updates
          const mirrorHoursFloored = mirrorMinutes / 60;
          const avgWithMirror = lastPoint.cumulativeAverage + (mirrorHoursFloored / analytics.totalDays);
          const todayWithMirror = todaySessions.reduce((sum, s) => sum + s.duration_seconds / 3600, 0) + mirrorHoursFloored;
          augmentedIntraday.push({
            time: now,
            timeStr: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
            hourOfDay: now.getHours(),
            cumulativeAverage: avgWithMirror,
            hoursPlayedThisInterval: 0,
            cumulativeTodayHours: todayWithMirror,
            isCurrentHour: true,
          });
        }
      }
      
      return { 
        filteredData: [], 
        delta: { value: intradayDelta, percentage: 0 }, 
        intradayData: augmentedIntraday,
        baselineAverage: baseline,
        todayPlayTime: todayPlayTimeHours,
        adjustedCurrentAverage: intradayAdjustedAvg,
        adjustedTotalHours: adjustedTotal,
        averageProgressPercent: progressPercent
      };
    }
    
    let data = filterDataByRange(analytics.dailyData, timeRange === 'MAX' ? 'ALL' : timeRange, analytics.endDate);
    if (timeRange === '6M' || timeRange === '1Y' || timeRange === 'ALL' || timeRange === 'MAX') {
      data = downsampleData(data, 100);
    }
    
    // For 1W view, update the last data point to include mirror time
    let augmentedData = [...data];
    if (mirrorTimeHours > 0 && augmentedData.length > 0) {
      const lastPoint = augmentedData[augmentedData.length - 1];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastPointDate = new Date(lastPoint.date);
      lastPointDate.setHours(0, 0, 0, 0);
      
      // If the last point is today, update it with mirror time
      if (lastPointDate.getTime() === today.getTime()) {
        augmentedData[augmentedData.length - 1] = {
          ...lastPoint,
          hoursPlayed: lastPoint.hoursPlayed + mirrorTimeHours,
          cumulativeHours: lastPoint.cumulativeHours + mirrorTimeHours,
          cumulativeAverage: (lastPoint.cumulativeHours + mirrorTimeHours) / lastPoint.dayNumber,
        };
      }
    }
    
    const baseDelta = calculateDelta(augmentedData);
    // Add mirror time contribution to the delta (for views where today might not be visible)
    const adjustedDelta = {
      value: baseDelta.value,
      percentage: baseDelta.percentage
    };
    return { 
      filteredData: augmentedData, 
      delta: adjustedDelta, 
      intradayData: [], 
      baselineAverage: 0, 
      todayPlayTime: 0,
      adjustedCurrentAverage: adjustedAvg,
      adjustedTotalHours: adjustedTotal,
      averageProgressPercent: progressPercent
    };
  }, [analytics, timeRange, rawSessions, mirrorTimeSeconds]);

  const handleManualSync = async () => {
    try {
      const hasNewData = await syncCalendar(false);
      if (hasNewData) {
        await fetchData();
        toast({
          title: 'Synced',
          description: 'New sessions added',
          duration: 2000,
        });
      } else {
        toast({
          title: 'Already up to date',
          duration: 2000,
        });
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-muted-foreground">No practice data available</p>
        <Link to="/settings">
          <Button variant="ghost" className="mt-4">
            <Settings className="w-4 h-4 mr-2" />
            Go to Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-2 pb-6">
      {/* Metric Display */}
      <MetricDisplay
        currentAverage={adjustedCurrentAverage}
        delta={delta.value}
        isPositive={delta.value >= 0}
        hoveredData={hoveredData}
        hoveredIntradayData={hoveredIntradayData}
        baselineAverage={baselineAverage}
        isIntradayView={timeRange === '1D'}
        todayPlayTime={todayPlayTime}
        mirrorTimeSeconds={mirrorTimeSeconds}
        averageProgressPercent={averageProgressPercent}
      />

      {/* Time Range Selector */}
      <div className="mt-4">
        <TimeRangeSelector selectedRange={timeRange} onRangeChange={setTimeRange} />
      </div>

      {/* Practice Chart */}
      <div className="mt-4">
        {timeRange === '1D' ? (
          <IntradayChart
            data={intradayData}
            baselineAverage={baselineAverage}
            onHover={setHoveredIntradayData}
            isMirrorActive={mirrorTimeSeconds > 0}
          />
        ) : timeRange === 'ALL' ? (
          <AllTimeChart
            data={filteredData}
            milestones={milestones}
            onHover={setHoveredData}
          />
        ) : (
          <PracticeChart
            data={filteredData}
            timeRange={timeRange === 'MAX' ? 'ALL' : timeRange}
            onHover={setHoveredData}
          />
        )}
      </div>

      {/* Stats Footer */}
      <div className="mt-4">
        <StatsFooter
          totalHours={adjustedTotalHours}
          totalDays={analytics.totalDays}
          currentAverage={adjustedCurrentAverage}
        />
      </div>
    </div>
  );
}
