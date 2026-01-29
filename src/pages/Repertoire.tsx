import { RepertoireManager } from '@/components/repertoire/RepertoireManager';
import { useRepertoire } from '@/hooks/useRepertoire';

export function Repertoire() {
  const {
    items,
    isLoading,
    isUpdating,
    updateStatus,
    updateItem,
    deleteItem,
    addItem,
    reorderItems,
  } = useRepertoire();

  return (
    <div className="h-full bg-background">
      <RepertoireManager
        items={items}
        onStatusChange={updateStatus}
        onEdit={updateItem}
        onDelete={deleteItem}
        onAdd={addItem}
        onReorder={reorderItems}
        isLoading={isLoading}
      />
    </div>
  );
}
