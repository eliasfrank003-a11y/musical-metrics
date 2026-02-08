import { cn } from '@/lib/utils';

type Status = 'grey' | 'green' | 'red';

interface StatusDotProps {
  status: Status;
  onClick: () => void;
  disabled?: boolean;
}

const STATUS_COLORS: Record<Status, string> = {
  grey: 'hsl(var(--muted-foreground))',
  green: 'hsl(var(--chart-positive))',
  red: 'hsl(var(--chart-negative))',
};

export function StatusDot({ status, onClick, disabled }: StatusDotProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-4 h-4 rounded-full transition-all flex-shrink-0",
        "hover:scale-110 active:scale-95",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{ backgroundColor: STATUS_COLORS[status] }}
      aria-label={`Status: ${status}. Click to change.`}
    />
  );
}

export function getNextStatus(current: Status): Status {
  const cycle: Status[] = ['grey', 'green', 'red'];
  const currentIndex = cycle.indexOf(current);
  return cycle[(currentIndex + 1) % cycle.length];
}
