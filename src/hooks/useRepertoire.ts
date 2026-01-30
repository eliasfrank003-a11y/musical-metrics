import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RepertoireItem {
  id: number;
  type: 'piece' | 'divider';
  title: string;
  started_at: string | null;
  divider_label: string | null;
  status: 'grey' | 'green' | 'red';
  sort_order: number;
}

export function useRepertoire() {
  const [items, setItems] = useState<RepertoireItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('repertoire_items')
        .select('*')
        .order('sort_order', { ascending: false });
      if (error) throw error;
      
      // Type assertion since DB returns text, but we know the constraints
      const typedData = (data || []).map(item => ({
        id: item.id,
        type: item.type as 'piece' | 'divider',
        title: item.title,
        started_at: (item as any).started_at || null,
        divider_label: (item as any).divider_label || null,
        status: (item.status as 'grey' | 'green' | 'red') || 'grey',
        sort_order: item.sort_order,
      }));
      
      setItems(typedData);
    } catch (error) {
      console.error('[Repertoire] Error fetching:', error);
      toast({
        title: 'Error loading repertoire',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateStatus = useCallback(async (id: number, newStatus: 'grey' | 'green' | 'red') => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('repertoire_items')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Optimistic update
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, status: newStatus } : item
      ));
    } catch (error) {
      console.error('[Repertoire] Error updating status:', error);
      toast({
        title: 'Error updating status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [toast]);

  const updateItem = useCallback(async (
    id: number,
    title: string,
    started_at: string | null,
    divider_label: string | null
  ) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('repertoire_items')
        .update({ title, started_at, divider_label })
        .eq('id', id);

      if (error) throw error;
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, title, started_at, divider_label } : item
      ));
    } catch (error) {
      console.error('[Repertoire] Error updating item:', error);
      toast({
        title: 'Error updating item',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [toast]);

  const deleteItem = useCallback(async (id: number) => {
    try {
      const { error } = await supabase
        .from('repertoire_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('[Repertoire] Error deleting item:', error);
      toast({
        title: 'Error deleting item',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const addItem = useCallback(async (
    type: 'piece' | 'divider',
    title: string,
    started_at?: string | null,
    divider_label?: string | null,
    positionAfterId?: number | null
  ) => {
    try {
      // Determine sort_order based on position
      let newSortOrder: number;
      
      if (positionAfterId === null || positionAfterId === undefined) {
        // Add at the beginning
        newSortOrder = (Math.max(...items.map(i => i.sort_order), 0) || 0) + 1;
      } else {
        // Add after the specified item
        const positionIndex = items.findIndex(i => i.id === positionAfterId);
        if (positionIndex === -1) {
          throw new Error('Position item not found');
        }
        
        const positionItem = items[positionIndex];
        
        // Find the next item in the display order (if it exists)
        if (positionIndex + 1 < items.length) {
          // Insert between the position item and the next item
          const nextItem = items[positionIndex + 1];
          newSortOrder = (positionItem.sort_order + nextItem.sort_order) / 2;
        } else {
          // Position item is the last item, so add after it
          newSortOrder = positionItem.sort_order - 1;
        }
      }

      const { data, error } = await supabase
        .from('repertoire_items')
        .insert({
          type,
          title,
          started_at: started_at || null,
          divider_label: divider_label || null,
          status: 'grey',
          sort_order: newSortOrder,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedData = {
        id: data.id,
        type: data.type as 'piece' | 'divider',
        title: data.title,
        started_at: (data as any).started_at || null,
        divider_label: (data as any).divider_label || null,
        status: (data.status as 'grey' | 'green' | 'red') || 'grey',
        sort_order: data.sort_order,
      };
      
      // Add to items and re-sort
      setItems(prev => {
        const updated = [...prev, typedData];
        return updated.sort((a, b) => b.sort_order - a.sort_order);
      });
    } catch (error) {
      console.error('[Repertoire] Error adding item:', error);
      toast({
        title: 'Error adding item',
        variant: 'destructive',
      });
    }
  }, [items, toast]);

  const reorderItems = useCallback(async (draggedId: number, targetId: number) => {
    // Find indices
    const draggedIndex = items.findIndex(i => i.id === draggedId);
    const targetIndex = items.findIndex(i => i.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
    
    // Reorder locally first (optimistic update)
    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);
    
    // Update sort_order based on new positions (reverse index since we sort by created_at desc)
    const updates = newItems.map((item, index) => ({
      id: item.id,
      sort_order: newItems.length - index,
    }));
    
    setItems(newItems);
    
    try {
      // Update all sort_orders in database
      for (const update of updates) {
        const { error } = await supabase
          .from('repertoire_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('[Repertoire] Error reordering:', error);
      toast({
        title: 'Error reordering items',
        variant: 'destructive',
      });
      // Refetch to restore correct order
      fetchItems();
    }
  }, [items, toast, fetchItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    isLoading,
    isUpdating,
    updateStatus,
    updateItem,
    deleteItem,
    addItem,
    reorderItems,
    refetch: fetchItems,
  };
}
