import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useRealtimeSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('global-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assets' },
        (payload) => {
          console.log('[Realtime] Assets changed:', payload.eventType);
          // 🚀 PERFORMANCE FIX: We only invalidate lightweight queries for location changes
          // Pinging the entire 'assets' query on every position_x/position_y flux will freeze the app!
          queryClient.invalidateQueries({ queryKey: ['asset-locations'] });
          
          // Only do a full asset reload if it's an INSERT/DELETE, or critical attributes changed
          // This avoids REST polling loops for fast-moving IoT devices
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || 
             (payload.eventType === 'UPDATE' && 
                (payload.new.status !== payload.old.status || payload.new.room_id !== payload.old.room_id))) {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('[Realtime] Notifications changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as { title?: string };
            toast({
              title: '🔔 New Notification',
              description: newNotif.title || 'You have a new notification',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrow_requests' },
        (payload) => {
          console.log('[Realtime] Borrow requests changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['borrow-requests'] });
          queryClient.invalidateQueries({ queryKey: ['user-borrow-requests'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_locations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['asset-locations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
