import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type MilestoneEntryType = 'interval' | 'custom';

export interface AddMilestonePayload {
  date: string;
  hours: number;
  milestoneType: MilestoneEntryType;
  description: string | null;
}

interface AddMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentHours: number;
  onCreate: (payload: AddMilestonePayload) => Promise<void> | void;
}

const getDefaultHours = (currentHours: number, type: MilestoneEntryType) => {
  if (type === 'interval') {
    const rounded = Math.floor(currentHours / 100) * 100;
    return Math.max(100, rounded || 100);
  }
  return Math.round(currentHours);
};

export function AddMilestoneDialog({ open, onOpenChange, currentHours, onCreate }: AddMilestoneDialogProps) {
  const [entryType, setEntryType] = useState<MilestoneEntryType>('custom');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const defaultDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (!open) return;
    const initialType: MilestoneEntryType = 'custom';
    setEntryType(initialType);
    setTitle('');
    setDescription('');
    setDate(defaultDate);
    setHours(String(getDefaultHours(currentHours, initialType)));
    setError(null);
  }, [open, currentHours, defaultDate]);

  useEffect(() => {
    if (!open) return;
    setHours(String(getDefaultHours(currentHours, entryType)));
  }, [entryType, currentHours, open]);

  const handleUseCurrentHours = () => {
    setHours(String(getDefaultHours(currentHours, entryType)));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!date) {
      setError('Pick a date.');
      return;
    }

    const hoursValue = Number(hours);
    if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
      setError('Enter a valid hour value.');
      return;
    }

    if (entryType === 'interval' && hoursValue % 100 !== 0) {
      setError('100h milestones must be a multiple of 100.');
      return;
    }

    if (entryType === 'custom' && title.trim().length === 0) {
      setError('Title is required for Other entries.');
      return;
    }

    const titleValue = title.trim();
    const descriptionValue = description.trim();
    const combinedLines = [titleValue, descriptionValue].filter(Boolean);
    const combinedDescription = combinedLines.length > 0 ? combinedLines.join('\n') : null;

    setIsSaving(true);
    try {
      await onCreate({
        date,
        hours: Math.round(hoursValue),
        milestoneType: entryType,
        description: combinedDescription,
      });
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to add milestone.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add milestone</DialogTitle>
          <DialogDescription>Log a milestone or a custom entry for the timeline.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Entry type</Label>
            <RadioGroup
              value={entryType}
              onValueChange={(value) => setEntryType(value as MilestoneEntryType)}
              className="grid gap-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="interval" />
                100h milestone
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="custom" />
                Other
              </label>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="milestone-title">Title</Label>
            <Input
              id="milestone-title"
              placeholder="Milestone title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="milestone-date">Date</Label>
            <Input
              id="milestone-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="milestone-hours">Total hours</Label>
            <div className="flex gap-2">
              <Input
                id="milestone-hours"
                type="number"
                min={1}
                step={1}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleUseCurrentHours}>
                {entryType === 'interval' ? 'Use current 100h' : 'Use current hours'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {entryType === 'interval'
                ? 'Must be a multiple of 100.'
                : 'Set the total hours for this entry.'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="milestone-description">Description</Label>
            <Textarea
              id="milestone-description"
              placeholder="Optional details"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/40"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-border/60 text-foreground hover:bg-muted/40"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Add milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
