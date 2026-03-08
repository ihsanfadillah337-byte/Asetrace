import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RssiDataPoint {
  id: string;
  rssi: number;
  timestamp: string;
  receiver_id: string;
  tag_mac: string;
}

export interface RssiStats {
  average: number;
  min: number;
  max: number;
  signalQuality: 'excellent' | 'good' | 'fair' | 'weak' | 'critical';
  dataPoints: number;
}

interface UseRssiHistoryOptions {
  tagMac?: string;
  assetId?: string;
  limit?: number;
  hoursBack?: number;
}

export function useRssiHistory(options: UseRssiHistoryOptions = {}) {
  const [data, setData] = useState<RssiDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RssiStats | null>(null);

  const { tagMac, assetId, limit = 100, hoursBack = 24 } = options;

  const calculateStats = (dataPoints: RssiDataPoint[]): RssiStats | null => {
    if (dataPoints.length === 0) return null;

    const rssiValues = dataPoints.map(d => d.rssi);
    const average = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
    const min = Math.min(...rssiValues);
    const max = Math.max(...rssiValues);

    let signalQuality: RssiStats['signalQuality'] = 'critical';
    if (average > -50) signalQuality = 'excellent';
    else if (average > -60) signalQuality = 'good';
    else if (average > -70) signalQuality = 'fair';
    else if (average > -85) signalQuality = 'weak';

    return {
      average: Math.round(average),
      min,
      max,
      signalQuality,
      dataPoints: dataPoints.length
    };
  };

  const fetchRssiHistory = useCallback(async () => {
    // Need either tagMac or assetId
    if (!tagMac && !assetId) {
      setData([]);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      let effectiveTagMac = tagMac;
      
      // If assetId is provided, fetch the tag_mac from assets table
      if (assetId && !tagMac) {
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('ble_tag_mac')
          .eq('id', assetId)
          .single();

        if (assetError || !asset?.ble_tag_mac) {
          setData([]);
          setStats(null);
          setLoading(false);
          return;
        }
        effectiveTagMac = asset.ble_tag_mac.toLowerCase();
      }

      // Calculate time filter
      const fromTime = new Date();
      fromTime.setHours(fromTime.getHours() - hoursBack);

      const { data: rssiData, error: rssiError } = await supabase
        .from('ble_rssi_buffer')
        .select('*')
        .eq('tag_mac', effectiveTagMac?.toLowerCase())
        .gte('timestamp', fromTime.toISOString())
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (rssiError) throw rssiError;

      const mappedData: RssiDataPoint[] = (rssiData || []).map(d => ({
        id: d.id,
        rssi: d.rssi,
        timestamp: d.timestamp,
        receiver_id: d.receiver_id,
        tag_mac: d.tag_mac
      }));

      setData(mappedData);
      setStats(calculateStats(mappedData));
      setError(null);
    } catch (err: any) {
      console.error('Error fetching RSSI history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tagMac, assetId, limit, hoursBack]);

  useEffect(() => {
    fetchRssiHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`rssi-history-${tagMac || assetId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ble_rssi_buffer' },
        () => {
          fetchRssiHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRssiHistory]);

  return { data, stats, loading, error, refetch: fetchRssiHistory };
}
