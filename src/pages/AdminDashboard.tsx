import { useNavigate } from "react-router-dom";
import { useAssets } from "@/hooks/useAssets";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AssetMap } from "@/components/dashboard/AssetMap";
import { Activity, Package, AlertCircle, DollarSign } from "lucide-react";
import { useMemo } from "react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { assets, loading } = useAssets();

  const stats = useMemo(() => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'active').length;
    const damaged = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;
    const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);

    return { total, active, damaged, totalValue };
  }, [assets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Complete overview and management of all assets
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
          title="Lost/Damaged"
          value={loading ? "..." : stats.damaged.toString()}
          icon={AlertCircle}
          trend={{ value: 0, isPositive: false }}
          onClick={() => navigate('/notifications')}
        />
        <MetricCard
          title="Asset Value"
          value={loading ? "..." : formatCurrency(stats.totalValue)}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      <AssetMap />
    </div>
  );
};

export default AdminDashboard;
