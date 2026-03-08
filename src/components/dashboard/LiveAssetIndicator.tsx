import { Badge } from '@/components/ui/badge';
import { Signal, Clock, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { LiveAssetStatus } from '@/hooks/useBLETracking';
import { motion } from 'framer-motion';

interface LiveAssetIndicatorProps {
  status: LiveAssetStatus;
  compact?: boolean;
  showDetails?: boolean;
}

const signalStrengthConfig = {
  excellent: { bars: 4, color: 'text-success', label: 'Excellent' },
  good: { bars: 3, color: 'text-success', label: 'Good' },
  fair: { bars: 2, color: 'text-warning', label: 'Fair' },
  poor: { bars: 1, color: 'text-destructive', label: 'Poor' },
  offline: { bars: 0, color: 'text-muted-foreground', label: 'Offline' },
};

export function LiveAssetIndicator({ status, compact = false, showDetails = true }: LiveAssetIndicatorProps) {
  const signalConfig = signalStrengthConfig[status.signalQuality];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {status.isLive && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="relative"
          >
            <div className="w-2 h-2 rounded-full bg-success" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-success/30 animate-ping" />
          </motion.div>
        )}
        <Signal className={`w-3 h-3 ${signalConfig.color}`} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Live Status Badge */}
      {status.isLive ? (
        <Badge variant="outline" className="border-success text-success flex items-center gap-1.5 w-fit">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="relative"
          >
            <Radio className="w-3 h-3" />
            <motion.div
              animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.5, 0.8] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 w-3 h-3 rounded-full bg-success"
            />
          </motion.div>
          <span className="text-xs font-medium">LIVE</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1.5 w-fit">
          <Radio className="w-3 h-3" />
          <span className="text-xs">Offline</span>
        </Badge>
      )}

      {showDetails && (
        <>
          {/* Signal Strength */}
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5 h-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-sm transition-colors ${
                    i < signalConfig.bars
                      ? signalConfig.color.replace('text-', 'bg-')
                      : 'bg-muted'
                  }`}
                  style={{ height: `${(i + 1) * 25}%` }}
                />
              ))}
            </div>
            <div className="flex flex-col">
              <span className={`text-xs font-medium ${signalConfig.color}`}>
                {signalConfig.label}
              </span>
              {status.rssi && (
                <span className="text-[10px] text-muted-foreground">
                  {status.rssi} dBm
                </span>
              )}
            </div>
          </div>

          {/* Last Seen */}
          {status.lastSeen && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>
                {formatDistanceToNow(new Date(status.lastSeen), { addSuffix: true })}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LiveAssetBadge({ status }: { status: LiveAssetStatus }) {
  if (!status.isLive) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 z-10"
    >
      <div className="relative">
        <Badge className="bg-success text-success-foreground text-[10px] px-1.5 py-0.5 shadow-lg">
          LIVE
        </Badge>
        <motion.div
          animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.5, 0.8] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-full bg-success/50 blur-sm"
        />
      </div>
    </motion.div>
  );
}
