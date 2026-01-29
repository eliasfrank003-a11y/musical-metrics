import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RepertoireItem {
  id: number;
  type: 'piece' | 'divider';
  title: string;
  composer: string | null;
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
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Type assertion since DB returns text, but we know the constraints
      const typedData = (data || []).map(item => ({
        ...item,
        type: item.type as 'piece' | 'divider',
        status: item.status as 'grey' | 'green' | 'red',
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

  const updateItem = useCallback(async (id: number, title: string, composer: string | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('repertoire_items')
        .update({ title, composer })
        .eq('id', id);

      if (error) throw error;
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, title, composer } : item
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
    composer?: string
  ) => {
    try {
      // Get next sort order
      const maxOrder = items.length > 0 
        ? Math.max(...items.map(i => i.sort_order)) 
        : -1;

      const { data, error } = await supabase
        .from('repertoire_items')
        .insert({
          type,
          title,
          composer: composer || null,
          status: 'grey',
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedData = {
        ...data,
        type: data.type as 'piece' | 'divider',
        status: data.status as 'grey' | 'green' | 'red',
      };
      
      setItems(prev => [...prev, typedData]);
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
