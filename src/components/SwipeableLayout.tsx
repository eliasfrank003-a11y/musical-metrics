import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useToast } from '@/hooks/use-toast';
import { APP_VERSION } from '@/lib/version';
import { supabase } from '@/integrations/supabase/client';

interface SwipeableLayoutProps {
  leftView: ReactNode;
  rightView: ReactNode;
  onSync?: () => Promise<void>;
  onMirrorTimeChange?: (seconds: number) => void;
  isSwipeDisabled?: boolean;
}

export function SwipeableLayout({ leftView, rightView, onSync, onMirrorTimeChange, isSwipeDisabled }: SwipeableLayoutProps) {
  const [currentView, setCurrentView] = useState<'left' | 'right'>('left');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [initialSessionCount, setInitialSessionCount] = useState<number | null>(null);
  const timerStartRef = useRef<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { syncCalendar, isSyncing } = useCalendarSync();
  const { toast } = useToast();

  // Silent sync - doesn't show UI feedback
  const silentSync = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-calendar');
      if (error) return false;
      return (data?.synced || 0) > 0;
    } catch {
      return false;
    }
  }, []);

  // Get today's session count
  const getSessionCount = useCallback(async (): Promise<number> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', today.toISOString());
    return count || 0;
  }, []);

  // Format timer: seconds (0:SS) -> minutes (Xm) -> hours (H:MM)
  const formatTimer = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      // Hour+ : show H:MM
      return `${h}:${m.toString().padStart(2, '0')}`;
    } else if (m > 0) {
      // 1-59 minutes: show Xm
      return `${m}m`;
    } else {
      // Under 1 minute: show 0:SS
      return `0:${s.toString().padStart(2, '0')}`;
    }
  };

  // Timer counter effect - notify parent of mirror time changes
  useEffect(() => {
    if (!isTimerRunning) {
      onMirrorTimeChange?.(0);
      return;
    }
    
    const interval = setInterval(() => {
      if (timerStartRef.current) {
        const elapsed = Math.floor((new Date().getTime() - timerStartRef.current.getTime()) / 1000);
        setTimerSeconds(elapsed);
        onMirrorTimeChange?.(elapsed);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTimerRunning, onMirrorTimeChange]);

  // Periodic silent sync every 30 seconds while timer is running
  useEffect(() => {
    if (!isTimerRunning || initialSessionCount === null) return;

    const pollInterval = setInterval(async () => {
      const hasNewData = await silentSync();
      
      if (hasNewData) {
        // Check if session count increased
        const newCount = await getSessionCount();
        
        if (newCount > initialSessionCount) {
          // New session detected! Stop timer and refresh
          setIsTimerRunning(false);
          setTimerSeconds(0);
          timerStartRef.current = null;
          setInitialSessionCount(null);
          onMirrorTimeChange?.(0);
          
          // Notify parent to refresh data
          await onSync?.();
          
          toast({
            title: 'Practice session synced!',
            description: 'New session detected from calendar',
            duration: 3000,
          });
        }
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(pollInterval);
  }, [isTimerRunning, initialSessionCount, silentSync, getSessionCount, onSync, onMirrorTimeChange, toast]);

  const handleTimerToggle = async () => {
    if (isTimerRunning) {
      // Stop timer
      setIsTimerRunning(false);
      setTimerSeconds(0);
      timerStartRef.current = null;
      setInitialSessionCount(null);
      onMirrorTimeChange?.(0);
    } else {
      // Start timer - record initial session count
      const count = await getSessionCount();
      setInitialSessionCount(count);
      timerStartRef.current = new Date();
      setTimerSeconds(0);
      setIsTimerRunning(true);
    }
  };

  const SWIPE_THRESHOLD = 50;
  const SCROLL_THRESHOLD = 10; // Detect vertical scroll after 10px of vertical movement

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      'button, a, input, textarea, select, [role="button"], [role="link"], [data-swipe-ignore]'
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSwipeDisabled) return;
    if (isInteractiveTarget(e.target)) return;
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setIsScrolling(false);
    setIsSwiping(true);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null || isSwipeDisabled) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStart.x;
    const deltaY = currentY - touchStart.y;

    // Determine if user is scrolling vertically
    if (Math.abs(deltaY) > SCROLL_THRESHOLD) {
      setIsScrolling(true);
      return;
    }

    // Only allow horizontal swipe if not scrolling vertically
    if (!isScrolling) {
      setTouchDelta(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isScrolling && Math.abs(touchDelta) > SWIPE_THRESHOLD) {
      if (touchDelta > 0 && currentView === 'right') setCurrentView('left');
      else if (touchDelta < 0 && currentView === 'left') setCurrentView('right');
    }
    setTouchStart(null);
    setTouchDelta(0);
    setIsSwiping(false);
    setIsScrolling(false);
  };

  const getTranslateX = () => {
    const base = currentView === 'left' ? 0 : -50;
    if (isSwiping && containerRef.current) {
      const delta = (touchDelta / containerRef.current.offsetWidth) * 50;
      return Math.max(-50, Math.min(0, base + delta));
    }
    return base;
  };

  const handleManualSync = async () => {
    try {
      const hasNewData = await syncCalendar(false);
      if (hasNewData) {
        await onSync?.();
        toast({
          title: 'Synced',
          description: 'New sessions added',
          duration: 2000,
        });
      } else {
        toast({
          title: 'Already up to date',
          duration: 2000,
        });
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-background">
      {/* Top Header with Tabs and Controls */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        {/* Tab Selectors - Trade Republic style */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('left')} 
            className={cn(
              "text-xl font-semibold transition-colors",
              currentView === 'left' ? "text-foreground" : "text-muted-foreground"
            )} 
          >
            Time
          </button>
          <button 
            onClick={() => setCurrentView('right')} 
            className={cn(
              "text-xl font-semibold transition-colors",
              currentView === 'right' ? "text-foreground" : "text-muted-foreground"
            )} 
          >
            Repertoire
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTimerToggle}
            className="hover:bg-transparent hover:text-foreground focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none text-muted-foreground"
          >
            {isTimerRunning ? (
              <span className="font-mono text-sm">{formatTimer(timerSeconds)}</span>
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className={cn(
              "hover:bg-transparent hover:text-foreground focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none",
              isSyncing ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/settings">
            <Button 
              variant="ghost" 
              size="sm" 
              className="font-mono text-muted-foreground hover:bg-transparent hover:text-foreground focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none"
            >
              {APP_VERSION}
            </Button>
          </Link>
        </div>
      </div>

      {/* Swipeable Content Section */}
      <div 
        ref={containerRef} 
        className="overflow-hidden" 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className={cn(
            "flex",
            !isSwiping && "transition-transform duration-300"
          )} 
          style={{ width: '200%', transform: `translateX(${getTranslateX()}%)` }}
        >
          <div className="w-1/2 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
              <span className="shooting-star" />
              <span className="shooting-star shooting-star--delayed" />
            </div>
            {leftView}
          </div>
          <div className="w-1/2">{rightView}</div>
        </div>
      </div>
    </div>
  );
}
