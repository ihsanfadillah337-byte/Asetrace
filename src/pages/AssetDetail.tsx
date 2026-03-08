import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Activity, AlertTriangle, Wrench, User, Calendar, Loader2, FilePen, Trash2, Package, Navigation, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EditAssetDialog } from '@/components/dashboard/EditAssetDialog';
import { DeleteAssetDialog } from '@/components/dashboard/DeleteAssetDialog';
import { RetireAssetDialog } from '@/components/dashboard/RetireAssetDialog';
import { AddMaintenanceDialog } from '@/components/maintenance/AddMaintenanceDialog';
import { AssetMovementTimeline } from '@/components/ble/AssetMovementTimeline';
import { AssetSignalChart } from '@/components/ble/AssetSignalChart';
import { useAssets } from '@/hooks/useAssets';
import { useMaintenanceHistory } from '@/hooks/useMaintenanceHistory';
import { useAssetUsage } from '@/hooks/useAssetUsage';
import { useBorrowRequests } from '@/hooks/useBorrowRequests';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, parseISO, isPast, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatIDR } from '@/lib/utils';
import WeeklyUsage from './WeeklyUsage';


const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string; color: string }> = {
  active: { variant: 'default', label: 'Active', color: 'bg-success/10 text-success' },
  idle: { variant: 'secondary', label: 'Idle', color: 'bg-muted/10 text-muted-foreground' },
  maintenance: { variant: 'outline', label: 'Maintenance', color: 'bg-warning/10 text-warning' },
  lost: { variant: 'destructive', label: 'Lost', color: 'bg-destructive/10 text-destructive' },
  damaged: { variant: 'destructive', label: 'Damaged', color: 'bg-destructive/10 text-destructive' },
  borrowed: { variant: 'outline', label: 'Borrowed', color: 'bg-primary/10 text-primary' },
  untracked: { variant: 'destructive', label: '📡 LOST SIGNAL', color: 'bg-destructive/10 text-destructive' }
};

