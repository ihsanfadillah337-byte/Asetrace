import { useState, useEffect, useCallback } from 'react';
import { useBLETracking } from '@/hooks/useBLETracking';
import { useAssets } from '@/hooks/useAssets';
import { useBLEGateways } from '@/hooks/useBLEGateways';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Radio, Signal, SignalHigh, SignalLow, SignalMedium, SignalZero } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export function RSSIMonitor() {
  const { trackingData, liveStatus, loading } = useBLETracking();
  const { assets } = useAssets();
  const { gateways } = useBLEGateways();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [totalScansToday, setTotalScansToday] = useState<number>(0);

  // Fetch total scans from today
  const fetchTotalScansToday = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('ble_tracking_data')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString());

      if (error) throw error;
      setTotalScansToday(count || 0);
    } catch (err) {
      console.error('Error fetching total scans:', err);
    }
  }, []);

  // Calculate total scans from all gateways
  const totalGatewayScans = gateways.reduce((acc, gw) => acc + (gw.scanCount || 0), 0);

  useEffect(() => {
    fetchTotalScansToday();

    // Subscribe to realtime updates for scan count
    const channel = supabase
      .channel('rssi-monitor-scans')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ble_tracking_data' },
        () => {
          fetchTotalScansToday();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTotalScansToday]);

  const getSignalIcon = (rssi: number | null) => {
    if (rssi === null) return SignalZero;
    if (rssi > -50) return SignalHigh;
    if (rssi > -60) return SignalMedium;
    if (rssi > -70) return SignalLow;
    return SignalZero;
  };

  const getSignalColor = (rssi: number | null) => {
    if (rssi === null) return 'text-muted-foreground';
    if (rssi > -50) return 'text-green-500';
    if (rssi > -60) return 'text-blue-500';
    if (rssi > -70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const rssiToPercentage = (rssi: number | null) => {
    if (rssi === null) return 0;
    // Convert RSSI (-100 to -30) to percentage (0 to 100)
    return Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  };

  const assetsWithTags = assets.filter(a => a.ble_tag_mac);
  const liveAssets = Array.from(liveStatus.values()).filter(s => s.isLive);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Live Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-green-500 animate-pulse" />
              <span className="text-2xl font-bold">{liveAssets.length}</span>
              <span className="text-muted-foreground text-sm">/ {assetsWithTags.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Excellent Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <SignalHigh className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {liveAssets.filter(a => a.rssi && a.rssi > -50).length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Scans (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Signal className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalScansToday.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total gateway scans: {totalGatewayScans.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Real-Time Signal Strength</CardTitle>
          <CardDescription>
            Live RSSI monitoring for all registered BLE tags
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : assetsWithTags.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No BLE tags registered. Register tags in the Tag Registration tab.
            </p>
          ) : (
            <div className="space-y-4">
              {assetsWithTags.map(asset => {
                const status = liveStatus.get(asset.id);
                const SignalIcon = getSignalIcon(status?.rssi || null);
                const signalColor = getSignalColor(status?.rssi || null);
                const signalPercentage = rssiToPercentage(status?.rssi || null);

                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-smooth cursor-pointer"
                    onClick={() => setSelectedTag(selectedTag === asset.id ? null : asset.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <SignalIcon className={`h-5 w-5 ${signalColor}`} />
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {asset.ble_tag_mac}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status?.isLive ? (
                          <Badge className="gap-1 bg-green-500">
                            <Radio className="h-3 w-3 animate-pulse" />
                            LIVE
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OFFLINE</Badge>
                        )}
                        <Badge variant="outline">
                          {status?.rssi ? `${status.rssi} dBm` : 'N/A'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Signal Strength</span>
                        <span>{status?.signalQuality || 'offline'}</span>
                      </div>
                      <Progress value={signalPercentage} className="h-2" />
                    </div>

                    {status?.lastSeen && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Last seen: {formatDistanceToNow(new Date(status.lastSeen))} ago
                      </div>
                    )}

                    {selectedTag === asset.id && trackingData.filter(t => t.asset_id === asset.id).slice(0, 5).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-2"
                      >
                        <div className="text-xs font-medium text-muted-foreground">Recent Scans:</div>
                        {trackingData
                          .filter(t => t.asset_id === asset.id)
                          .slice(0, 5)
                          .map((data, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                            >
                              <span className="font-mono">{data.receiver_id}</span>
                              <span className={getSignalColor(data.rssi)}>
                                {data.rssi} dBm
                              </span>
                              <span className="text-muted-foreground">
                                {formatDistanceToNow(new Date(data.timestamp))} ago
                              </span>
                            </div>
                          ))}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
