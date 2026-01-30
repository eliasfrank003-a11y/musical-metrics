import { useState, useRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useToast } from '@/hooks/use-toast';
import { APP_VERSION } from '@/lib/version';

interface SwipeableLayoutProps {
  leftView: ReactNode;
  rightView: ReactNode;
  onSync?: () => Promise<void>;
  isSwipeDisabled?: boolean;
}

export function SwipeableLayout({ leftView, rightView, onSync, isSwipeDisabled }: SwipeableLayoutProps) {
  const [currentView, setCurrentView] = useState<'left' | 'right'>('left');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { syncCalendar, isSyncing } = useCalendarSync();
  const { toast } = useToast();

  const SWIPE_THRESHOLD = 50;
  const SCROLL_THRESHOLD = 10; // Detect vertical scroll after 10px of vertical movement

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSwipeDisabled) return;
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setIsScrolling(false);
    setIsSwiping(true);
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
            onClick={() => !isSwipeDisabled && setCurrentView('left')} 
            className={cn(
              "text-xl font-semibold transition-colors",
              currentView === 'left' ? "text-foreground" : "text-muted-foreground",
              isSwipeDisabled && "opacity-50 cursor-not-allowed"
            )} 
          >
            Time
          </button>
          <button 
            onClick={() => !isSwipeDisabled && setCurrentView('right')} 
            className={cn(
              "text-xl font-semibold transition-colors",
              currentView === 'right' ? "text-foreground" : "text-muted-foreground",
              isSwipeDisabled && "opacity-50 cursor-not-allowed"
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