const conditionConfig = {
  Excellent: { color: 'text-success', label: 'Excellent' },
  Good: { color: 'text-primary', label: 'Good' },
  Fair: { color: 'text-warning', label: 'Fair' },
  Poor: { color: 'text-destructive', label: 'Poor' },
  Unknown: { color: 'text-muted-foreground', label: 'Unknown' }
};

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { assets, loading: assetsLoading } = useAssets();
  const { records: maintenance, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { logs: usageLogs, loading: usageLoading } = useAssetUsage(assetId);
  const { requests: borrowRequests } = useBorrowRequests();
  
  const asset = useMemo(() => {
    return assets.find(a => a.id === assetId);
  }, [assets, assetId]);

  // Get active borrow request for this asset to calculate accurate duration
  const activeBorrowRequest = useMemo(() => {
    if (!assetId || !borrowRequests) return null;
    return borrowRequests.find(
      req => req.asset_id === assetId && ['Approved', 'Active'].includes(req.status)
    );
  }, [assetId, borrowRequests]);

  // Calculate borrow duration from approved_at or tanggal_pinjam (not asset.updated_at)
  const borrowDuration = useMemo(() => {
    if (!activeBorrowRequest) return null;
    // Use updated_at as the approval timestamp, or fall back to tanggal_pinjam
    const approvedDate = activeBorrowRequest.updated_at 
      ? parseISO(activeBorrowRequest.updated_at)
      : parseISO(activeBorrowRequest.tanggal_pinjam);
    return formatDistanceToNow(approvedDate, { addSuffix: true });
  }, [activeBorrowRequest]);

  const canManage = hasPermission(['admin', 'operator']);

  // Calculate usage stats
  const usageStats = useMemo(() => {
    const now = new Date();
    const today = { start: startOfDay(now), end: endOfDay(now) };
    const week = { start: startOfWeek(now), end: endOfWeek(now) };
    const month = { start: startOfMonth(now), end: endOfMonth(now) };

    const calculateHours = (start: Date, end: Date) => {
      return usageLogs
        .filter(log => {
          const logDate = parseISO(log.started_at);
          return logDate >= start && logDate <= end;
        })
        .reduce((sum, log) => sum + (log.duration_hours || 0), 0);
    };

    return {
      hoursToday: calculateHours(today.start, today.end),
      hoursWeek: calculateHours(week.start, week.end),
      hoursMonth: calculateHours(month.start, month.end),
      totalSessions: usageLogs.length
    };
  }, [usageLogs]);

  // Get recent activities
  const recentActivities = useMemo(() => {
    const activities = [];
    
    // Add latest usage log
    if (usageLogs[0]) {
      activities.push({
        date: formatDistanceToNow(parseISO(usageLogs[0].started_at), { addSuffix: true }),
        action: 'Asset Used',
        user: usageLogs[0].user_name || 'Unknown User',
        location: usageLogs[0].location || 'Unknown'
      });
    }
    
    // Add latest maintenance
    if (maintenance[0]) {
      activities.push({
        date: formatDistanceToNow(parseISO(maintenance[0].created_at), { addSuffix: true }),
        action: `Maintenance ${maintenance[0].status}`,
        user: maintenance[0].technician_name,
        location: asset ? `${asset.floor} - ${asset.room}` : 'Unknown'
      });
    }
    
    return activities.slice(0, 5);
  }, [usageLogs, maintenance, asset]);

  // Get next scheduled maintenance
  const nextMaintenance = useMemo(() => {
    const upcoming = maintenance
      .filter(m => m.status === 'scheduled' && m.scheduled_date && !isPast(parseISO(m.scheduled_date)))
      .sort((a, b) => parseISO(a.scheduled_date!).getTime() - parseISO(b.scheduled_date!).getTime());
    
    return upcoming[0];
  }, [maintenance]);

  const loading = assetsLoading || maintenanceLoading || usageLoading;
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dashboard-bg to-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!asset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dashboard-bg to-muted/20 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-4">Asset Not Found</h2>
          <p className="text-muted-foreground mb-4">The asset you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/inventory')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Asset Inventory
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dashboard-bg to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="hover:bg-muted/50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">{asset.name}</h1>
                <p className="text-sm text-muted-foreground">Asset ID: {asset.id}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            {canManage && (
              <div className="flex items-center gap-2">
                <AddMaintenanceDialog assetId={asset.id} />
                <EditAssetDialog asset={{ ...asset, location: `${asset.floor} - ${asset.room}` }} />
                <RetireAssetDialog assetId={asset.id} assetName={asset.name} />
                <DeleteAssetDialog assetId={asset.id} assetName={asset.name} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="movement">Movement</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-12 gap-6">
              {/* Left Panel - Asset Info */}
              <div className="col-span-12 lg:col-span-3">
                <Card className="p-6">
                  <div className="text-center mb-6">
                    {asset.image_url ? (
                      <img 
                        src={asset.image_url} 
                        alt={asset.name}
                        className="w-24 h-24 mx-auto rounded-lg object-cover mb-4"
                      />
                    ) : (
                      <div className="w-24 h-24 mx-auto bg-muted rounded-lg flex items-center justify-center mb-4">
                        <Activity className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <h3 className="font-semibold text-foreground">{asset.name}</h3>
                    <p className="text-sm text-muted-foreground">{asset.type}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asset ID</label>
                      <p className="text-sm font-medium text-foreground">{asset.id}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-primary" />
                        <p className="text-sm text-foreground">
                          {asset.status === 'untracked' 
                            ? '📍 Lokasi Tidak Diketahui' 
                            : `${asset.floor || '-'} - ${asset.room || '-'}`}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                      <div className="mt-1">
                        <Badge 
                          variant={statusConfig[asset.status]?.variant || 'secondary'}
                          className={asset.status === 'untracked' ? 'animate-pulse' : ''}
                        >
                          {statusConfig[asset.status]?.label || asset.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condition</label>
                      <p className={`text-sm font-medium mt-1 ${conditionConfig[asset.condition as keyof typeof conditionConfig].color}`}>
                        {conditionConfig[asset.condition as keyof typeof conditionConfig].label}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Center Panel - Activity Timeline & Usage */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                {/* Activity Timeline */}
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                   <CardContent className="px-0 pb-0">
                     {recentActivities.length > 0 ? (
                       <div className="space-y-4">
                         {recentActivities.map((activity, index) => (
                         <div key={index} className="flex gap-4">
                           <div className="flex flex-col items-center">
                             <div className="w-3 h-3 bg-primary rounded-full"></div>
                             {index < recentActivities.length - 1 && (
                               <div className="w-px h-8 bg-border mt-2"></div>
                             )}
                           </div>
                           <div className="flex-1 pb-4">
                             <div className="flex items-center justify-between">
                               <p className="font-medium text-foreground">{activity.action}</p>
                               <span className="text-xs text-muted-foreground">{activity.date}</span>
                             </div>
                             <p className="text-sm text-muted-foreground">by {activity.user}</p>
                             <p className="text-xs text-muted-foreground flex items-center gap-1">
                               <MapPin className="w-3 h-3" />
                               {activity.location}
                             </p>
                            </div>
                          </div>
                        ))}
                      </div>
                     ) : (
                       <div className="text-center py-8">
                         <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                         <p className="text-sm text-muted-foreground">No recent activity available</p>
                       </div>
                     )}
                   </CardContent>
                </Card>

                {/* Usage Statistics */}
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-success" />
                      Usage Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{usageStats.hoursToday.toFixed(1)}h</p>
                        <p className="text-xs text-muted-foreground">Today</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{usageStats.hoursWeek.toFixed(1)}h</p>
                        <p className="text-xs text-muted-foreground">This Week</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{usageStats.hoursMonth.toFixed(1)}h</p>
                        <p className="text-xs text-muted-foreground">This Month</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel - User & Maintenance */}
              <div className="col-span-12 lg:col-span-3 space-y-6">
                {/* Current User */}
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Current User
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                        <User className="w-6 h-6 text-muted-foreground" />
                      </div>
                      {activeBorrowRequest ? (
                        <>
                          <p className="font-medium text-foreground">
                            {activeBorrowRequest.students?.full_name || asset.last_user || 'Borrower'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Borrowed {borrowDuration}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {activeBorrowRequest.students?.nim || 'Active Loan'}
                          </Badge>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{asset.last_user || 'No user assigned'}</p>
                          <p className="text-xs text-muted-foreground">Not currently borrowed</p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Maintenance */}
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-warning" />
                      Maintenance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Next Scheduled</p>
                      {nextMaintenance ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(nextMaintenance.scheduled_date!), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No scheduled maintenance</p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Recent History</p>
                      {maintenance.slice(0, 2).length > 0 ? (
                        <div className="space-y-2">
                          {maintenance.slice(0, 2).map((record) => (
                            <div key={record.id} className="text-xs">
                              <p className="font-medium text-foreground">{record.maintenance_type}</p>
                              <p className="text-muted-foreground">
                                {format(parseISO(record.created_at), 'MMM dd, yyyy')} • {formatIDR(record.cost || 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No maintenance history</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts */}
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      Alerts
                    </CardTitle>
                  </CardHeader>
                   <CardContent className="px-0 pb-0">
                     {/* CRITICAL ALERT: Untracked/Lost Signal */}
                     {asset.status === 'untracked' && (
                       <Alert variant="destructive" className="mb-3 animate-pulse">
                         <Radio className="h-4 w-4" />
                         <AlertTitle>⚠️ Critical: Signal Lost!</AlertTitle>
                         <AlertDescription>
                           Asset tidak terdeteksi oleh gateway manapun. Periksa lokasi terakhir: {asset.room || 'Unknown'}.
                         </AlertDescription>
                       </Alert>
                     )}
                     
                     {/* Other status alerts */}
                     {(asset.status === 'maintenance' || asset.status === 'damaged' || asset.status === 'lost') && (
                       <div className="space-y-3">
                         <div className="flex gap-3">
                           <div className={`w-2 h-2 rounded-full mt-2 ${
                             asset.status === 'damaged' || asset.status === 'lost' ? 'bg-destructive' : 'bg-warning'
                           }`}></div>
                           <div className="flex-1">
                             <p className="text-sm text-foreground capitalize">Asset {asset.status}</p>
                             <p className="text-xs text-muted-foreground">
                               {asset.updated_at ? formatDistanceToNow(parseISO(asset.updated_at), { addSuffix: true }) : 'Unknown time'}
                             </p>
                           </div>
                         </div>
                       </div>
                     )}
                     
                     {/* No alerts state */}
                     {!['untracked', 'maintenance', 'damaged', 'lost'].includes(asset.status) && (
                       <div className="text-center py-4">
                         <p className="text-sm text-success">✓ No alerts at this time</p>
                       </div>
                     )}
                   </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Movement Timeline Tab */}
          <TabsContent value="movement" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <AssetMovementTimeline assetId={assetId!} assetName={asset?.name} />
              <AssetSignalChart assetId={assetId!} assetName={asset?.name} hoursBack={24} />
            </div>
          </TabsContent>

          {/* Weekly Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            <WeeklyUsage assetId={assetId} />
          </TabsContent>


          {/* History & Timeline Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Maintenance History
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete record of all maintenance activities for this asset
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {maintenance.length > 0 ? (
                  <div className="space-y-6">
                    {maintenance.map((record, index) => {
                      const Icon = record.status === 'completed' ? Wrench : 
                                   record.status === 'in_progress' ? Activity :
                                   Calendar;
                      const color = record.status === 'completed' ? 'text-success' :
                                    record.status === 'in_progress' ? 'text-primary' :
                                    'text-warning';
                      const bgColor = record.status === 'completed' ? 'bg-success/10' :
                                      record.status === 'in_progress' ? 'bg-primary/10' :
                                      'bg-warning/10';
                      
                      return (
                        <div key={record.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
                              <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            {index < maintenance.length - 1 && (
                              <div className="w-px h-full min-h-8 bg-border mt-2"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-foreground">{record.maintenance_type}</h4>
                                <Badge variant={record.status === 'completed' ? 'default' : 'outline'} className="mt-1">
                                  {record.status}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(record.created_at), 'MMM dd, yyyy')}
                              </span>
                            </div>
                            
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>Technician: {record.technician_name}</span>
                              </div>
                              
                              {record.scheduled_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>
                                    Scheduled: {format(parseISO(record.scheduled_date), 'MMM dd, yyyy')}
                                    {isPast(parseISO(record.scheduled_date)) && record.status === 'scheduled' && (
                                      <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>
                                    )}
                                  </span>
                                </div>
                              )}
                              
                              {record.completed_date && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>Completed: {format(parseISO(record.completed_date), 'MMM dd, yyyy')}</span>
                                </div>
                              )}
                              
                              {record.cost && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">Cost: {formatIDR(record.cost)}</span>
                                </div>
                              )}
                              
                              {record.description && (
                                <p className="mt-2 text-foreground">{record.description}</p>
                              )}
                              
                              {record.notes && (
                                <p className="mt-2 italic">Notes: {record.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Wrench className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">No maintenance history</p>
                    <p className="text-xs text-muted-foreground mt-1">This asset has no recorded maintenance activities</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}