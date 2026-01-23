import { useState, useMemo, useCallback, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { StatsFooter } from '@/components/StatsFooter';
import { parseCSV, PracticeSession } from '@/lib/csvParser';
import {
  calculateAnalytics,
  filterDataByRange,
  downsampleData,
  calculateDelta,
  AnalyticsResult,
} from '@/lib/practiceAnalytics';
import { useToast } from '@/hooks/use-toast';
import { Piano, Settings, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const APP_VERSION = 'v4';

type TimeRange = '1W' | '1M' | '1Y' | 'ALL';

const Index = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
        return;
      }

      console.log(`[Dashboard] Loaded ${allData.length} sessions from database`);

      // Convert Supabase data to PracticeSession format
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

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        description: `Found ${sessions.length} practice sessions spanning ${result.totalDays} days`,
      });
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const { filteredData, delta } = useMemo(() => {
    if (!analytics) {
      return { filteredData: [], delta: { value: 0, percentage: 0 } };
    }

    let data = filterDataByRange(analytics.dailyData, timeRange, analytics.endDate);
    
    // Downsample for smoother visualization on longer timeframes
    if (timeRange === '1Y' || timeRange === 'ALL') {
      data = downsampleData(data, 100);
    }
    
    const delta = calculateDelta(data);
    
    return { filteredData: data, delta };
  }, [analytics, timeRange]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Piano className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Practice Tracker</h1>
                <p className="text-xs text-muted-foreground">Your musical journey, visualized</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                {APP_VERSION}
              </span>
              <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/settings">
                  <Settings className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !analytics ? (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                No Practice Data Yet
              </h2>
              <p className="text-muted-foreground">
                Go to Settings to import your practice data from a CSV file.
              </p>
            </div>
            <div className="flex justify-center">
              <Button asChild>
                <Link to="/settings">Go to Settings</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Metric */}
            <MetricDisplay
              currentAverage={analytics.currentAverage}
              delta={delta.value}
              isPositive={delta.value >= 0}
            />

            {/* Time Range Selector */}
            <TimeRangeSelector
              selectedRange={timeRange}
              onRangeChange={setTimeRange}
            />

            {/* Chart */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <PracticeChart data={filteredData} timeRange={timeRange} />
            </div>

            {/* Stats Footer */}
            <StatsFooter
              totalHours={analytics.totalHours}
              totalDays={analytics.totalDays}
            />

            {/* Reset Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setAnalytics(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Upload different file
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
