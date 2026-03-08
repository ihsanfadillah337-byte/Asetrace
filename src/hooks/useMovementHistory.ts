import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MovementRecord {
  id: string;
  asset_id: string;
  from_room_id: string | null;
  to_room_id: string;
  from_room_name: string | null;
  to_room_name: string;
  detected_by: string | null;
  rssi: number | null;
  moved_at: string;
  created_at: string;
}

interface UseMovementHistoryOptions {
  assetId?: string;
  limit?: number;
}

export function useMovementHistory(options: UseMovementHistoryOptions = {}) {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { assetId, limit = 100 } = options;

  const fetchMovements = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('asset_movement_history')
        .select('*')
        .order('moved_at', { ascending: false })
        .limit(limit);

      if (assetId) {
        query = query.eq('asset_id', assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setMovements(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching movement history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('movement-history-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asset_movement_history' },
        () => {
          fetchMovements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assetId, limit]);

  return { movements, loading, error, refetch: fetchMovements };
}
