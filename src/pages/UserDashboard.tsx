import { useNavigate } from "react-router-dom";
import { useAssets } from "@/hooks/useAssets";
import { useUserBorrowRequests } from "@/hooks/useBorrowRequests";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AssetMap } from "@/components/dashboard/AssetMap";
import { Package, Activity, Eye, Clock } from "lucide-react";
import { useMemo } from "react";

const UserDashboard = () => {
  const navigate = useNavigate();
  const { assets, loading } = useAssets();
  const { requests } = useUserBorrowRequests();

  const stats = useMemo(() => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'active').length;
    const available = assets.filter(a => a.status === 'active' || a.status === 'idle').length;
    const myRequests = requests.filter(r => r.status === 'Pending').length;

    return { total, active, available, myRequests };
  }, [assets, requests]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">User Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          View available assets and their status
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
          title="Available to Use"
          value={loading ? "..." : stats.available.toString()}
          icon={Eye}
          trend={{ value: 0, isPositive: true }}
          onClick={() => navigate('/request')}
        />
        <MetricCard
          title="Pending Requests"
          value={loading ? "..." : stats.myRequests.toString()}
          icon={Clock}
          trend={{ value: 0, isPositive: true }}
          onClick={() => navigate('/history')}
        />
      </div>

      <AssetMap />
    </div>
  );
};

export default UserDashboard;
