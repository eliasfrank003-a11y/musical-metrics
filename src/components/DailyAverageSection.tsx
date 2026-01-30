import { useState, useMemo, useCallback, useEffect } from 'react';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { IntradayChart } from '@/components/IntradayChart';
import { StatsFooter } from '@/components/StatsFooter';
import { calculateAnalytics, filterDataByRange, downsampleData, calculateDelta, calculateIntradayData, AnalyticsResult, DailyData, IntradayData } from '@/lib/practiceAnalytics';
import { PracticeSession } from '@/lib/csvParser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const APP_VERSION = 'v7';
type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';

interface DailyAverageSectionProps {
  onAnalyticsUpdate?: (analytics: AnalyticsResult | null) => void;
}

interface RawSession {
  started_at: string;
  duration_seconds: number;
}

export function DailyAverageSection({ onAnalyticsUpdate }: DailyAverageSectionProps) {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
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
        currentAverage={analytics.currentAverage}
        delta={delta.value}
        isPositive={delta.value >= 0}
        hoveredData={hoveredData}
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
          />
        ) : (
          <PracticeChart
            data={filteredData}
            timeRange={timeRange}
            onHover={setHoveredData}
          />
        )}
      </div>

      {/* Stats Footer */}
      <div className="mt-4">
        <StatsFooter
          totalHours={analytics.totalHours}
          totalDays={analytics.totalDays}
        />
      </div>
    </div>
  );
}
