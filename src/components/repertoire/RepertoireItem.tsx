import { useState } from 'react';
import { StatusDot, getNextStatus } from './StatusDot';
import { Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ItemStatus = 'grey' | 'green' | 'red';

export interface RepertoireItemData {
  id: number;
  type: 'piece' | 'divider';
  title: string;
  composer: string | null;
  status: ItemStatus;
  sort_order: number;
}

interface RepertoireItemProps {
  item: RepertoireItemData;
  onStatusChange: (id: number, newStatus: ItemStatus) => void;
  onEdit: (id: number, title: string, composer: string | null) => void;
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
  const [editComposer, setEditComposer] = useState(item.composer || '');

  const handleStatusClick = () => {
    const newStatus = getNextStatus(item.status);
    onStatusChange(item.id, newStatus);
  };

  const handleSaveEdit = () => {
    onEdit(item.id, editTitle, item.type === 'piece' ? editComposer : null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setEditComposer(item.composer || '');
    setIsEditing(false);
  };

  // Divider rendering
  if (item.type === 'divider') {
    const hasText = item.title.trim().length > 0;
    
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
        <div 
          className="flex-1 h-px"
          style={{ backgroundColor: COLORS.divider }}
        />
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-7 text-xs w-32"
              placeholder="Optional text"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : hasText ? (
          <span 
            className="text-xs font-medium px-2"
            style={{ color: COLORS.muted }}
          >
            {item.title}
          </span>
        ) : null}
        <div 
          className="flex-1 h-px"
          style={{ backgroundColor: COLORS.divider }}
        />
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
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Input
            value={editComposer}
            onChange={(e) => setEditComposer(e.target.value)}
            placeholder="Composer"
            className="h-8 text-sm w-32"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{item.title}</p>
            {item.composer && (
              <p 
                className="text-xs truncate"
                style={{ color: COLORS.muted }}
              >
                {item.composer}
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