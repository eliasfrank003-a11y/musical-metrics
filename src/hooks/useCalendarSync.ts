import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message: string;
  syncedCount: number;
}

interface SyncResult {
  synced: number;
  latestTimestamp: string | null;
  message: string;
  error?: string;
}

export function useCalendarSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    message: '',
    syncedCount: 0,
  });
  const { toast } = useToast();

  const syncCalendar = useCallback(async (showToast = true): Promise<boolean> => {
    setSyncState({ status: 'syncing', message: 'Syncing calendar...', syncedCount: 0 });

    // 30-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Sync timed out after 30 seconds')), 30000);
    });

    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke<SyncResult>('sync-calendar'),
        timeoutPromise,
      ]);

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const syncedCount = data?.synced || 0;
      
      setSyncState({
        status: 'success',
        message: data?.message || `Synced ${syncedCount} events`,
        syncedCount,
      });

      if (showToast) {
        toast({
          title: syncedCount > 0 ? 'Calendar synced!' : 'Already up to date',
          description: syncedCount > 0 
            ? `Added ${syncedCount} new practice sessions`
            : 'No new events found',
        });
      }

      return syncedCount > 0;
    } catch (error) {
      console.error('[useCalendarSync] Sync error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync calendar';
      
      setSyncState({
        status: 'error',
        message: errorMessage,
        syncedCount: 0,
      });

      if (showToast) {
        toast({
          title: 'Sync failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      return false;
    }
  }, [toast]);

  return {
    syncState,
    syncCalendar,
    isSyncing: syncState.status === 'syncing',
  };
}
