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

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, isLoading, refetch: fetchMilestones };
}
