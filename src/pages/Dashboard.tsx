import { useState, useMemo, useCallback, useEffect } from 'react';
import { VerticalTimeline } from '@/components/dashboard/VerticalTimeline';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { IntradayChart } from '@/components/IntradayChart';
import { StatsFooter } from '@/components/StatsFooter';
import { parseCSV, PracticeSession } from '@/lib/csvParser';
import { calculateAnalytics, filterDataByRange, downsampleData, calculateDelta, calculateIntradayData, AnalyticsResult, DailyData, IntradayData } from '@/lib/practiceAnalytics';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMilestones } from '@/hooks/useMilestones';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '@/lib/version';
type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL' | 'MAX';

interface RawSession {
  started_at: string;
  duration_seconds: number;
}

export function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState<DailyData | null>(null);
  const [hoveredIntradayData, setHoveredIntradayData] = useState<IntradayData | null>(null);
  const { toast } = useToast();
  const { milestones, isLoading: milestonesLoading } = useMilestones();
  const { syncState, syncCalendar, isSyncing } = useCalendarSync();

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
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
        console.error('[Dashboard] Auto-sync error:', error);
      }
    };
    const timer = setTimeout(autoSync, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const { filteredData, delta, intradayData, baselineAverage } = useMemo(() => {
    if (!analytics) {
      return { filteredData: [], delta: { value: 0, percentage: 0 }, intradayData: [], baselineAverage: 0 };
    }
    
    // For 1D view, calculate intraday data with plateau-slope model
    if (timeRange === '1D') {
      const { intradayData: intraday, baselineAverage: baseline } = calculateIntradayData(analytics.dailyData, rawSessions);
      // Delta is the difference between current average and yesterday's baseline
      const currentAvg = intraday.length > 0 ? intraday[intraday.length - 1].cumulativeAverage : analytics.currentAverage;
      const intradayDelta = currentAvg - baseline;
      return { 
        filteredData: [], 
        delta: { value: intradayDelta, percentage: 0 }, 
        intradayData: intraday,
        baselineAverage: baseline
      };
    }
    
    let data = filterDataByRange(analytics.dailyData, timeRange, analytics.endDate);
    if (timeRange === '6M' || timeRange === '1Y' || timeRange === 'ALL') {
      data = downsampleData(data, 100);
    }
    const delta = calculateDelta(data);
    return { filteredData: data, delta, intradayData: [], baselineAverage: 0 };
  }, [analytics, timeRange, rawSessions]);

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

  return (
    <div className="min-h-full bg-background">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="flex justify-end items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="disabled:opacity-100"
            style={{ color: isSyncing ? '#FFFFFF' : '#595A5F' }}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="font-mono" style={{ color: '#595A5F' }}>
              {APP_VERSION}
            </Button>
          </Link>
        </div>

        {analytics ? (
          <div className="space-y-8">
            {/* Unified Vertical Timeline */}
            <VerticalTimeline
              milestones={timelineMilestones}
              currentHours={analytics.totalHours}
              dailyAverage={analytics.currentAverage}
              startDate={analytics.startDate}
            />

            {/* Original Dashboard Section */}
            <div className="pt-4 border-t border-border/30">
              <MetricDisplay
                currentAverage={analytics.currentAverage}
                delta={delta.value}
                isPositive={delta.value >= 0}
                hoveredData={hoveredData}
              />
              <div className="mt-4">
                <TimeRangeSelector selectedRange={timeRange} onRangeChange={setTimeRange} />
              </div>
              <div className="mt-4">
                {timeRange === '1D' ? (
                  <IntradayChart
                    data={intradayData}
                    baselineAverage={baselineAverage}
                    onHover={setHoveredIntradayData}
                  />
                ) : (
                  <PracticeChart
                    data={filteredData}
                    timeRange={timeRange}
                    onHover={setHoveredData}
                  />
                )}
              </div>
              <div className="mt-4">
                <StatsFooter
                  totalHours={analytics.totalHours}
                  totalDays={analytics.totalDays}
                  currentAverage={analytics.currentAverage}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No practice data available</p>
            <Link to="/settings">
              <Button variant="ghost" className="mt-4">
                <Settings className="w-4 h-4 mr-2" />
                Go to Settings
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
