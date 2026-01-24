import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Check, RefreshCw, AlertCircle, Link2, Link2Off, User } from 'lucide-react';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { useAuth } from '@/hooks/useAuth';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

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
  
  const { user } = useAuth();
  
  // Determine if synced (success status or idle with lastSyncTime)
  const isSynced = syncState.status === 'success' || (syncState.status === 'idle' && syncState.lastSyncTime);
  const isSyncing = syncState.status === 'syncing' || syncState.status === 'checking';

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
        {/* Google Account Status */}
        {user ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {user.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{user.user_metadata?.full_name || 'Google Account'}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnectGoogle}>
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Not Signed In</p>
                <p className="text-xs text-muted-foreground">
                  Sign in with Google to sync calendar data
                </p>
              </div>
            </div>
            <GoogleSignInButton className="h-9" />
          </div>
        )}

        {/* Sync Status with Visual Indicator */}
        {user && isConnected && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              {/* Sync Status Indicator */}
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${
                  isSyncing ? 'bg-primary animate-pulse' :
                  isSynced ? 'bg-green-500' : 
                  syncState.status === 'error' ? 'bg-destructive' :
                  'bg-amber-500'
                }`} />
                {isSynced && !isSyncing && (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isSyncing ? 'Syncing...' :
                   isSynced ? 'Up to date' :
                   syncState.status === 'error' ? 'Sync failed' :
                   'Not synced'}
                </p>
                {syncState.lastSyncTime && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {syncState.lastSyncTime.toLocaleString()}
                  </p>
                )}
                {syncState.status === 'error' && syncState.message && (
                  <p className="text-xs text-destructive">{syncState.message}</p>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing' : 'Sync Now'}
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
