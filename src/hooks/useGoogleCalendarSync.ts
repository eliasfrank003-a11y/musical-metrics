import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncState {
  status: 'idle' | 'checking' | 'syncing' | 'success' | 'error' | 'not_connected';
  message: string;
  syncedCount: number;
  lastSyncTime: Date | null;
}

interface SyncResult {
  synced: number;
  latestTimestamp: string | null;
  message: string;
  error?: string;
}

export function useGoogleCalendarSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    message: '',
    syncedCount: 0,
    lastSyncTime: null,
  });
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Check if user is connected to Google
  const checkConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsConnected(false);
        setSyncState(prev => ({ ...prev, status: 'not_connected' }));
        return false;
      }

      // Check if we have a Google provider token
      const providerToken = session.provider_token;
      if (providerToken) {
        setIsConnected(true);
        return true;
      }

      setIsConnected(false);
      setSyncState(prev => ({ ...prev, status: 'not_connected' }));
      return false;
    } catch (error) {
      console.error('[useGoogleCalendarSync] Error checking connection:', error);
      setIsConnected(false);
      return false;
    }
  }, []);

  // Sync calendar data
  const syncCalendar = useCallback(async (showToast = true): Promise<boolean> => {
    setSyncState(prev => ({ ...prev, status: 'checking', message: 'Checking Google connection...' }));

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Sync timed out after 30 seconds')), 30000);
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.provider_token) {
        setSyncState({
          status: 'not_connected',
          message: 'Not connected to Google Calendar',
          syncedCount: 0,
          lastSyncTime: null,
        });
        return false;
      }

      setSyncState(prev => ({ ...prev, status: 'syncing', message: 'Fetching calendar events...' }));

      // Race between sync and timeout
      const { data, error } = await Promise.race([
        supabase.functions.invoke<SyncResult>('sync-google-calendar', {
          body: {
            accessToken: session.provider_token,
            calendarId: 'ATracker', // Will be searched for by name
          },
        }),
        timeoutPromise,
      ]);

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const syncedCount = data?.synced || 0;
      
      setSyncState({
        status: 'success',
        message: data?.message || `Synced ${syncedCount} events`,
        syncedCount,
        lastSyncTime: new Date(),
      });

      if (showToast && syncedCount > 0) {
        toast({
          title: 'Calendar synced!',
          description: `Added ${syncedCount} new practice sessions from Google Calendar`,
        });
      }

      return syncedCount > 0;
    } catch (error) {
      console.error('[useGoogleCalendarSync] Sync error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync calendar';
      
      setSyncState({
        status: 'error',
        message: errorMessage,
        syncedCount: 0,
        lastSyncTime: null,
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

  // Connect to Google (sign in with Google OAuth)
  const connectGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('[useGoogleCalendarSync] Connect error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Google',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Disconnect from Google (sign out)
  const disconnectGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      setIsConnected(false);
      setSyncState({
        status: 'not_connected',
        message: '',
        syncedCount: 0,
        lastSyncTime: null,
      });

      toast({
        title: 'Disconnected',
        description: 'Google Calendar has been disconnected',
      });
    } catch (error) {
      console.error('[useGoogleCalendarSync] Disconnect error:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from Google',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useGoogleCalendarSync] Auth state changed:', event);
      
      if (session?.provider_token) {
        setIsConnected(true);
        // Auto-sync on successful login
        if (event === 'SIGNED_IN') {
          await syncCalendar(true);
        }
      } else {
        setIsConnected(false);
        setSyncState(prev => ({ ...prev, status: 'not_connected' }));
      }
    });

    // Initial check
    checkConnection();

    return () => {
      subscription.unsubscribe();
    };
  }, [checkConnection, syncCalendar]);

  return {
    syncState,
    isConnected,
    syncCalendar,
    connectGoogle,
    disconnectGoogle,
    checkConnection,
  };
}
