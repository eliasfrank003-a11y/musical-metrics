import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COLORS = {
  muted: '#595A5F',
  white: '#FFFFFF',
  card: '#161616',
};

interface AverageInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAverage: number; // in hours
  totalHours: number;
  totalDays: number;
}

/**
 * Calculate how many minutes need to be played TODAY to increase
 * the lifetime daily average by a given number of seconds.
 * 
 * Formula:
 * currentAvg = totalHours / totalDays
 * newAvg = currentAvg + deltaSeconds/3600
 * neededTotalHours = newAvg * totalDays
 * additionalHours = neededTotalHours - totalHours
 * additionalMinutes = additionalHours * 60
 */
function minutesToIncreaseBy(totalHours: number, totalDays: number, deltaSeconds: number): number {
  const currentAvg = totalHours / totalDays;
  const targetAvg = currentAvg + deltaSeconds / 3600;
  const neededTotal = targetAvg * totalDays;
  const additionalHours = neededTotal - totalHours;
  const additionalMinutes = additionalHours * 60;
  return Math.max(0, Math.ceil(additionalMinutes));
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
      <DialogContent className="max-w-sm border-border/30" style={{ backgroundColor: '#0D0D0D' }}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Increase Daily Average</DialogTitle>
        </DialogHeader>
        <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
          Minutes you need to play today to increase your lifetime daily average:
        </p>
        <div className="space-y-2">
          {steps.map(({ seconds, label }) => {
            const mins = minutesToIncreaseBy(totalHours, totalDays, seconds);
            return (
              <div
                key={seconds}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: COLORS.card }}
              >
                <span className="text-sm" style={{ color: COLORS.muted }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: COLORS.white }}>
                  {mins} min
                </span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
