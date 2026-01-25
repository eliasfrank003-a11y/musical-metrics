import { SwipeableLayout } from '@/components/SwipeableLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Repertoire } from '@/pages/Repertoire';
import { useDataSeeding } from '@/hooks/useDataSeeding';

// Placeholder for seed data - you'll provide the actual values in the next prompt
const MILESTONE_SEED_DATA: { hours: number; achieved_at: string | null; average_at_milestone: number | null }[] = [];
const REPERTOIRE_SEED_DATA: { type: 'piece' | 'divider'; title: string; composer?: string; status?: 'grey' | 'green' | 'red' }[] = [];

export function Home() {
  // Initialize seeding (runs once if tables are empty)
  useDataSeeding({
    milestoneSeedData: MILESTONE_SEED_DATA,
    repertoireSeedData: REPERTOIRE_SEED_DATA,
  });

  return (
    <SwipeableLayout
      centerView={<Dashboard />}
      rightView={<Repertoire />}
    />
  );
}
