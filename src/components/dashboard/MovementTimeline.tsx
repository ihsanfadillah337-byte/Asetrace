import { useMovementHistory } from '@/hooks/useMovementHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, ArrowRight, Radio, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAssetLocations } from '@/hooks/useAssetLocations';

interface MovementTimelineProps {
  assetId: string;
  assetName?: string;
}

export function MovementTimeline({ assetId, assetName }: MovementTimelineProps) {
  const { movements, loading } = useMovementHistory({ assetId, limit: 20 });
  const { getAssetLocation } = useAssetLocations();
  
  const currentLocation = getAssetLocation(assetId);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-5 h-5 text-primary" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-primary" />
          Movement History
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tracking history untuk {assetName || 'asset ini'}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-border" />
            
            {/* Current Location - Always at top */}
            {currentLocation && (
              <div className="relative flex gap-4 pb-6">
                <div className="relative z-10">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-lg ring-4 ring-success/20">
                    <Radio className="w-3 h-3 text-success-foreground animate-pulse" />
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="bg-success text-success-foreground">
                      Current Location
                    </Badge>
                  </div>
                  <p className="font-semibold text-foreground">
                    {currentLocation.room?.room_name || 'Unknown Room'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      Last seen {formatDistanceToNow(new Date(currentLocation.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                  {currentLocation.rssi && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Signal: {currentLocation.rssi} dBm ({currentLocation.confidence || 'unknown'} confidence)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Movement History Items */}
            {movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No movement history recorded</p>
                <p className="text-xs mt-1">Asset tracking data will appear here</p>
              </div>
            ) : (
              movements.map((movement, index) => (
                <div key={movement.id} className="relative flex gap-4 pb-6">
                  <div className="relative z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
                      index === 0 && !currentLocation ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted border-2 border-border'
                    }`}>
                      <ArrowRight className={`w-3 h-3 ${
                        index === 0 && !currentLocation ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm text-muted-foreground">
                        {movement.from_room_name || 'Unknown'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-foreground">
                        {movement.to_room_name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {format(new Date(movement.moved_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>
                        {formatDistanceToNow(new Date(movement.moved_at), { addSuffix: true })}
                      </span>
                    </div>
                    {movement.detected_by && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Detected by: {movement.detected_by}
                        {movement.rssi && ` (${movement.rssi} dBm)`}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
