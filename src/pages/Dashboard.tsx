import { MetricCard } from '@/components/dashboard/MetricCard';
import { AssetMap } from '@/components/dashboard/AssetMap';
import { Package, Activity, AlertTriangle, DollarSign } from 'lucide-react';
import { useAssets } from '@/hooks/useAssets';
import { useMemo } from 'react';
import { useAssetLocations } from '@/hooks/useAssetLocations';
import { useRooms } from '@/hooks/useRooms';
import { formatIDR } from '@/lib/utils';

const Dashboard = () => {
  const { assets, loading } = useAssets();
  const { locations } = useAssetLocations();
  const { rooms } = useRooms();

  // Create a map of asset_id to their actual floor from asset_locations (single source of truth)
  const assetFloorMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach(loc => {
      if (loc.room) {
        map.set(loc.asset_id, loc.room.floor);
      }
    });
    return map;
  }, [locations]);

  const metrics = useMemo(() => {
    if (!assets.length) {
      return {
        total: 0,
        active: 0,
        lostDamaged: 0,
        totalValue: 0
      };
    }

    const active = assets.filter(a => a.status === 'active').length;
    const lostDamaged = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;
    const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);

    return {
      total: assets.length,
      active,
      lostDamaged,
      totalValue
    };
  }, [assets]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Overview</h2>
        <p className="text-muted-foreground mt-1">Ringkasan kondisi aset secara menyeluruh</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Assets"
          value={loading ? '...' : metrics.total.toLocaleString()}
          icon={Package}
          variant="default"
        />
        <MetricCard
          title="Active Assets"
          value={loading ? '...' : metrics.active.toLocaleString()}
          icon={Activity}
          variant="success"
        />
        <MetricCard
          title="Lost/Damaged"
          value={loading ? '...' : metrics.lostDamaged}
          icon={AlertTriangle}
          variant="destructive"
        />
        <MetricCard
          title="Asset Value"
          value={loading ? '...' : formatIDR(metrics.totalValue, true)}
          icon={DollarSign}
          variant="default"
        />
      </div>

      {/* Map */}
      <AssetMap />
    </div>
  );
};

export default Dashboard;
