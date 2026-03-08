import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UsageLog {
  id: string;
  asset_id: string;
  user_id: string | null;
  user_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_hours: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export function useAssetUsage(assetId?: string) {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('asset_usage_logs')
        .select('*')
        .order('started_at', { ascending: false });

      if (assetId) {
        query = query.eq('asset_id', assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setLogs(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching usage logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('usage-logs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_usage_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assetId]);

  return { logs, loading, error, refetch: fetchLogs };
}
