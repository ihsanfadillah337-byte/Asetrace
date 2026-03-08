import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room } from './useRooms';

export type TrackingStatus = 'tracked_active' | 'tracked_inactive' | 'untracked';

export interface AssetLocation {
  id: string;
  asset_id: string;
  tag_mac: string;
  room_id: string;
  receiver_id: string;
  rssi: number;
  confidence: 'high' | 'medium' | 'low';
  updated_at: string;
  room?: Room;
}

// Threshold for considering a BLE signal as "active" (in seconds)
const ACTIVE_THRESHOLD_SECONDS = 30;

export function useAssetLocations() {
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [locationMap, setLocationMap] = useState<Map<string, AssetLocation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      
      // Fetch asset locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('asset_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (locationsError) throw locationsError;

      // Fetch rooms data for joining
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*');

      if (roomsError) throw roomsError;

      // Map locations with room info
      const mappedLocations = locationsData?.map((loc: any) => {
        const room = roomsData?.find(r => r.id === loc.room_id);
        return {
          ...loc,
          room: room as Room | undefined
        } as AssetLocation;
      }) || [];

      setLocations(mappedLocations);
      
      // Create a map for quick lookup by asset_id
      const map = new Map<string, AssetLocation>();
      mappedLocations.forEach(loc => {
        map.set(loc.asset_id, loc);
      });
      setLocationMap(map);
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching asset locations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    // Subscribe to realtime changes on asset_locations table
    const channel = supabase
      .channel('asset-locations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_locations' },
        (payload) => {
          console.log('Asset location update:', payload);
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getAssetLocation = (assetId: string) => locationMap.get(assetId);

  /**
   * Determines the tracking status of an asset:
   * - tracked_active: Has BLE tag AND has received signal within threshold
   * - tracked_inactive: Has BLE tag BUT no signal within threshold (tag off/out of range)
   * - untracked: Does not have a BLE tag assigned
   */
  const getTrackingStatus = (asset: { id: string; ble_tag_mac: string | null }): TrackingStatus => {
    // No BLE tag = untracked
    if (!asset.ble_tag_mac) {
      return 'untracked';
    }

    // Has BLE tag - check if we have recent location data
    const location = locationMap.get(asset.id);
    if (!location) {
      // Has tag but never been detected
      return 'tracked_inactive';
    }

    // Check if the location update is recent
    const updatedAt = new Date(location.updated_at);
    const now = new Date();
    const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;

    if (secondsSinceUpdate <= ACTIVE_THRESHOLD_SECONDS) {
      return 'tracked_active';
    }

    return 'tracked_inactive';
  };

  return { 
    locations, 
    locationMap,
    loading, 
    error, 
    refetch: fetchLocations,
    getAssetLocation,
    getTrackingStatus
  };
}
