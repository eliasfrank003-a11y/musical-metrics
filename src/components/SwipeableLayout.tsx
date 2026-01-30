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
}

export function SwipeableLayout({ leftView, rightView, onSync }: SwipeableLayoutProps) {
  const [currentView, setCurrentView] = useState<'left' | 'right'>('left');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { syncCalendar, isSyncing } = useCalendarSync();
  const { toast } = useToast();

  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > SWIPE_THRESHOLD) {
      if (touchDelta > 0 && currentView === 'right') setCurrentView('left');
      else if (touchDelta < 0 && currentView === 'left') setCurrentView('right');
    }
    setTouchStart(null);
    setTouchDelta(0);
    setIsSwiping(false);
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
            onClick={handleManualSync}
            disabled={isSyncing}
            className="disabled:opacity-100"
            style={{ color: isSyncing ? '#FFFFFF' : '#595A5F' }}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="font-mono" style={{ color: '#595A5F' }}>
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
          <div className="w-1/2">{leftView}</div>
          <div className="w-1/2">{rightView}</div>
        </div>
      </div>
    </div>
  );
}
