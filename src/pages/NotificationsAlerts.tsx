import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, AlertTriangle, Clock, TrendingUp, Wrench, Search, PackageX, LucideIcon, Loader2 } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useAssets } from '@/hooks/useAssets';
import { useMaintenanceHistory } from '@/hooks/useMaintenanceHistory';
import { useAssetUsage } from '@/hooks/useAssetUsage';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { AddNotificationDialog } from '@/components/notifications/AddNotificationDialog';

interface Notification {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  category: 'maintenance' | 'loss' | 'damage' | 'usage' | 'general';
  title: string;
  message: string;
  time: string;
  icon: LucideIcon;
  assetId?: string;
  severity: 'critical' | 'warning' | 'info';
}

interface NotificationsAlertsProps {
  assetId?: string;
}

const NotificationsAlerts = ({ assetId }: NotificationsAlertsProps) => {
  const navigate = useNavigate();
  const { assets, loading: assetsLoading } = useAssets();
  const { records: maintenance, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { logs: usageLogs, loading: usageLoading } = useAssetUsage(assetId);
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['admin', 'operator']);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredAssets = useMemo(() => {
    return assetId ? assets.filter(a => a.id === assetId) : assets;
  }, [assets, assetId]);

  const allNotifications = useMemo(() => {
    const notifications: Notification[] = [];
    
    // Maintenance status notifications
    filteredAssets.filter(a => a.status === 'maintenance').forEach(asset => {
      notifications.push({
        id: `maintenance-${asset.id}`,
        type: 'warning',
        category: 'maintenance',
        title: 'Maintenance Required',
        message: `${asset.name} in ${asset.floor} - ${asset.room}`,
        time: formatDistanceToNow(parseISO(asset.updated_at), { addSuffix: true }),
        icon: Wrench,
        assetId: asset.id,
        severity: 'warning'
      });
    });
    
    // Lost asset notifications
    filteredAssets.filter(a => a.status === 'lost').forEach(asset => {
      notifications.push({
        id: `lost-${asset.id}`,
        type: 'error',
        category: 'loss',
        title: 'Asset Missing',
        message: `${asset.name} - Last seen: ${asset.floor} - ${asset.room}`,
        time: formatDistanceToNow(parseISO(asset.updated_at), { addSuffix: true }),
        icon: PackageX,
        assetId: asset.id,
        severity: 'critical'
      });
    });
    
    // Damaged asset notifications
    filteredAssets.filter(a => a.status === 'damaged').forEach(asset => {
      notifications.push({
        id: `damage-${asset.id}`,
        type: 'error',
        category: 'damage',
        title: 'Asset Damaged',
        message: `${asset.name} in ${asset.floor} - ${asset.room} marked as damaged`,
        time: formatDistanceToNow(parseISO(asset.updated_at), { addSuffix: true }),
        icon: AlertTriangle,
        assetId: asset.id,
        severity: 'critical'
      });
    });
    
    // Overdue maintenance notifications
    maintenance
      .filter(m => m.status === 'scheduled' && m.scheduled_date && isPast(parseISO(m.scheduled_date)))
      .forEach(record => {
        const asset = assets.find(a => a.id === record.asset_id);
        if (asset && (!assetId || asset.id === assetId)) {
          notifications.push({
            id: `overdue-${record.id}`,
            type: 'error',
            category: 'maintenance',
            title: 'Overdue Maintenance',
            message: `${asset.name} - Scheduled ${formatDistanceToNow(parseISO(record.scheduled_date), { addSuffix: true })}`,
            time: formatDistanceToNow(parseISO(record.created_at), { addSuffix: true }),
            icon: AlertTriangle,
            assetId: asset.id,
            severity: 'critical'
          });
        }
      });
    
    // High usage alerts (>8 hours in last 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsage = usageLogs.filter(log => 
      parseISO(log.started_at) >= last24h
    );
    
    const usageByAsset = recentUsage.reduce((acc, log) => {
      const hours = log.duration_hours || 0;
      acc[log.asset_id] = (acc[log.asset_id] || 0) + hours;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(usageByAsset)
      .filter(([_, hours]) => hours > 8)
      .forEach(([asset_id, hours]) => {
        const asset = assets.find(a => a.id === asset_id);
        if (asset && (!assetId || asset.id === assetId)) {
          notifications.push({
            id: `usage-${asset.id}`,
            type: 'info',
            category: 'usage',
            title: 'High Usage Alert',
            message: `${asset.name} - ${hours.toFixed(1)}h in last 24h`,
            time: 'Last 24 hours',
            icon: TrendingUp,
            assetId: asset.id,
            severity: 'info'
          });
        }
      });
    
    // Idle assets (no usage in 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeAssetIds = new Set(
      usageLogs
        .filter(log => parseISO(log.started_at) >= sevenDaysAgo)
        .map(log => log.asset_id)
    );
    
    filteredAssets
      .filter(a => a.status === 'idle' || (a.status === 'active' && !activeAssetIds.has(a.id)))
      .slice(0, 5)
      .forEach(asset => {
        notifications.push({
          id: `idle-${asset.id}`,
          type: 'info',
          category: 'general',
          title: 'Asset Idle',
          message: `${asset.name} in ${asset.floor} - ${asset.room} has been idle`,
          time: formatDistanceToNow(parseISO(asset.updated_at), { addSuffix: true }),
          icon: Clock,
          assetId: asset.id,
          severity: 'info'
        });
      });
    
    return notifications.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [filteredAssets, maintenance, usageLogs, assets, assetId]);
  
  const criticalCount = allNotifications.filter(n => n.severity === 'critical').length;
  const warningCount = allNotifications.filter(n => n.severity === 'warning').length;
  const totalCount = allNotifications.length;
  
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter(notification => {
      const matchesSearch = 
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        filterCategory === 'all' ? true :
        filterCategory === 'critical' ? notification.severity === 'critical' :
        filterCategory === 'warning' ? notification.severity === 'warning' :
        filterCategory === 'info' ? notification.severity === 'info' :
        filterCategory === 'maintenance' ? notification.category === 'maintenance' :
        filterCategory === 'loss' ? notification.category === 'loss' :
        filterCategory === 'damage' ? notification.category === 'damage' :
        filterCategory === 'usage' ? notification.category === 'usage' :
        true;
      
      return matchesSearch && matchesFilter;
    });
  }, [allNotifications, searchQuery, filterCategory]);
  
  const handleNotificationClick = (notification: Notification) => {
    if (notification.assetId && !assetId) {
      navigate(`/asset/${notification.assetId}`);
    }
  };

  if (assetsLoading || maintenanceLoading || usageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {!assetId && (
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Notifications & Alerts</h2>
            <p className="text-muted-foreground mt-1">Recent alerts and notifications</p>
          </div>
          {canManage && <AddNotificationDialog />}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Alerts"
          value={totalCount}
          icon={Bell}
          variant="default"
        />
        <MetricCard
          title="Critical Alerts"
          value={criticalCount}
          icon={AlertTriangle}
          variant="destructive"
        />
        <MetricCard
          title="Warning Alerts"
          value={warningCount}
          icon={Wrench}
          variant="warning"
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alerts & Notifications
          </h3>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalCount} Critical
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search notifications..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Alerts</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="loss">Lost Assets</SelectItem>
              <SelectItem value="damage">Damaged Assets</SelectItem>
              <SelectItem value="usage">Usage Alerts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const Icon = notification.icon;
              return (
                <div 
                  key={notification.id} 
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors ${
                    notification.assetId ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    notification.type === 'error' ? 'bg-destructive/10 text-destructive' :
                    notification.type === 'warning' ? 'bg-warning/10 text-warning' :
                    notification.type === 'success' ? 'bg-success/10 text-success' :
                    'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">{notification.title}</p>
                      <Badge 
                        variant={
                          notification.severity === 'critical' ? 'destructive' : 
                          notification.severity === 'warning' ? 'outline' : 
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {notification.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notification.time}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">No alerts in this category</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default NotificationsAlerts;
