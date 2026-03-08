import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, CheckCircle, Clock, TrendingUp, Wrench, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAssetUsage } from '@/hooks/useAssetUsage';
import { useMaintenanceHistory } from '@/hooks/useMaintenanceHistory';
import { useMemo } from 'react';

const usageData = [
  { day: 'Mon', usage: 85 },
  { day: 'Tue', usage: 92 },
  { day: 'Wed', usage: 78 },
  { day: 'Thu', usage: 96 },
  { day: 'Fri', usage: 88 },
  { day: 'Sat', usage: 45 },
  { day: 'Sun', usage: 32 }
];

const maintenanceData = [
  { name: 'Scheduled', value: 65, color: 'hsl(var(--primary))' },
  { name: 'Overdue', value: 25, color: 'hsl(var(--destructive))' },
  { name: 'Complete', value: 85, color: 'hsl(var(--success))' }
];

export function NotificationPanel() {
  const { notifications, loading, unreadCount, markAsRead } = useNotifications();
  const { logs: usageLogs } = useAssetUsage();
  const { records: maintenanceRecords } = useMaintenanceHistory();
  const navigate = useNavigate();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'borrow_approved':
        return CheckCircle;
      case 'borrow_rejected':
        return AlertTriangle;
      case 'maintenance_due':
      case 'maintenance_completed':
        return Wrench;
      case 'asset_status_changed':
        return AlertTriangle;
      case 'usage_alert':
        return TrendingUp;
      default:
        return Bell;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'borrow_rejected':
      case 'asset_status_changed':
        return 'error';
      case 'maintenance_due':
        return 'warning';
      case 'borrow_approved':
      case 'maintenance_completed':
        return 'success';
      default:
        return 'info';
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);

    if (notification.related_entity_type === 'asset' && notification.related_entity_id) {
      navigate(`/asset/${notification.related_entity_id}`);
    } else if (notification.related_entity_type === 'borrow_request') {
      navigate('/borrow-history');
    } else if (notification.related_entity_type === 'maintenance') {
      navigate('/maintenance');
    }
  };

  // Calculate weekly usage data from actual logs
  const weeklyUsageData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = days.map((day, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (today.getDay() - index));
      
      const dayLogs = usageLogs.filter(log => {
        const logDate = new Date(log.started_at);
        return logDate.toDateString() === date.toDateString();
      });

      return {
        day,
        usage: dayLogs.length * 15 // Approximate usage percentage
      };
    });

    return weekData;
  }, [usageLogs]);

  // Calculate maintenance status from actual records
  const maintenanceStatusData = useMemo(() => {
    const scheduled = maintenanceRecords.filter(r => r.status === 'scheduled').length;
    const inProgress = maintenanceRecords.filter(r => r.status === 'in_progress').length;
    const completed = maintenanceRecords.filter(r => r.status === 'completed').length;

    return [
      { name: 'Scheduled', value: scheduled, color: 'hsl(var(--primary))' },
      { name: 'In Progress', value: inProgress, color: 'hsl(var(--warning))' },
      { name: 'Complete', value: completed, color: 'hsl(var(--success))' }
    ].filter(item => item.value > 0);
  }, [maintenanceRecords]);

  const criticalCount = notifications.filter(n => 
    ['borrow_rejected', 'asset_status_changed', 'maintenance_due'].includes(n.type) && !n.read_status
  ).length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
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
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const variant = getNotificationVariant(notification.type);
                
                return (
                  <div 
                    key={notification.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      !notification.read_status ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card/50 hover:bg-card/80'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`p-2 rounded-lg ${
                      variant === 'error' ? 'bg-destructive/10 text-destructive' :
                      variant === 'warning' ? 'bg-warning/10 text-warning' :
                      variant === 'success' ? 'bg-success/10 text-success' :
                      'bg-primary/10 text-primary'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground">{notification.title}</p>
                        {!notification.read_status && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4 text-xs"
              onClick={() => navigate('/notifications')}
            >
              View All Notifications
            </Button>
          </>
        )}
      </Card>

      {/* Usage Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Usage</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyUsageData}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis hide />
              <Line 
                type="monotone" 
                dataKey="usage" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Maintenance Status Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Maintenance Status</h3>
        {maintenanceStatusData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No maintenance records yet
          </div>
        ) : (
          <>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={maintenanceStatusData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={60}
                    dataKey="value"
                  >
                    {maintenanceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {maintenanceStatusData.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-medium">{item.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.name}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}