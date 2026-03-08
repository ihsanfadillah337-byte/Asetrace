import { useNavigate } from "react-router-dom";
import { useAssets } from "@/hooks/useAssets";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AssetMap } from "@/components/dashboard/AssetMap";
import { Activity, Package, AlertCircle, Wrench } from "lucide-react";
import { useMemo } from "react";

const OperatorDashboard = () => {
  const navigate = useNavigate();
  const { assets, loading } = useAssets();

  const stats = useMemo(() => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'active').length;
    const maintenance = assets.filter(a => a.status === 'maintenance').length;
    const damaged = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;

    return { total, active, maintenance, damaged };
  }, [assets]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Operator Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Monitor and manage asset operations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Assets"
          value={loading ? "..." : stats.total.toString()}
          icon={Package}
          trend={{ value: 0, isPositive: true }}
          onClick={() => navigate('/inventory')}
        />
        <MetricCard
          title="Active Assets"
          value={loading ? "..." : stats.active.toString()}
          icon={Activity}
          trend={{ value: 0, isPositive: true }}
          onClick={() => navigate('/inventory')}
        />
        <MetricCard
          title="In Maintenance"
          value={loading ? "..." : stats.maintenance.toString()}
          icon={Wrench}
          trend={{ value: 0, isPositive: false }}
          onClick={() => navigate('/maintenance')}
        />
        <MetricCard
          title="Lost/Damaged"
          value={loading ? "..." : stats.damaged.toString()}
          icon={AlertCircle}
          trend={{ value: 0, isPositive: false }}
          onClick={() => navigate('/notifications')}
        />
      </div>

      <AssetMap />
    </div>
  );
};

export default OperatorDashboard;
