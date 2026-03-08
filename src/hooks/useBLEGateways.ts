import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room } from './useRooms';

export interface BLEGateway {
  receiver_id: string;
  room_id: string;
  lastSeen: string;
  status: 'online' | 'stale' | 'offline';
  scanCount: number;
  room?: Room;
}

// Gateway status thresholds (in milliseconds)
// These should be generous enough to account for network latency and scan intervals
const GATEWAY_ONLINE_THRESHOLD = 15000;  // 15 seconds - gateway is online if seen within this time
const GATEWAY_STALE_THRESHOLD = 45000;   // 45 seconds - gateway is stale (warning state)
// Beyond STALE_THRESHOLD = offline

// Calculate gateway status based PURELY on last_seen timestamp (heartbeat)
// This is independent of whether any assets were detected
function calculateGatewayStatus(lastSeen: string): 'online' | 'stale' | 'offline' {
  if (!lastSeen) return 'offline';
  
  const now = Date.now();
  const lastSeenTime = new Date(lastSeen).getTime();
  const timeDiff = now - lastSeenTime;

  // Gateway status is determined ONLY by heartbeat timing, not by asset detection
  if (timeDiff < GATEWAY_ONLINE_THRESHOLD) {
    return 'online';
  } else if (timeDiff < GATEWAY_STALE_THRESHOLD) {
    return 'stale';
  }
  return 'offline';
}

export function useBLEGateways() {
  const [gateways, setGateways] = useState<BLEGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGateways = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch from ble_gateways table
      const { data: gatewayData, error: gatewayError } = await supabase
        .from('ble_gateways')
        .select('receiver_id, room_id, last_seen, status, scan_count');

      if (gatewayError) throw gatewayError;

      // Fetch rooms data
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*');

      if (roomsError) throw roomsError;

      // Map gateways with room info and calculate real-time status
      const mappedGateways = gatewayData?.map((gw: any) => {
        const room = roomsData?.find(r => r.id === gw.room_id);
        // Calculate status based on last_seen (client-side check for accuracy)
        const calculatedStatus = calculateGatewayStatus(gw.last_seen);
        
        return {
          receiver_id: gw.receiver_id,
          room_id: gw.room_id,
          lastSeen: gw.last_seen,
          status: calculatedStatus,
          scanCount: gw.scan_count || 0,
          room: room as Room | undefined
        };
      }) || [];

      setGateways(mappedGateways);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching gateways:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update gateway statuses periodically (every 5 seconds)
  const updateGatewayStatuses = useCallback(() => {
    setGateways(prevGateways => 
      prevGateways.map(gw => ({
        ...gw,
        status: calculateGatewayStatus(gw.lastSeen)
      }))
    );
  }, []);

  useEffect(() => {
    fetchGateways();

    // Subscribe to realtime changes on ble_gateways table
    const channel = supabase
      .channel('ble-gateways-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ble_gateways' },
        (payload) => {
          console.log('Gateway update:', payload);
          fetchGateways();
        }
      )
      .subscribe();

    // Update statuses every 5 seconds for accurate online/offline detection
    const statusInterval = setInterval(updateGatewayStatuses, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusInterval);
    };
  }, [fetchGateways, updateGatewayStatuses]);

  return { gateways, loading, error, refetch: fetchGateways };
}
