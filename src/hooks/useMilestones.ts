import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Milestone {
  id: number;
  hours: number;
  achieved_at: string | null;
  average_at_milestone: number | null;
  description: string | null;
  milestone_type: string | null;
}

export function useMilestones() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMilestones = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('hours', { ascending: false });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('[Milestones] Error fetching:', error);
      toast({
        title: 'Error loading milestones',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Check and create any missing 100h milestones up to the current total hours
  const checkAndCreateMilestones = useCallback(async (totalHours: number, currentAverage: number) => {
    if (totalHours < 100) return;
    
    try {
      // Get all existing milestone hours
      const { data: existingMilestones, error: fetchError } = await supabase
        .from('milestones')
        .select('hours');
      
      if (fetchError) throw fetchError;
      
      const existingHours = new Set((existingMilestones || []).map(m => m.hours));
      
      // Find all 100h intervals that should exist
      const maxMilestone = Math.floor(totalHours / 100) * 100;
      const milestonesToCreate: number[] = [];
      
      for (let h = 100; h <= maxMilestone; h += 100) {
        if (!existingHours.has(h)) {
          milestonesToCreate.push(h);
        }
      }
      
      if (milestonesToCreate.length === 0) return;
      
      // Create missing milestones
      // For past milestones, we can't know the exact date/average, so we'll estimate
      // But for the most recent one (if just hit), we use current values
      const now = new Date().toISOString();
      
      for (const hours of milestonesToCreate) {
        // Check if this is a newly achieved milestone (within last 100h)
        const isNewlyAchieved = totalHours >= hours && totalHours < hours + 100;
        
        const { error: insertError } = await supabase
          .from('milestones')
          .insert({
            hours,
            achieved_at: now, // We use current date as we don't know exact date for past ones
            average_at_milestone: isNewlyAchieved ? currentAverage : null,
            milestone_type: 'interval',
          });
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('[Milestones] Error creating milestone:', insertError);
        }
      }
      
      // Refresh the list
      await fetchMilestones();
      
      // Show toast for newly achieved milestone
      const newestMilestone = Math.max(...milestonesToCreate);
      if (totalHours >= newestMilestone && totalHours < newestMilestone + 5) {
        toast({
          title: `🎉 ${newestMilestone} Hours Milestone!`,
          description: `Congratulations! You've reached ${newestMilestone} hours of practice!`,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('[Milestones] Error checking milestones:', error);
    }
  }, [fetchMilestones, toast]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, isLoading, refetch: fetchMilestones, checkAndCreateMilestones };
}
