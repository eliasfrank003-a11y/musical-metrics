import { useState, useMemo, useCallback, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { IntradayChart } from '@/components/IntradayChart';
import { StatsFooter } from '@/components/StatsFooter';
import { parseCSV, PracticeSession } from '@/lib/csvParser';
import { calculateAnalytics, filterDataByRange, downsampleData, calculateDelta, calculateIntradayData, AnalyticsResult, DailyData, IntradayData } from '@/lib/practiceAnalytics';
import { useToast } from '@/hooks/use-toast';
import { Piano, Settings, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarSync } from '@/hooks/useCalendarSync';

const APP_VERSION = 'v7';
type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';

interface RawSession {
  started_at: string;
  duration_seconds: number;
}

const Index = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState<DailyData | null>(null);
  const [hoveredIntradayData, setHoveredIntradayData] = useState<IntradayData | null>(null);
  const { toast } = useToast();
  const { syncState, syncCalendar, isSyncing } = useCalendarSync();

  // Fetch all data from Supabase (paginated to avoid 1000 row limit)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allData: typeof data = [];
      let from = 0;
      const pageSize = 1000;
      let data;

      // Paginate through all results
      do {
        const {
          data: pageData,
          error
        } = await supabase.from('practice_sessions').select('*').order('started_at', {
          ascending: true
        }).range(from, from + pageSize - 1);
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
      console.log(`[Dashboard] Loaded ${allData.length} sessions from database`);

      // Store raw sessions for intraday calculation
      setRawSessions(allData.map(row => ({
        started_at: row.started_at,
        duration_seconds: row.duration_seconds,
      })));

      // Convert Supabase data to PracticeSession format
      const sessions: PracticeSession[] = allData.map(row => ({
        taskName: 'Practice',
        startTime: new Date(row.started_at),
        endTime: new Date(new Date(row.started_at).getTime() + row.duration_seconds * 1000),
        duration: '',
        durationInHours: row.duration_seconds / 3600
      }));
      const result = calculateAnalytics(sessions);
      setAnalytics(result);
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load data on mount and after calendar sync
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-sync calendar on page load (silent, once)
  useEffect(() => {
    let cancelled = false;
    const autoSync = async () => {
      try {
        const hasNewData = await syncCalendar(false); // Silent sync
        if (!cancelled && hasNewData) {
          await fetchData();
        }
      } catch (error) {
        console.error('[Index] Auto-sync error:', error);
      }
    };

    // Small delay to let page settle
    const timer = setTimeout(autoSync, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []); // Only run once on mount

  const handleFileLoad = useCallback((content: string) => {
    setIsLoading(true);
    try {
      const sessions = parseCSV(content);
      if (sessions.length === 0) {
        throw new Error('No valid practice sessions found in the file');
      }
      const result = calculateAnalytics(sessions);
      setAnalytics(result);
      setTimeRange('ALL');
      toast({
        title: 'Data loaded successfully',
        description: `Found ${sessions.length} practice sessions spanning ${result.totalDays} days`
      });
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  const {
    filteredData,
    delta,
    intradayData,
    baselineAverage
  } = useMemo(() => {
    if (!analytics) {
      return {
        filteredData: [],
        delta: { value: 0, percentage: 0 },
        intradayData: [],
        baselineAverage: 0
      };
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

    // Downsample for smoother visualization on longer timeframes
    if (timeRange === '6M' || timeRange === '1Y' || timeRange === 'ALL') {
      data = downsampleData(data, 100);
    }
    const delta = calculateDelta(data);
    return {
      filteredData: data,
      delta,
      intradayData: [],
      baselineAverage: 0
    };
  }, [analytics, timeRange, rawSessions]);
  const handleManualSync = async () => {
    try {
      const hasNewData = await syncCalendar(false); // Silent sync, we'll show our own toast
      if (hasNewData) {
        await fetchData();
        toast({
          title: `${syncState.syncedCount || 'New'} session${syncState.syncedCount !== 1 ? 's' : ''} synced`,
          description: 'Added to your practice history',
          duration: 2000,
        });
      } else {
        toast({
          title: 'Already up to date',
          description: 'No new sessions found',
          duration: 2000,
        });
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col items-end mb-8">
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="font-mono" style={{ color: '#595A5F' }}>
              {APP_VERSION}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="-mt-1 disabled:opacity-100 text-inherit hover:text-inherit active:text-inherit focus-visible:text-inherit"
            style={{ color: isSyncing ? '#FFFFFF' : '#595A5F' }}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Metric Display */}
            <MetricDisplay
              currentAverage={analytics.currentAverage}
              delta={delta.value}
              isPositive={delta.value >= 0}
              hoveredData={hoveredData}
            />

            {/* Time Range Selector */}
            <TimeRangeSelector selectedRange={timeRange} onRangeChange={setTimeRange} />

            {/* Chart */}
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

            {/* Footer Stats */}
            <StatsFooter
              totalHours={analytics.totalHours}
              totalDays={analytics.totalDays}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <Piano className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Practice Data</h2>
            <p className="text-muted-foreground mb-4">
              Connect your Google Calendar or import data in Settings
            </p>
            <Link to="/settings">
              <Button>
                <Settings className="w-4 h-4 mr-2" />
                Go to Settings
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;