import { useState, useMemo, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MetricDisplay } from '@/components/MetricDisplay';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { PracticeChart } from '@/components/PracticeChart';
import { StatsFooter } from '@/components/StatsFooter';
import { parseCSV } from '@/lib/csvParser';
import {
  calculateAnalytics,
  filterDataByRange,
  downsampleData,
  calculateDelta,
  AnalyticsResult,
} from '@/lib/practiceAnalytics';
import { useToast } from '@/hooks/use-toast';
import { Piano } from 'lucide-react';

const APP_VERSION = 'v2';

type TimeRange = '1W' | '1M' | '1Y' | 'ALL';

const Index = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {APP_VERSION}
            </span>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {!analytics ? (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Track Your Progress
              </h2>
              <p className="text-muted-foreground">
                Upload your practice data to see your lifetime daily average unfold like a stock chart.
              </p>
            </div>
            <FileUpload onFileLoad={handleFileLoad} isLoading={isLoading} />
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
              startDate={analytics.startDate}
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
