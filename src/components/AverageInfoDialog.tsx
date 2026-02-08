import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AverageInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAverage: number; // in hours
  totalHours: number;
  totalDays: number;
}

/**
 * Calculate how many seconds need to be played TODAY to increase
 * the lifetime daily average by a given number of seconds.
 * 
 * Formula:
 * currentAvg = totalHours / totalDays
 * newAvg = currentAvg + deltaSeconds/3600
 * neededTotalHours = newAvg * totalDays
 * additionalHours = neededTotalHours - totalHours
 * additionalSeconds = additionalHours * 3600
 */
function secondsToIncreaseBy(totalHours: number, totalDays: number, deltaSeconds: number): number {
  const currentAvg = totalHours / totalDays;
  const targetAvg = currentAvg + deltaSeconds / 3600;
  const neededTotal = targetAvg * totalDays;
  const additionalHours = neededTotal - totalHours;
  const additionalSeconds = additionalHours * 3600;
  return Math.max(0, Math.ceil(additionalSeconds));
}

function formatMinutesAndSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} sec`;
}

export function AverageInfoDialog({ open, onOpenChange, currentAverage, totalHours, totalDays }: AverageInfoDialogProps) {
  const steps = [
    { seconds: 1, label: '+1 second' },
    { seconds: 3, label: '+3 seconds' },
    { seconds: 5, label: '+5 seconds' },
    { seconds: 10, label: '+10 seconds' },
    { seconds: 20, label: '+20 seconds' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border/30 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Increase Daily Average</DialogTitle>
        </DialogHeader>
        <p className="text-xs mb-4 text-muted-foreground">
          Minutes you need to play today to increase your lifetime daily average:
        </p>
        <div className="space-y-2">
          {steps.map(({ seconds, label }) => {
            const totalSeconds = secondsToIncreaseBy(totalHours, totalDays, seconds);
            return (
              <div
                key={seconds}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatMinutesAndSeconds(totalSeconds)}
                </span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
