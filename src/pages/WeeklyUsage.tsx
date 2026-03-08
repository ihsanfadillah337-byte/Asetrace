import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TrendingUp, Calendar, TrendingDown, Loader2 } from 'lucide-react';
import { useAssetUsage } from '@/hooks/useAssetUsage';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useState } from 'react';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, isWithinInterval } from 'date-fns';
import { AddUsageDialog } from '@/components/usage/AddUsageDialog';
import { useBorrowRequests } from '@/hooks/useBorrowRequests';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WeeklyUsageProps {
  assetId?: string;
}

const WeeklyUsage = ({ assetId }: WeeklyUsageProps) => {
  const { logs, loading } = useAssetUsage(assetId);
  const { requests } = useBorrowRequests();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['admin', 'operator']);
  const [period, setPeriod] = useState('this-week');
  const usageData = useMemo(() => {
    const now = new Date();
    let weekStart: Date;
    let weekEnd: Date;

    if (period === 'last-week') {
      weekStart = startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
      weekEnd = endOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
    } else {
      weekStart = startOfWeek(now, { weekStartsOn: 1 });
      weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    }

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return days.map(day => {
      const dayLogs = logs.filter(log => {
        const logDate = parseISO(log.started_at);
        return format(logDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      
      const totalHours = dayLogs.reduce((sum, log) => sum + (log.duration_hours || 0), 0);
      const usagePercentage = Math.min(Math.round((totalHours / 24) * 100), 100);
      
      return {
        day: format(day, 'EEE'),
        usage: usagePercentage,
        hours: totalHours,
        sessions: dayLogs.length
      };
    });
  }, [logs, period]);

  const stats = useMemo(() => {
    const avgUsage = usageData.reduce((sum, d) => sum + d.usage, 0) / usageData.length;
    const peakDay = usageData.reduce((max, d) => d.usage > max.usage ? d : max, usageData[0]);
    const lowestDay = usageData.reduce((min, d) => d.usage < min.usage ? d : min, usageData[0]);
    
    return {
      average: Math.round(avgUsage),
      peakDay: peakDay?.day || 'N/A',
      lowestDay: lowestDay?.day || 'N/A',
      totalSessions: usageData.reduce((sum, d) => sum + d.sessions, 0)
    };
  }, [usageData]);

  if (loading) {
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
            <h2 className="text-3xl font-bold text-foreground">Weekly Usage</h2>
            <p className="text-muted-foreground mt-1">Asset usage trends throughout the week</p>
          </div>
          {canManage && <AddUsageDialog />}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Average Weekly Usage"
          value={`${stats.average}%`}
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Peak Day"
          value={stats.peakDay}
          icon={Calendar}
          variant="success"
        />
        <MetricCard
          title="Lowest Day"
          value={stats.lowestDay}
          icon={TrendingDown}
          variant="warning"
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Usage Percentage</h3>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={usageData}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis hide />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold text-foreground">{data.day}</p>
                        <p className="text-sm text-muted-foreground">Usage: {data.usage}%</p>
                        <p className="text-sm text-muted-foreground">Hours: {data.hours.toFixed(1)}h</p>
                        <p className="text-sm text-muted-foreground">Sessions: {data.sessions}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
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

      {!assetId && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Borrow Activities</CardTitle>
            <CardDescription>Latest asset borrowing and return activities</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.filter(r => r.status === 'Approved' || r.status === 'Returned').length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No borrow activities yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Borrow Date</TableHead>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests
                    .filter(r => r.status === 'Approved' || r.status === 'Returned')
                    .slice(0, 10)
                    .map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.students?.full_name}</TableCell>
                        <TableCell>{request.assets?.name}</TableCell>
                        <TableCell>{format(new Date(request.tanggal_pinjam), "PPP")}</TableCell>
                        <TableCell>{format(new Date(request.tanggal_kembali), "PPP")}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              request.status === 'Returned'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-green-50 text-green-700'
                            }
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyUsage;
