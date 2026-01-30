import { useState } from 'react';
import { StatusDot, getNextStatus } from './StatusDot';
import { Trash2, Edit2, Check, X, GripVertical, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, differenceInWeeks } from 'date-fns';

type ItemStatus = 'grey' | 'green' | 'red';

export interface RepertoireItemData {
  id: number;
  type: 'piece' | 'divider';
  title: string;
  started_at: string | null;
  divider_label: string | null;
  status: ItemStatus;
  sort_order: number;
}

interface RepertoireItemProps {
  item: RepertoireItemData;
  onStatusChange: (id: number, newStatus: ItemStatus) => void;
  onEdit: (id: number, title: string, started_at: string | null, divider_label: string | null) => void;
  onDelete: (id: number) => void;
  isUpdating?: boolean;
  isEditMode?: boolean;
  onDragStart?: (e: React.DragEvent, id: number) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: number) => void;
  isDragging?: boolean;
}

const COLORS = {
  muted: '#595A5F',
  card: '#161616',
  divider: '#2A2A2A',
};

function formatStartedAt(startedAt: string | null): string | null {
  if (!startedAt) return null;
  
  const startDate = new Date(startedAt);
  const now = new Date();
  
  // Format date as DD.MM.YYYY
  const day = startDate.getDate().toString().padStart(2, '0');
  const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
  const year = startDate.getFullYear();
  const formattedDate = `${day}.${month}.${year}`;
  
  // Calculate weeks difference
  const diffWeeks = differenceInWeeks(now, startDate);
  
  const weekText = diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  
  return `${formattedDate} · ${weekText}`;
}

export function RepertoireItem({
  item,
  onStatusChange,
  onEdit,
  onDelete,
  isUpdating,
  isEditMode = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: RepertoireItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editStartedAt, setEditStartedAt] = useState<Date | undefined>(
    item.started_at ? new Date(item.started_at) : undefined
  );
  const [editDividerLabel, setEditDividerLabel] = useState(item.divider_label || '');

  const handleStatusClick = () => {
    const newStatus = getNextStatus(item.status);
    onStatusChange(item.id, newStatus);
  };

  const handleSaveEdit = () => {
    onEdit(
      item.id, 
      editTitle, 
      editStartedAt ? editStartedAt.toISOString().split('T')[0] : null,
      item.type === 'divider' ? editDividerLabel : null
    );
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setEditStartedAt(item.started_at ? new Date(item.started_at) : undefined);
    setEditDividerLabel(item.divider_label || '');
    setIsEditing(false);
  };

  // Divider rendering
  if (item.type === 'divider') {
    const hasLabel = (item.divider_label || '').trim().length > 0;
    
    return (
      <div 
        className={cn(
          "py-3 px-4 flex items-center gap-3",
          isDragging && "opacity-50"
        )}
        draggable={isEditMode}
        onDragStart={(e) => onDragStart?.(e, item.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop?.(e, item.id)}
      >
        {isEditMode && !isEditing && (
          <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        {isEditing ? (
          <>
            <Input
              value={editDividerLabel}
              onChange={(e) => setEditDividerLabel(e.target.value)}
              className="h-7 text-xs w-32"
              placeholder="Optional label"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : hasLabel ? (
          <>
            <div 
              className="flex-1 h-px"
              style={{ backgroundColor: COLORS.divider }}
            />
            <span 
              className="text-xs font-medium px-2"
              style={{ color: COLORS.muted }}
            >
              {item.divider_label}
            </span>
            <div 
              className="flex-1 h-px"
              style={{ backgroundColor: COLORS.divider }}
            />
          </>
        ) : (
          <div 
            className="flex-1 h-px"
            style={{ backgroundColor: COLORS.divider }}
          />
        )}
        {isEditMode && !isEditing && (
          <div className="flex items-center gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 hover:text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Piece rendering
  return (
    <div 
      className={cn(
        "flex items-center gap-3 py-3 px-4 rounded-lg transition-colors",
        "hover:bg-card/50",
        isDragging && "opacity-50"
      )}
      draggable={isEditMode}
      onDragStart={(e) => onDragStart?.(e, item.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(e, item.id)}
    >
      {isEditMode && !isEditing && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <StatusDot 
        status={item.status} 
        onClick={handleStatusClick}
        disabled={isUpdating}
      />
      
      {isEditing ? (
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs justify-start",
                  !editStartedAt && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-3 w-3" />
                {editStartedAt ? format(editStartedAt, "dd.MM.yyyy") : "Set start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={editStartedAt}
                onSelect={setEditStartedAt}
                initialFocus
              />
              {editStartedAt && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setEditStartedAt(undefined)}
                  >
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{item.title}</p>
            {item.started_at && (
              <p 
                className="text-xs truncate"
                style={{ color: COLORS.muted }}
              >
                {formatStartedAt(item.started_at)}
              </p>
            )}
          </div>
          
          {isEditMode && (
            <div className="flex items-center gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}