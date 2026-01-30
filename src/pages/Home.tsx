import { useState, useCallback } from 'react';
import { SwipeableLayout } from '@/components/SwipeableLayout';
import { DailyAverageSection } from '@/components/DailyAverageSection';
import { TenKOverview } from '@/components/TenKOverview';
import { Repertoire } from '@/pages/Repertoire';
import { useDataSeeding } from '@/hooks/useDataSeeding';
import { AnalyticsResult } from '@/lib/practiceAnalytics';

// Placeholder for seed data - you'll provide the actual values in the next prompt
const MILESTONE_SEED_DATA: { hours: number; achieved_at: string | null; average_at_milestone: number | null }[] = [];
const REPERTOIRE_SEED_DATA: { type: 'piece' | 'divider'; title: string; composer?: string; status?: 'grey' | 'green' | 'red' }[] = [];

export function Home() {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRepertoireEditing, setIsRepertoireEditing] = useState(false);

  // Initialize seeding (runs once if tables are empty)
  useDataSeeding({
    milestoneSeedData: MILESTONE_SEED_DATA,
    repertoireSeedData: REPERTOIRE_SEED_DATA,
  });

  const handleSync = useCallback(async () => {
    // Trigger a refresh of the DailyAverageSection by updating the key
    setRefreshKey(prev => prev + 1);
  }, []);

  // Time view content
  const timeView = (
    <>
      <DailyAverageSection key={refreshKey} onAnalyticsUpdate={setAnalytics} />
      <TenKOverview analytics={analytics} />
    </>
  );

  return (
    <SwipeableLayout
      leftView={timeView}
      rightView={<Repertoire onEditingStateChange={setIsRepertoireEditing} />}
      onSync={handleSync}
      isSwipeDisabled={isRepertoireEditing}
    />
  );
}
