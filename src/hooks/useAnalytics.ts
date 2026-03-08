import { useMemo } from 'react';
import { useAssets } from './useAssets';
import { useMaintenanceHistory } from './useMaintenanceHistory';
import { useAssetUsage } from './useAssetUsage';
import { 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  format, 
  isWithinInterval,
  subMonths
} from 'date-fns';

export function useAnalytics(startDate?: Date, endDate?: Date) {
  const { assets } = useAssets();
  const { records: maintenanceRecords } = useMaintenanceHistory();
  const { logs: usageLogs } = useAssetUsage();

  // Default to last 6 months if no dates provided
  const dateRange = useMemo(() => {
    const end = endDate || new Date();
    const start = startDate || subMonths(end, 5);
    return { start, end };
  }, [startDate, endDate]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const distribution = assets.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Active', value: distribution.active || 0, color: 'hsl(var(--success))' },
      { name: 'Idle', value: distribution.idle || 0, color: 'hsl(var(--warning))' },
      { name: 'Maintenance', value: distribution.maintenance || 0, color: 'hsl(var(--primary))' },
      { name: 'Damaged', value: distribution.damaged || 0, color: 'hsl(var(--destructive))' },
      { name: 'Lost', value: distribution.lost || 0, color: 'hsl(var(--muted))' },
    ];
  }, [assets]);

  // Monthly usage trends
  const usageTrends = useMemo(() => {
    const months = eachMonthOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Count assets by status for each month
      const monthData = assets.reduce((acc, asset) => {
        const assetDate = new Date(asset.created_at);
        if (assetDate <= monthEnd) {
          acc[asset.status] = (acc[asset.status] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        month: format(month, 'MMM'),
        active: monthData.active || 0,
        idle: monthData.idle || 0,
        maintenance: monthData.maintenance || 0,
      };
    });
  }, [assets, dateRange]);

  // Maintenance costs by month
  const maintenanceCosts = useMemo(() => {
    const months = eachMonthOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthRecords = maintenanceRecords.filter(record => {
        const recordDate = record.completed_date 
          ? new Date(record.completed_date)
          : record.scheduled_date 
          ? new Date(record.scheduled_date)
          : null;
        
        return recordDate && isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
      });

      const totalCost = monthRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
      
      return {
        month: format(month, 'MMM'),
        cost: totalCost,
        count: monthRecords.length,
      };
    });
  }, [maintenanceRecords, dateRange]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active').length;
    const totalAssets = assets.length;
    const totalValue = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
    
    const totalMaintenanceCost = maintenanceRecords
      .filter(r => r.completed_date)
      .reduce((sum, record) => sum + (record.cost || 0), 0);

    // Calculate utilization rate based on usage logs
    const utilizationRate = totalAssets > 0 
      ? ((activeAssets / totalAssets) * 100).toFixed(1)
      : '0.0';

    return {
      activeAssets,
      utilizationRate,
      maintenanceCost: totalMaintenanceCost,
      totalValue,
    };
  }, [assets, maintenanceRecords]);

  // Department utilization (simplified - based on asset category)
  const departmentUtilization = useMemo(() => {
    const categoryMap: Record<string, string> = {
      laptop: 'IT',
      server: 'IT',
      furniture: 'Operations',
      vehicle: 'Operations',
      other: 'General',
    };

    const deptStats = assets.reduce((acc, asset) => {
      const dept = categoryMap[asset.category] || 'General';
      if (!acc[dept]) {
        acc[dept] = { total: 0, active: 0 };
      }
      acc[dept].total++;
      if (asset.status === 'active') {
        acc[dept].active++;
      }
      return acc;
    }, {} as Record<string, { total: number; active: number }>);

    return Object.entries(deptStats).map(([department, stats]) => ({
      department,
      utilization: stats.total > 0 
        ? Math.round((stats.active / stats.total) * 100)
        : 0,
      assets: stats.total,
    }));
  }, [assets]);

  return {
    statusDistribution,
    usageTrends,
    maintenanceCosts,
    summaryMetrics,
    departmentUtilization,
  };
}
