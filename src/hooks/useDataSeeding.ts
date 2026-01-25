import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
}

export interface RepertoireItem {
  id: number;
  type: 'piece' | 'divider';
  title: string;
  composer: string | null;
  status: 'grey' | 'green' | 'red';
  sort_order: number;
}

// Seed data structures - you'll provide actual values
export interface MilestoneSeed {
  hours: number;
  achieved_at: string | null; // ISO date string
  average_at_milestone: number | null;
}

export interface RepertoireItemSeed {
  type: 'piece' | 'divider';
  title: string;
  composer?: string;
  status?: 'grey' | 'green' | 'red';
}

interface UseDataSeedingOptions {
  milestoneSeedData?: MilestoneSeed[];
  repertoireSeedData?: RepertoireItemSeed[];
}

export function useDataSeeding(options: UseDataSeedingOptions = {}) {
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);

  const seedData = useCallback(async () => {
    if (hasSeeded || isSeeding) return;
    
    const { milestoneSeedData = [], repertoireSeedData = [] } = options;
    
    if (milestoneSeedData.length === 0 && repertoireSeedData.length === 0) {
      console.log('[Seeding] No seed data provided');
      return;
    }

    setIsSeeding(true);

    try {
      // Check if milestones table is empty
      if (milestoneSeedData.length > 0) {
        const { count: milestoneCount } = await supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true });

        if (milestoneCount === 0) {
          console.log('[Seeding] Seeding milestones...');
          const { error } = await supabase
            .from('milestones')
            .insert(milestoneSeedData);
          
          if (error) throw error;
          console.log(`[Seeding] Inserted ${milestoneSeedData.length} milestones`);
        } else {
          console.log('[Seeding] Milestones already populated');
        }
      }

      // Check if repertoire table is empty
      if (repertoireSeedData.length > 0) {
        const { count: repertoireCount } = await supabase
          .from('repertoire_items')
          .select('*', { count: 'exact', head: true });

        if (repertoireCount === 0) {
          console.log('[Seeding] Seeding repertoire...');
          const itemsWithOrder = repertoireSeedData.map((item, idx) => ({
            type: item.type,
            title: item.title,
            composer: item.composer || null,
            status: item.status || 'grey',
            sort_order: idx,
          }));

          const { error } = await supabase
            .from('repertoire_items')
            .insert(itemsWithOrder);
          
          if (error) throw error;
          console.log(`[Seeding] Inserted ${repertoireSeedData.length} repertoire items`);
        } else {
          console.log('[Seeding] Repertoire already populated');
        }
      }

      setHasSeeded(true);
    } catch (error) {
      console.error('[Seeding] Error:', error);
    } finally {
      setIsSeeding(false);
    }
  }, [options, hasSeeded, isSeeding]);

  useEffect(() => {
    seedData();
  }, [seedData]);

  return { isSeeding, hasSeeded };
}
