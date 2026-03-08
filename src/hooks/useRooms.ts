import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  floor: string;
  building: string;
  area_sqm: number | null;
  capacity: number | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
}

export function useRooms(floor?: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rooms')
        .select('*')
        .order('room_code', { ascending: true });

      if (floor) {
        query = query.eq('floor', floor);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setRooms(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching rooms:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [floor]);

  return { rooms, loading, error, refetch: fetchRooms };
}
