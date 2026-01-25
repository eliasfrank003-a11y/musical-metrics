import { useState, useRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableLayoutProps {
  centerView: ReactNode;
  rightView: ReactNode;
}

export function SwipeableLayout({ centerView, rightView }: SwipeableLayoutProps) {
  const [currentView, setCurrentView] = useState<'center' | 'right'>('center');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (touchDelta > 0 && currentView === 'right') setCurrentView('center');
      else if (touchDelta < 0 && currentView === 'center') setCurrentView('right');
    }
    setTouchStart(null);
    setTouchDelta(0);
    setIsSwiping(false);
  };

  const getTranslateX = () => {
    const base = currentView === 'center' ? 0 : -50;
    if (isSwiping && containerRef.current) {
      const delta = (touchDelta / containerRef.current.offsetWidth) * 50;
      return Math.max(-50, Math.min(0, base + delta));
    }
    return base;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex justify-center gap-8 py-4 border-b border-border/20">
        <button onClick={() => setCurrentView('center')} className={cn("text-sm font-medium transition-colors", currentView === 'center' ? "text-foreground" : "text-muted-foreground")}>Dashboard</button>
        <button onClick={() => setCurrentView('right')} className={cn("text-sm font-medium transition-colors", currentView === 'right' ? "text-foreground" : "text-muted-foreground")}>Repertoire</button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn("flex h-full", !isSwiping && "transition-transform duration-300")} style={{ width: '200%', transform: `translateX(${getTranslateX()}%)` }}>
          <div className="w-1/2 h-full overflow-y-auto">{centerView}</div>
          <div className="w-1/2 h-full overflow-y-auto">{rightView}</div>
        </div>
      </div>
      <div className="flex justify-center gap-2 py-3">
        <button onClick={() => setCurrentView('center')} className={cn("w-2 h-2 rounded-full", currentView === 'center' ? "bg-foreground" : "bg-muted-foreground/30")} />
        <button onClick={() => setCurrentView('right')} className={cn("w-2 h-2 rounded-full", currentView === 'right' ? "bg-foreground" : "bg-muted-foreground/30")} />
      </div>
    </div>
  );
}
