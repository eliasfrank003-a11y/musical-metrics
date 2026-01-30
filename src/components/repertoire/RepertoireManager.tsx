import { useState, useMemo } from 'react';
import { RepertoireItem, RepertoireItemData } from './RepertoireItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Filter, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RepertoireManagerProps {
  items: RepertoireItemData[];
  onStatusChange: (id: number, newStatus: 'grey' | 'green' | 'red') => void;
  onEdit: (id: number, title: string, started_at: string | null, divider_label: string | null) => void;
  onDelete: (id: number) => void;
  onAdd: (type: 'piece' | 'divider', title: string, started_at?: string | null, divider_label?: string | null, positionAfterId?: number | null) => void;
  onReorder: (draggedId: number, targetId: number) => void;
  isLoading?: boolean;
}

const COLORS = {
  muted: '#595A5F',
  red: '#FD4136',
};

export function RepertoireManager({
  items,
  onStatusChange,
  onEdit,
  onDelete,
  onAdd,
  onReorder,
  isLoading,
}: RepertoireManagerProps) {
  const [showRedOnly, setShowRedOnly] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingPiece, setIsAddingPiece] = useState(false);
  const [isAddingDivider, setIsAddingDivider] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId !== null && draggedId !== targetId) {
      onReorder(draggedId, targetId);
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const filteredItems = useMemo(() => {
    if (!showRedOnly) return items;
    // When filtering for red, include dividers between red items for context
    return items.filter((item) => item.status === 'red' || item.type === 'divider');
  }, [items, showRedOnly]);

  const handleAddPiece = () => {
    if (!newTitle.trim()) return;
    onAdd('piece', newTitle.trim(), null, null);
    setNewTitle('');
    setIsAddingPiece(false);
  };

  const handleAddDivider = () => {
    // Allow empty dividers
    onAdd('divider', '', null, newTitle.trim() || null, selectedPositionId);
    setNewTitle('');
    setIsAddingDivider(false);
    setSelectedPositionId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - no title, just controls */}
      <div className="flex items-center justify-end px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          {/* Edit Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "gap-1.5",
              isEditMode && "text-primary"
            )}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {/* Red List Filter Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRedOnly(!showRedOnly)}
            className={cn(
              "gap-1.5",
              showRedOnly && "text-destructive"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="text-xs">Red List</span>
          </Button>

          {/* Add Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsAddingPiece(true)}>
                Add Piece
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAddingDivider(true)}>
                Add Divider
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Add New Piece Form */}
      {isAddingPiece && (
        <div className="px-4 py-3 border-b border-border/30 space-y-2 max-w-md mx-auto w-full">
          <Input
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddPiece} disabled={!newTitle.trim()}>
              Add Piece
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAddingPiece(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add New Divider Form */}
      {isAddingDivider && (
        <div className="px-4 py-3 border-b border-border/30 space-y-3 max-w-md mx-auto w-full">
          <Input
            placeholder="Divider label (optional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Add divider after:
            </label>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/30">
              <button
                onClick={() => setSelectedPositionId(null)}
                className={cn(
                  "text-left px-3 py-2 rounded-md text-sm transition-colors",
                  selectedPositionId === null
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                At the beginning
              </button>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPositionId(item.id)}
                  className={cn(
                    "text-left px-3 py-2 rounded-md text-sm transition-colors truncate",
                    selectedPositionId === item.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                    item.type === 'divider' && "italic text-muted-foreground"
                  )}
                  title={item.title || "(empty divider)"}
                >
                  {item.type === 'piece' ? '♪' : '─'} {item.title || "(empty divider)"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddDivider}>
              Add Divider
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => {
                setIsAddingDivider(false);
                setSelectedPositionId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* List - centered */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p style={{ color: COLORS.muted }} className="text-sm text-center">
              {showRedOnly 
                ? 'No pieces in your Red List' 
                : 'No repertoire items yet'}
            </p>
            {!showRedOnly && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2"
                onClick={() => setIsAddingPiece(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add your first piece
              </Button>
            )}
          </div>
        ) : (
          <div className="py-2 max-w-md mx-auto w-full" onDragEnd={handleDragEnd}>
            {filteredItems.map((item) => (
              <RepertoireItem
                key={item.id}
                item={item}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                isEditMode={isEditMode}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}