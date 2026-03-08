import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BLETrackingData {
  id: string;
  asset_id: string;
  receiver_id: string;
  tag_mac: string;
  rssi: number;
  receiver_location: {
    room_id: string;
    x: number;
    y: number;
  };
  timestamp: string;
  created_at: string;
}

export interface LiveAssetStatus {
  asset_id: string;
  isLive: boolean;
  lastSeen: string | null;
  rssi: number | null;
  signalQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
}

export function useBLETracking(assetId?: string) {
  const [trackingData, setTrackingData] = useState<BLETrackingData[]>([]);
  const [liveStatus, setLiveStatus] = useState<Map<string, LiveAssetStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getSignalQuality = (rssi: number | null): 'excellent' | 'good' | 'fair' | 'poor' | 'offline' => {
    if (rssi === null) return 'offline';
    if (rssi > -50) return 'excellent';
    if (rssi > -60) return 'good';
    if (rssi > -70) return 'fair';
    if (rssi > -80) return 'poor';
    return 'offline';
  };

  const updateLiveStatus = (data: BLETrackingData[]) => {
    const statusMap = new Map<string, LiveAssetStatus>();
    const now = new Date().getTime();
    const LIVE_THRESHOLD = 10000; // 10 seconds

    data.forEach(item => {
      const timestamp = new Date(item.timestamp).getTime();
      const isLive = (now - timestamp) < LIVE_THRESHOLD;
      
      statusMap.set(item.asset_id, {
        asset_id: item.asset_id,
        isLive,
        lastSeen: item.timestamp,
        rssi: item.rssi,
        signalQuality: isLive ? getSignalQuality(item.rssi) : 'offline',
      });
    });

    setLiveStatus(statusMap);
  };

  const fetchLatestTracking = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ble_tracking_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (assetId) {
        query = query.eq('asset_id', assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const typedData = (data || []) as BLETrackingData[];
      setTrackingData(typedData);
      updateLiveStatus(typedData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching BLE tracking data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestTracking();

    // Batching mechanism to prevent UI freezing from excessive real-time updates
    let updateQueue: BLETrackingData[] = [];
    let processingTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const processQueue = () => {
      if (!isSubscribed || updateQueue.length === 0) return;

      // Create a snapshot of the batch and clear the queue
      const batch = [...updateQueue];
      updateQueue = [];

      setTrackingData(prev => {
        // Only keep the most recent 100 entries, including the batched new ones
        const combined = [...batch, ...prev];
        // Ensure uniqueness by tag_mac if this is live data to prevent duplicates (optional, based on your UI needs)
        const unique = combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).slice(0, 100);
        
        // Also update live status based on this clean array
        updateLiveStatus(unique);
        return unique;
      });

      processingTimeout = null;
    };

    // Subscribe to realtime changes
    const channel = supabase
      .channel('ble-tracking-changes')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ble_tracking_data',
          ...(assetId ? { filter: `asset_id=eq.${assetId}` } : {})
        },
        (payload) => {
          // Push to our local queue instead of triggering immediate re-render
          const newEntry = payload.new as BLETrackingData;
          updateQueue.push(newEntry);
          
          // Debug conditionally to avoid console spam
          // console.log('Queued BLE tracking data:', newEntry.id);
          
          // Schedule processor if not already scheduled (Batching window: 1.5 seconds)
          if (!processingTimeout) {
            processingTimeout = setTimeout(processQueue, 1500);
          }
        }
      )
      .subscribe();

    // Update live status every 5 seconds (for stale detection)
    const interval = setInterval(() => {
      setTrackingData(prev => {
        updateLiveStatus(prev);
        return prev;
      });
    }, 5000);

    return () => {
      isSubscribed = false;
      if (processingTimeout) clearTimeout(processingTimeout);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [assetId]);

  return { 
    trackingData, 
    liveStatus, 
    loading, 
    error, 
    refetch: fetchLatestTracking,
    getAssetStatus: (assetId: string) => liveStatus.get(assetId) || {
      asset_id: assetId,
      isLive: false,
      lastSeen: null,
      rssi: null,
      signalQuality: 'offline' as const,
    }
  };
}
