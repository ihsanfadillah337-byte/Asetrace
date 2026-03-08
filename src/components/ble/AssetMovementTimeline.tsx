import { useMemo } from 'react';
import { useMovementHistory, MovementRecord } from '@/hooks/useMovementHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssetLocations } from '@/hooks/useAssetLocations';
import { 
  MapPin, 
  Clock, 
  ArrowRight, 
  Radio, 
  AlertTriangle,
  Navigation,
  Timer,
  Signal,
  SignalZero,
  Footprints
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns';
import { motion } from 'framer-motion';

interface AssetMovementTimelineProps {
  assetId: string;
  assetName?: string;
}

interface MovementWithDwell extends MovementRecord {
  dwellTime?: string;
  dwellMinutes?: number;
}

export function AssetMovementTimeline({ assetId, assetName }: AssetMovementTimelineProps) {
  const { movements, loading } = useMovementHistory({ assetId, limit: 30 });
  const { getAssetLocation } = useAssetLocations();
  
  const currentLocation = getAssetLocation(assetId);

  // Calculate dwell time between movements
  const movementsWithDwell = useMemo((): MovementWithDwell[] => {
    if (movements.length === 0) return [];
    
    return movements.map((movement, index) => {
      let dwellTime: string | undefined;
      let dwellMinutes: number | undefined;
      
      // Calculate how long it stayed before moving again
      if (index > 0) {
        const nextMovement = movements[index - 1];
        const currentTime = new Date(movement.moved_at);
        const nextTime = new Date(nextMovement.moved_at);
        const minutesDiff = differenceInMinutes(nextTime, currentTime);
        dwellMinutes = minutesDiff;
        
        if (minutesDiff < 60) {
          dwellTime = `${minutesDiff} min`;
        } else {
          const hoursDiff = differenceInHours(nextTime, currentTime);
          const remainingMins = minutesDiff % 60;
          dwellTime = `${hoursDiff}h ${remainingMins}m`;
        }
      }
      
      return { ...movement, dwellTime, dwellMinutes };
    });
  }, [movements]);

  const getSignalQuality = (rssi: number | null) => {
    if (rssi === null) return { label: 'Unknown', color: 'text-muted-foreground', icon: SignalZero };
    if (rssi > -60) return { label: 'Strong', color: 'text-success', icon: Signal };
    if (rssi > -70) return { label: 'Good', color: 'text-primary', icon: Signal };
    if (rssi > -85) return { label: 'Fair', color: 'text-warning', icon: Signal };
    return { label: 'Weak', color: 'text-destructive', icon: AlertTriangle };
  };

  const isFromLostSignal = (fromRoomName: string | null) => {
    return fromRoomName?.toLowerCase().includes('lost signal');
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Footprints className="w-5 h-5 text-primary" />
              Movement Timeline
            </CardTitle>
            <CardDescription className="mt-1">
              Real-time tracking history for {assetName || 'this asset'}
            </CardDescription>
          </div>
          
          <Badge variant="outline" className="text-xs">
            {movements.length} movements recorded
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        <ScrollArea className="h-[450px] pr-4">
          <div className="relative pl-2">
            {/* Vertical timeline line */}
            <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-border to-transparent" />
            
            {/* Current Location - Always at top with pulsing effect */}
            {currentLocation && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative flex gap-4 pb-8"
              >
                <div className="relative z-10">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-10 h-10 rounded-full bg-success flex items-center justify-center shadow-lg ring-4 ring-success/20"
                  >
                    <Radio className="w-5 h-5 text-success-foreground animate-pulse" />
                  </motion.div>
                  {/* Pulse rings */}
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-success/30"
                  />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="default" className="bg-success text-success-foreground gap-1">
                      <Navigation className="w-3 h-3" />
                      Current Location
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-success/5">
                      LIVE
                    </Badge>
                  </div>
                  <p className="font-semibold text-foreground text-lg">
                    {currentLocation.room?.room_name || 'Unknown Room'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(currentLocation.updated_at), { addSuffix: true })}
                    </span>
                    {currentLocation.rssi && (
                      <span className={`flex items-center gap-1 ${getSignalQuality(currentLocation.rssi).color}`}>
                        <Signal className="w-3 h-3" />
                        {currentLocation.rssi} dBm ({currentLocation.confidence || 'unknown'})
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Movement History Items */}
            {movementsWithDwell.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No movement history recorded</p>
                <p className="text-sm mt-1">Asset location changes will appear here as they are detected</p>
              </div>
            ) : (
              movementsWithDwell.map((movement, index) => {
                const isRecovery = isFromLostSignal(movement.from_room_name);
                const signalQuality = getSignalQuality(movement.rssi);
                const isLatest = index === 0 && !currentLocation;
                
                return (
                  <motion.div 
                    key={movement.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative flex gap-4 pb-6 group"
                  >
                    {/* Timeline Node */}
                    <div className="relative z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all group-hover:scale-110 ${
                        isRecovery
                          ? 'bg-success ring-2 ring-success/30'
                          : isLatest 
                            ? 'bg-primary ring-2 ring-primary/30' 
                            : 'bg-card border-2 border-border'
                      }`}>
                        {isRecovery ? (
                          <Radio className="w-4 h-4 text-success-foreground" />
                        ) : (
                          <ArrowRight className={`w-4 h-4 ${
                            isLatest ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`} />
                        )}
                      </div>
                    </div>
                    
                    {/* Movement Content */}
                    <div className="flex-1 pt-1">
                      {/* Recovery Badge */}
                      {isRecovery && (
                        <Badge variant="outline" className="mb-2 bg-success/10 text-success border-success/30 text-xs">
                          ✓ Signal Recovered
                        </Badge>
                      )}
                      
                      {/* From -> To */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-sm ${
                          isFromLostSignal(movement.from_room_name) 
                            ? 'text-destructive font-medium' 
                            : 'text-muted-foreground'
                        }`}>
                          {isFromLostSignal(movement.from_room_name) ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Lost Signal
                            </span>
                          ) : (
                            movement.from_room_name || 'Unknown'
                          )}
                        </span>
                        <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-semibold text-foreground">
                          {movement.to_room_name || 'Unknown'}
                        </span>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(movement.moved_at), 'dd MMM, HH:mm')}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>
                          {formatDistanceToNow(new Date(movement.moved_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {/* Additional Details */}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                        {/* Dwell Time */}
                        {movement.dwellTime && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Timer className="w-3 h-3" />
                            Stayed: {movement.dwellTime}
                          </Badge>
                        )}
                        
                        {/* Signal Strength */}
                        {movement.rssi && (
                          <Badge variant="outline" className={`gap-1 text-xs ${signalQuality.color}`}>
                            <signalQuality.icon className="w-3 h-3" />
                            {movement.rssi} dBm
                          </Badge>
                        )}
                        
                        {/* Gateway */}
                        {movement.detected_by && (
                          <span className="text-muted-foreground">
                            via {movement.detected_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
