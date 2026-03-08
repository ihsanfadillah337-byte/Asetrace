import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ClipboardList, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import { useMaintenanceHistory } from '@/hooks/useMaintenanceHistory';
import { useAssets } from '@/hooks/useAssets';
import { AddMaintenanceDialog } from '@/components/maintenance/AddMaintenanceDialog';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast } from 'date-fns';

const MaintenanceStatus = () => {
  const { records, loading } = useMaintenanceHistory();
  const { assets } = useAssets();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['admin', 'operator']);

  const stats = useMemo(() => {
    const total = records.length;
    const completed = records.filter(r => r.status === 'completed').length;
    const scheduled = records.filter(r => r.status === 'scheduled').length;
    const inProgress = records.filter(r => r.status === 'in_progress').length;
    const overdue = records.filter(r => 
      r.status === 'scheduled' && 
      r.scheduled_date && 
      isPast(new Date(r.scheduled_date))
    ).length;

    return { total, completed, scheduled, inProgress, overdue };
  }, [records]);

  const chartData = useMemo(() => [
    { name: 'Scheduled', value: stats.scheduled, color: 'hsl(var(--primary))' },
    { name: 'In Progress', value: stats.inProgress, color: 'hsl(var(--warning))' },
    { name: 'Completed', value: stats.completed, color: 'hsl(var(--success))' },
    { name: 'Overdue', value: stats.overdue, color: 'hsl(var(--destructive))' },
  ], [stats]);

  const recentTasks = useMemo(() => {
    return records
      .slice(0, 10)
      .map(record => {
        const asset = assets.find(a => a.id === record.asset_id);
        const isOverdue = record.status === 'scheduled' && 
                         record.scheduled_date && 
                         isPast(new Date(record.scheduled_date));
        
        return {
          ...record,
          assetName: asset?.name || 'Unknown Asset',
          isOverdue,
        };
      });
  }, [records, assets]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Maintenance Status</h2>
          <p className="text-muted-foreground mt-1">Overview of maintenance activities</p>
        </div>
        {canManage && <AddMaintenanceDialog />}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Tasks"
          value={stats.total.toString()}
          icon={ClipboardList}
          variant="default"
        />
        <MetricCard
          title="Completed Tasks"
          value={stats.completed.toString()}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Overdue Tasks"
          value={stats.overdue.toString()}
          icon={AlertCircle}
          variant="destructive"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
        {chartData.some(d => d.value > 0) ? (
          <>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    dataKey="value"
                  >
                    {chartData.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-6">
              {chartData.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-2xl font-bold">{item.value}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No maintenance data available</p>
          </div>
        )}
      </Card>

      {/* Maintenance Tasks List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Recent Maintenance Tasks
        </h3>
        {recentTasks.length > 0 ? (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">
                    {task.maintenance_type} - {task.assetName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Technician: {task.technician_name}
                    {task.scheduled_date && ` • Due: ${format(new Date(task.scheduled_date), 'MMM dd, yyyy')}`}
                    {task.cost && ` • Cost: $${task.cost.toFixed(2)}`}
                  </p>
                </div>
                <Badge 
                  variant={
                    task.isOverdue ? 'destructive' :
                    task.status === 'completed' ? 'default' :
                    task.status === 'in_progress' ? 'secondary' :
                    'outline'
                  }
                  className="text-xs"
                >
                  {task.isOverdue ? 'Overdue' : task.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No maintenance tasks yet</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MaintenanceStatus;
