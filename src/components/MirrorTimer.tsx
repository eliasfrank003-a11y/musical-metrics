import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MirrorTimerProps {
  onTimerStateChange?: (isRunning: boolean) => void;
  onNewSessionDetected?: () => void;
}

const COLORS = {
  muted: '#595A5F',
  red: '#FD4136',
  green: '#09C651',
};

export function MirrorTimer({ onTimerStateChange, onNewSessionDetected }: MirrorTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastSessionCount, setLastSessionCount] = useState<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Format elapsed time as HH:MM:SS or MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Format duration for toast (e.g., "45m 30s")
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  };

  // Get current session count from database
  const getSessionCount = useCallback(async (): Promise<number> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', today.toISOString());
    
    return count || 0;
  }, []);

  // Silent sync - doesn't show toast or trigger spinner
  const silentSync = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-calendar');
      if (error) return false;
      return (data?.synced || 0) > 0;
    } catch {
      return false;
    }
  }, []);

  // Start the timer
  const handleStart = useCallback(async () => {
    // Store initial session count to detect new sessions
    const count = await getSessionCount();
    setLastSessionCount(count);
    
    startTimeRef.current = new Date();
    setElapsedSeconds(0);
    setIsRunning(true);
    onTimerStateChange?.(true);
  }, [getSessionCount, onTimerStateChange]);

  // Stop/cancel the timer (long press)
  const handleCancel = useCallback(() => {
    setIsRunning(false);
    setElapsedSeconds(0);
    startTimeRef.current = null;
    setLastSessionCount(null);
    onTimerStateChange?.(false);
    toast({
      title: 'Timer cancelled',
      duration: 2000,
    });
  }, [onTimerStateChange, toast]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!isRunning) {
      handleStart();
    }
    // When running, taps do nothing - need long press to cancel
  }, [isRunning, handleStart]);

  // Long press handlers
  const handlePressStart = useCallback(() => {
    if (isRunning) {
      longPressTimeoutRef.current = setTimeout(() => {
        handleCancel();
      }, 500); // 500ms long press
    }
  }, [isRunning, handleCancel]);

  const handlePressEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  // Elapsed time counter
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Background sync polling (every 30 seconds while timer is running)
  useEffect(() => {
    if (!isRunning) return;

    const pollInterval = setInterval(async () => {
      // Silent sync
      const hasNewData = await silentSync();
      
      if (hasNewData && lastSessionCount !== null) {
        // Check if session count increased
        const newCount = await getSessionCount();
        
        if (newCount > lastSessionCount) {
          // New session detected! Stop timer and refresh
          setIsRunning(false);
          const finalElapsed = elapsedSeconds;
          setElapsedSeconds(0);
          startTimeRef.current = null;
          setLastSessionCount(null);
          onTimerStateChange?.(false);
          
          // Notify parent to refresh data
          onNewSessionDetected?.();
          
          toast({
            title: 'Practice session detected!',
            description: `Session synced from ATracker`,
            duration: 3000,
          });
        }
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(pollInterval);
  }, [isRunning, lastSessionCount, silentSync, getSessionCount, elapsedSeconds, onTimerStateChange, onNewSessionDetected, toast]);

  return (
    <div className="fixed bottom-24 right-4 z-50 flex items-center gap-3">
      {/* Elapsed time display */}
      {isRunning && (
        <div 
          className="px-3 py-1.5 rounded-full text-sm font-mono font-medium animate-pulse"
          style={{ 
            backgroundColor: 'rgba(253, 65, 54, 0.15)',
            color: COLORS.red,
          }}
        >
          {formatElapsedTime(elapsedSeconds)}
        </div>
      )}
      
      {/* Timer button */}
      <Button
        size="icon"
        className={cn(
          "w-14 h-14 rounded-full shadow-lg transition-all duration-200",
          isRunning && "animate-pulse"
        )}
        style={{
          backgroundColor: isRunning ? COLORS.red : COLORS.green,
        }}
        onClick={handleTap}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {isRunning ? (
          <Square className="w-6 h-6 text-white" fill="white" />
        ) : (
          <Play className="w-6 h-6 text-white ml-1" fill="white" />
        )}
      </Button>
    </div>
  );
}
