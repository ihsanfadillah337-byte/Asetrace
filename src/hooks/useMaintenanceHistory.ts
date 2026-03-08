import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  maintenance_type: string;
  description: string | null;
  technician_name: string;
  cost: number | null;
  scheduled_date: string | null;
  completed_date: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useMaintenanceHistory(assetId?: string) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('maintenance_history')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (assetId) {
        query = query.eq('asset_id', assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setRecords((data as MaintenanceRecord[]) || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching maintenance records:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('maintenance-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_history' },
        () => {
          fetchRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assetId]);

  return { records, loading, error, refetch: fetchRecords };
}
