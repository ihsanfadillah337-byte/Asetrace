import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Asset {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'lost' | 'damaged' | 'idle' | 'borrowed' | 'untracked';
  condition: string;
  last_user: string | null;
  category: 'laptop' | 'server' | 'furniture' | 'vehicle' | 'other';
  last_maintenance: string | null;
  value: number | null;
  floor: string;
  room: string;
  room_id: string;
  position_x: number | null;
  position_y: number | null;
  type: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  ble_tag_mac: string | null;
  created_at: string;
  updated_at: string;
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAssets(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('assets-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assets' },
        () => {
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { assets, loading, error, refetch: fetchAssets };
}
