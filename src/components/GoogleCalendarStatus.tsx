import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Check, RefreshCw, AlertCircle, Link2, Link2Off } from 'lucide-react';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';

interface GoogleCalendarStatusProps {
  variant?: 'compact' | 'full';
  onSyncComplete?: () => void;
}

export function GoogleCalendarStatus({ variant = 'full', onSyncComplete }: GoogleCalendarStatusProps) {
  const { 
    syncState, 
    isConnected, 
    syncCalendar, 
    connectGoogle, 
    disconnectGoogle 
  } = useGoogleCalendarSync();

  const handleSync = async () => {
    const hasNewData = await syncCalendar(true);
    if (hasNewData && onSyncComplete) {
      onSyncComplete();
    }
  };

  // Compact variant for the header
  if (variant === 'compact') {
    if (!isConnected) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={connectGoogle}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">Connect Calendar</span>
        </Button>
      );
    }

    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSync}
        disabled={syncState.status === 'syncing' || syncState.status === 'checking'}
        className="relative"
      >
        <RefreshCw 
          className={`w-4 h-4 ${
            syncState.status === 'syncing' || syncState.status === 'checking' 
              ? 'animate-spin' 
              : ''
          }`} 
        />
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
          Automatically sync practice sessions from your ATracker calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Syncing from ATracker calendar
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Link2Off className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your Google account to sync calendar data
                  </p>
                </div>
              </>
            )}
          </div>
          
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={disconnectGoogle}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connectGoogle}>
              <Link2 className="w-4 h-4 mr-2" />
              Connect
            </Button>
          )}
        </div>

        {/* Sync Status */}
        {isConnected && (
          <div className="space-y-3">
            {/* Status Message */}
            {syncState.message && (
              <div className={`flex items-center gap-2 text-sm ${
                syncState.status === 'error' 
                  ? 'text-destructive' 
                  : 'text-muted-foreground'
              }`}>
                {syncState.status === 'error' && <AlertCircle className="w-4 h-4" />}
                {syncState.status === 'success' && <Check className="w-4 h-4 text-primary" />}
                {(syncState.status === 'syncing' || syncState.status === 'checking') && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                <span>{syncState.message}</span>
              </div>
            )}

            {/* Last Sync Info */}
            {syncState.lastSyncTime && (
              <p className="text-xs text-muted-foreground">
                Last synced: {syncState.lastSyncTime.toLocaleTimeString()}
              </p>
            )}

            {/* Manual Sync Button */}
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncState.status === 'syncing' || syncState.status === 'checking'}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${
                syncState.status === 'syncing' || syncState.status === 'checking' 
                  ? 'animate-spin' 
                  : ''
              }`} />
              {syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        )}

        {/* Help Text */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> The sync will automatically fetch new events from your 
            "ATracker" calendar that are newer than your latest practice session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
