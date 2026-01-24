import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useCalendarSync } from '@/hooks/useCalendarSync';

interface CalendarSyncStatusProps {
  variant?: 'compact' | 'full';
  onSyncComplete?: () => void;
}

export function CalendarSyncStatus({ variant = 'full', onSyncComplete }: CalendarSyncStatusProps) {
  const { syncState, syncCalendar, isSyncing } = useCalendarSync();

  const handleSync = async () => {
    const hasNewData = await syncCalendar(true);
    if (hasNewData && onSyncComplete) {
      onSyncComplete();
    }
  };

  // Compact variant for the header
  if (variant === 'compact') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSync}
        disabled={isSyncing}
        className="relative"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {syncState.status === 'success' && syncState.syncedCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
            {syncState.syncedCount > 9 ? '9+' : syncState.syncedCount}
          </span>
        )}
      </Button>
    );
  }

  // Full variant for settings page
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Google Calendar Sync
        </CardTitle>
        <CardDescription>
          Sync practice sessions from your ATracker calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {syncState.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-primary" />
              ) : syncState.status === 'error' ? (
                <XCircle className="w-5 h-5 text-destructive" />
              ) : (
                <Calendar className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isSyncing 
                  ? 'Syncing...' 
                  : syncState.status === 'success' 
                    ? 'Ready to sync'
                    : syncState.status === 'error'
                      ? 'Sync failed'
                      : 'Calendar Sync'}
              </p>
              <p className="text-xs text-muted-foreground">
                {syncState.message || 'Click to sync new events from your calendar'}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {/* Help Text */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> The sync will automatically fetch new events from your 
            ATracker calendar that are newer than your latest practice session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
