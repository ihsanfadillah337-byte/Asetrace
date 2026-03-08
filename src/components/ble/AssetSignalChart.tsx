import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRssiHistory } from '@/hooks/useRssiHistory';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { Signal, SignalHigh, SignalLow, SignalZero, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AssetSignalChartProps {
  assetId: string;
  assetName?: string;
  hoursBack?: number;
}

export function AssetSignalChart({ assetId, assetName, hoursBack = 24 }: AssetSignalChartProps) {
  const { data, stats, loading, error } = useRssiHistory({ 
    assetId, 
    hoursBack,
    limit: 200 
  });

  const chartData = useMemo(() => {
    return data.map(point => ({
      time: format(new Date(point.timestamp), 'HH:mm'),
      fullTime: format(new Date(point.timestamp), 'HH:mm:ss'),
      date: format(new Date(point.timestamp), 'dd/MM'),
      rssi: point.rssi,
      receiver: point.receiver_id
    }));
  }, [data]);

  const lineColor = useMemo(() => {
    if (!stats) return 'hsl(var(--muted-foreground))';
    if (stats.average > -60) return 'hsl(var(--success))';
    if (stats.average > -70) return 'hsl(var(--primary))';
    if (stats.average > -85) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  }, [stats]);

  const gradientId = `rssi-gradient-${assetId}`;

  const getSignalIcon = () => {
    if (!stats) return SignalZero;
    if (stats.average > -60) return SignalHigh;
    if (stats.average > -70) return Signal;
    if (stats.average > -85) return SignalLow;
    return SignalZero;
  };

  const getTrendIcon = () => {
    if (chartData.length < 2) return Minus;
    const recent = chartData.slice(-10);
    const older = chartData.slice(0, 10);
    if (recent.length === 0 || older.length === 0) return Minus;
    
    const recentAvg = recent.reduce((a, b) => a + b.rssi, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.rssi, 0) / older.length;
    
    if (recentAvg > olderAvg + 3) return TrendingUp;
    if (recentAvg < olderAvg - 3) return TrendingDown;
    return Minus;
  };

  const SignalIcon = getSignalIcon();
  const TrendIcon = getTrendIcon();

  const qualityColors: Record<string, string> = {
    excellent: 'bg-success/10 text-success border-success/30',
    good: 'bg-primary/10 text-primary border-primary/30',
    fair: 'bg-warning/10 text-warning border-warning/30',
    weak: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    critical: 'bg-destructive/10 text-destructive border-destructive/30'
  };

  const qualityLabels: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    weak: 'Weak',
    critical: 'Critical'
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-destructive" />
            Signal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            <p className="text-sm">Error loading signal data: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SignalIcon className="w-5 h-5 text-primary" />
              Historical Signal Strength
            </CardTitle>
            <CardDescription className="mt-1">
              RSSI readings for {assetName || 'this asset'} over the last {hoursBack}h
            </CardDescription>
          </div>
          
          {stats && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={qualityColors[stats.signalQuality]}>
                {qualityLabels[stats.signalQuality]}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <TrendIcon className="w-3 h-3" />
                Avg: {stats.average} dBm
              </Badge>
              <Badge variant="outline" className="text-xs">
                {stats.dataPoints} readings
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <SignalZero className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No signal data available</p>
            <p className="text-xs mt-1">RSSI readings will appear here once the asset is detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Min</p>
                <p className="text-lg font-bold text-destructive">{stats?.min} dBm</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-bold" style={{ color: lineColor }}>{stats?.average} dBm</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="text-lg font-bold text-success">{stats?.max} dBm</p>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={lineColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                  
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  
                  <YAxis 
                    domain={[-100, -30]}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                    width={35}
                  />
                  
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const rssi = data.rssi;
                        let qualityText = 'Critical';
                        let qualityColor = 'text-destructive';
                        if (rssi > -60) { qualityText = 'Excellent'; qualityColor = 'text-success'; }
                        else if (rssi > -70) { qualityText = 'Good'; qualityColor = 'text-primary'; }
                        else if (rssi > -85) { qualityText = 'Fair'; qualityColor = 'text-warning'; }

                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-xs text-muted-foreground mb-1">
                              {data.date} at {data.fullTime}
                            </p>
                            <p className="text-lg font-bold" style={{ color: lineColor }}>
                              {rssi} dBm
                            </p>
                            <p className={`text-xs ${qualityColor}`}>{qualityText}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Gateway: {data.receiver}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {/* Signal Lost Threshold Reference Line */}
                  <ReferenceLine 
                    y={-90} 
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ 
                      value: "Signal Lost Threshold (-90 dBm)", 
                      position: "insideTopRight",
                      fill: "hsl(var(--destructive))",
                      fontSize: 11
                    }}
                  />
                  
                  {/* Weak Signal Warning Zone */}
                  <ReferenceLine 
                    y={-85} 
                    stroke="hsl(var(--warning))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    opacity={0.5}
                  />

                  {/* Area fill */}
                  <Area
                    type="monotone"
                    dataKey="rssi"
                    stroke="none"
                    fill={`url(#${gradientId})`}
                  />
                  
                  {/* Main Line */}
                  <Line 
                    type="monotone" 
                    dataKey="rssi" 
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      fill: lineColor,
                      stroke: 'hsl(var(--background))',
                      strokeWidth: 2
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-destructive" style={{ borderStyle: 'dashed' }} />
                <span>Signal Lost (-90 dBm)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: lineColor }} />
                <span>RSSI Value</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
