import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAssets } from '@/hooks/useAssets';
import { useRooms } from '@/hooks/useRooms';
import { useBLETracking } from '@/hooks/useBLETracking';
import { useBLEGateways } from '@/hooks/useBLEGateways';
import { useAssetLocations, TrackingStatus } from '@/hooks/useAssetLocations';
import { useFloorMapLayout } from '@/hooks/useFloorMapLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Laptop, 
  Server, 
  Sofa, 
  Car, 
  Package,
  MapPin,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
  Signal,
  SignalZero,
  CircleDot,
  Move,
  RotateCcw,
  Pencil
} from 'lucide-react';
import type { Asset } from '@/hooks/useAssets';
import { LiveAssetIndicator } from './LiveAssetIndicator';
import React from 'react';

type AssetCategory = 'laptop' | 'server' | 'furniture' | 'vehicle' | 'other';
type AssetStatus = 'active' | 'maintenance' | 'lost' | 'damaged' | 'idle';

const categoryIcons: Record<AssetCategory, typeof Package> = {
  laptop: Laptop,
  server: Server,
  furniture: Sofa,
  vehicle: Car,
  other: Package,
};

const statusConfig: Record<AssetStatus, { icon: typeof Package; color: string; label: string }> = {
  active: { color: 'text-green-500', icon: CheckCircle2, label: 'Active' },
  maintenance: { color: 'text-yellow-500', icon: Settings, label: 'Maintenance' },
  lost: { color: 'text-destructive', icon: AlertCircle, label: 'Lost' },
  damaged: { color: 'text-orange-500', icon: AlertCircle, label: 'Damaged' },
  idle: { color: 'text-muted-foreground', icon: CheckCircle2, label: 'Idle' }
};

const trackingStatusConfig: Record<TrackingStatus, { 
  icon: typeof Signal; color: string; bgColor: string; label: string; description: string;
}> = {
  tracked_active: { icon: Signal, color: 'text-green-500', bgColor: 'bg-green-500', label: 'Live Tracking', description: 'BLE signal active' },
  tracked_inactive: { icon: SignalZero, color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Tag Inactive', description: 'BLE tag off or out of range' },
  untracked: { icon: CircleDot, color: 'text-muted-foreground', bgColor: 'bg-muted-foreground', label: 'Untracked', description: 'No BLE tag assigned' }
};

// ── Drag state types ──
type DragMode = 'move' | 'resize';
interface DragState {
  roomId: string;
  mode: DragMode;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export function AssetMap() {
  const { assets } = useAssets();
  const { rooms } = useRooms();
  const { liveStatus } = useBLETracking();
  const { gateways } = useBLEGateways();
  const { locations, getAssetLocation, getTrackingStatus } = useAssetLocations();
  const { getLayout, updateLayout, resetLayout, hasOverride } = useFloorMapLayout();

  const [selectedFloor, setSelectedFloor] = useState('Lantai 1');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  // transient positions while dragging (roomId -> {x,y,w,h})
  const [transient, setTransient] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  const svgRef = useRef<SVGSVGElement>(null);

  // ── Floors ──
  const floors = useMemo(() => {
    const uniqueFloors = Array.from(new Set(rooms.map(r => r.floor))).sort();
    return uniqueFloors.length > 0 ? uniqueFloors : ['Lantai 1', 'Lantai 2', 'Lantai 3'];
  }, [rooms]);

  // ── Asset location map ──
  const assetRoomMap = useMemo(() => {
    const map = new Map<string, { roomId: string; floor: string; roomCode: string }>();
    locations.forEach(loc => {
      if (loc.room) {
        map.set(loc.asset_id, { roomId: loc.room_id, floor: loc.room.floor, roomCode: loc.room.room_code });
      }
    });
    return map;
  }, [locations]);

  // ── Floor stats ──
  const floorStats = useMemo(() => {
    const floorAssets = assets.filter(a => {
      const assetLoc = assetRoomMap.get(a.id);
      return (assetLoc?.floor || a.floor) === selectedFloor;
    });
    return {
      total: floorAssets.length,
      active: floorAssets.filter(a => a.status === 'active').length,
      maintenance: floorAssets.filter(a => a.status === 'maintenance').length,
      lostDamaged: floorAssets.filter(a => (a.status === 'lost' || a.status === 'damaged')).length,
      trackedActive: floorAssets.filter(a => getTrackingStatus(a) === 'tracked_active').length,
      trackedInactive: floorAssets.filter(a => getTrackingStatus(a) === 'tracked_inactive').length,
      untracked: floorAssets.filter(a => getTrackingStatus(a) === 'untracked').length
    };
  }, [assets, selectedFloor, assetRoomMap, getTrackingStatus]);

  const floorRooms = useMemo(() => rooms.filter(r => r.floor === selectedFloor), [rooms, selectedFloor]);

  const floorAssets = useMemo(() => {
    return assets.filter(a => {
      const assetLoc = assetRoomMap.get(a.id);
      return (assetLoc?.floor || a.floor) === selectedFloor;
    });
  }, [assets, selectedFloor, assetRoomMap]);

  const trackedActiveCount = useMemo(() => floorAssets.filter(a => getTrackingStatus(a) === 'tracked_active').length, [floorAssets, getTrackingStatus]);

  const onlineGatewaysCount = useMemo(() => gateways.filter(gw => gw.room?.floor === selectedFloor && gw.status === 'online').length, [gateways, selectedFloor]);

  const getRoomAssets = (roomId: string, roomCode: string) => {
    return assets.filter(asset => {
      const assetLoc = assetRoomMap.get(asset.id);
      if (assetLoc) return assetLoc.roomId === roomId || assetLoc.roomCode === roomCode;
      return asset.room_id === roomId || asset.room === roomCode;
    });
  };

  const SAFE_ZONE_KEYWORDS = ['admin', 'server', 'warehouse', 'storage'];
  
  const isGhostAsset = (asset: Asset, detectedRoomId: string | null, detectedRoomName: string | null): boolean => {
    if (!['active', 'idle'].includes(asset.status)) return false;
    if (!detectedRoomId) return false;
    if (asset.room_id === detectedRoomId) return false;
    const roomNameLower = (detectedRoomName || '').toLowerCase();
    if (SAFE_ZONE_KEYWORDS.some(keyword => roomNameLower.includes(keyword))) return false;
    return true;
  };

  const getGhostAssetsInRoom = (roomId: string, roomCode: string, roomName: string) => {
    const roomAssets = getRoomAssets(roomId, roomCode);
    return roomAssets.filter(asset => {
      const assetLoc = assetRoomMap.get(asset.id);
      return isGhostAsset(asset, assetLoc?.roomId || null, roomName);
    });
  };

  const getRoomStyle = (roomId: string, roomCode: string) => {
    const roomAssets = getRoomAssets(roomId, roomCode);
    const roomGateway = gateways.find(gw => gw.room?.id === roomId);
    const isOnline = roomGateway?.status === 'online';
    const isStale = roomGateway?.status === 'stale';
    const isOffline = !roomGateway || roomGateway.status === 'offline';
    const hasAssets = roomAssets.length > 0;
    const hasLost = roomAssets.some(a => a.status === 'lost');
    const hasDamaged = roomAssets.some(a => a.status === 'damaged');
    const hasMaintenance = roomAssets.some(a => a.status === 'maintenance');
    
    let fillColor = '', strokeColor = '', opacity = 1;
    if (isOffline) {
      fillColor = 'hsl(var(--muted))'; strokeColor = 'hsl(var(--border))'; opacity = 0.5;
    } else if (isStale) {
      fillColor = 'hsl(45 93% 47% / 0.15)'; strokeColor = 'hsl(45 93% 47%)'; opacity = 0.9;
    } else if (isOnline) {
      if (hasAssets) {
        if (hasLost) { fillColor = 'hsl(0 84% 60% / 0.2)'; strokeColor = 'hsl(0 84% 60%)'; }
        else if (hasDamaged) { fillColor = 'hsl(25 95% 53% / 0.2)'; strokeColor = 'hsl(25 95% 53%)'; }
        else if (hasMaintenance) { fillColor = 'hsl(45 93% 47% / 0.2)'; strokeColor = 'hsl(45 93% 47%)'; }
        else { fillColor = 'hsl(var(--primary) / 0.15)'; strokeColor = 'hsl(var(--primary))'; }
      } else {
        fillColor = 'hsl(var(--card))'; strokeColor = 'hsl(var(--border))';
      }
    }
    return { fillColor, strokeColor, opacity, hasAssets, isOnline, isStale, isOffline };
  };

  const getGatewayStatusIcon = (status: 'online' | 'stale' | 'offline') => {
    switch (status) { case 'online': return Wifi; case 'stale': return Wifi; case 'offline': return WifiOff; }
  };

  const getGatewayStatusColor = (status: 'online' | 'stale' | 'offline') => {
    switch (status) { case 'online': return 'fill-green-500'; case 'stale': return 'fill-yellow-500'; case 'offline': return 'fill-gray-400'; }
  };

  // ── Get effective layout (transient during drag, else from hook) ──
  const getEffectiveLayout = useCallback((roomId: string, dbX: number | null, dbY: number | null) => {
    if (transient[roomId]) return transient[roomId];
    return getLayout(roomId, dbX, dbY);
  }, [transient, getLayout]);

  // ── SVG coordinate helpers ──
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  // ── Mouse handlers for drag/resize ──
  const handleMouseDown = useCallback((e: React.MouseEvent, roomId: string, mode: DragMode, layout: { x: number; y: number; w: number; h: number }) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = svgPoint(e.clientX, e.clientY);
    setDragState({
      roomId, mode,
      startMouseX: pt.x, startMouseY: pt.y,
      startX: layout.x, startY: layout.y,
      startW: layout.w, startH: layout.h,
    });
  }, [editMode, svgPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    const pt = svgPoint(e.clientX, e.clientY);
    const dx = pt.x - dragState.startMouseX;
    const dy = pt.y - dragState.startMouseY;

    if (dragState.mode === 'move') {
      setTransient(prev => ({
        ...prev,
        [dragState.roomId]: {
          x: Math.max(0, dragState.startX + dx),
          y: Math.max(0, dragState.startY + dy),
          w: dragState.startW,
          h: dragState.startH,
        }
      }));
    } else {
      setTransient(prev => ({
        ...prev,
        [dragState.roomId]: {
          x: dragState.startX,
          y: dragState.startY,
          w: Math.max(60, dragState.startW + dx),
          h: Math.max(40, dragState.startH + dy),
        }
      }));
    }
  }, [dragState, svgPoint]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    const final = transient[dragState.roomId];
    if (final) {
      const room = rooms.find(r => r.id === dragState.roomId);
      updateLayout(dragState.roomId, final, room?.position_x ?? null, room?.position_y ?? null);
    }
    setDragState(null);
    setTransient(prev => {
      const next = { ...prev };
      delete next[dragState.roomId];
      return next;
    });
  }, [dragState, transient, rooms, updateLayout]);

  // ── Dynamic viewBox ──
  const viewBox = useMemo(() => {
    if (floorRooms.length === 0) return '0 0 550 300';
    let maxRight = 550, maxBottom = 300;
    floorRooms.forEach(room => {
      const layout = getEffectiveLayout(room.id, room.position_x, room.position_y);
      maxRight = Math.max(maxRight, layout.x + layout.w + 30);
      maxBottom = Math.max(maxBottom, layout.y + layout.h + 30);
    });
    return `0 0 ${Math.ceil(maxRight)} ${Math.ceil(maxBottom)}`;
  }, [floorRooms, getEffectiveLayout]);

  const hasAnyOverride = useMemo(() => floorRooms.some(r => hasOverride(r.id)), [floorRooms, hasOverride]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Live Asset Tracking
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time asset location monitoring via BLE
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gateways.filter(gw => gw.room?.floor === selectedFloor).length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Radio className="h-3 w-3 text-blue-500" />
                  {gateways.filter(gw => gw.room?.floor === selectedFloor && gw.status === 'online').length}/
                  {gateways.filter(gw => gw.room?.floor === selectedFloor).length} Gateways
                </Badge>
              )}
              {trackedActiveCount > 0 && (
                <Badge className="gap-1 bg-green-500">
                  <Signal className="h-3 w-3 animate-pulse" />
                  {trackedActiveCount} LIVE
                </Badge>
              )}
              {floorStats.trackedInactive > 0 && (
                <Badge variant="secondary" className="gap-1 bg-amber-500 text-white">
                  <SignalZero className="h-3 w-3" />
                  {floorStats.trackedInactive} Inactive
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Floor Selector + Controls */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Tabs value={selectedFloor} onValueChange={setSelectedFloor}>
                <TabsList>
                  {floors.map(floor => (
                    <TabsTrigger key={floor} value={floor}>{floor}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-2">
                {/* Edit Mode Toggle */}
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setEditMode(!editMode); setDragState(null); setTransient({}); }}
                  className="gap-1.5"
                >
                  {editMode ? <Pencil className="h-3.5 w-3.5" /> : <Move className="h-3.5 w-3.5" />}
                  {editMode ? 'Done' : 'Edit Layout'}
                </Button>

                {/* Reset Layout */}
                {hasAnyOverride && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetLayout(floorRooms.map(r => r.id))}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}

                {/* Zoom Controls */}
                <Button variant="outline" size="icon" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} disabled={zoom <= 0.5}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="outline" size="icon" onClick={() => setZoom(Math.min(2, zoom + 0.1))} disabled={zoom >= 2}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Edit Mode Banner */}
            {editMode && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary">
                <Move className="h-4 w-4 shrink-0" />
                <span><strong>Edit Mode</strong> — Drag rooms to reposition. Drag the corner handle to resize.</span>
              </div>
            )}

            {/* Floor Plan */}
            <div className="border rounded-lg p-4 pb-12 bg-muted/30 overflow-auto min-h-[400px]">
              <svg 
                ref={svgRef}
                className="w-full"
                viewBox={viewBox}
                style={{ 
                  transform: `scale(${zoom})`, 
                  transformOrigin: 'top left',
                  cursor: editMode ? (dragState ? (dragState.mode === 'move' ? 'grabbing' : 'nwse-resize') : 'default') : 'default'
                }}
                onMouseMove={editMode ? handleMouseMove : undefined}
                onMouseUp={editMode ? handleMouseUp : undefined}
                onMouseLeave={editMode ? handleMouseUp : undefined}
              >
                {/* Room rectangles */}
                {floorRooms.length === 0 ? (
                  <text x="275" y="125" className="fill-muted-foreground text-sm" textAnchor="middle" dominantBaseline="middle">
                    No rooms configured for this floor
                  </text>
                ) : (
                  floorRooms.map(room => {
                    const roomAssets = getRoomAssets(room.id, room.room_code);
                    const roomStyle = getRoomStyle(room.id, room.room_code);
                    const ghostAssets = getGhostAssetsInRoom(room.id, room.room_code, room.room_name);
                    const hasGhostAssets = ghostAssets.length > 0;
                    
                    const trackedActiveInRoom = roomAssets.filter(a => getTrackingStatus(a) === 'tracked_active').length;
                    const trackedInactiveInRoom = roomAssets.filter(a => getTrackingStatus(a) === 'tracked_inactive').length;
                    const untrackedInRoom = roomAssets.filter(a => getTrackingStatus(a) === 'untracked').length;
                    
                    const layout = getEffectiveLayout(room.id, room.position_x, room.position_y);
                    const { x: posX, y: posY, w: roomW, h: roomH } = layout;
                    const isDragging = dragState?.roomId === room.id;

                    // The room group content (shared between edit & view mode)
                    const roomContent = (
                      <g
                        style={{ opacity: roomStyle.opacity }}
                        className={editMode ? '' : 'cursor-pointer transition-all duration-200'}
                      >
                        {/* Glow for rooms with assets */}
                        {roomStyle.hasAssets && roomStyle.isOnline && (
                          <rect
                            x={posX - 2} y={posY - 2}
                            width={roomW + 4} height={roomH + 4}
                            fill={roomStyle.strokeColor} opacity="0.15" rx="6" filter="blur(4px)"
                          />
                        )}
                        
                        {/* Main room rectangle */}
                        <rect
                          x={posX} y={posY}
                          width={roomW} height={roomH}
                          fill={roomStyle.fillColor}
                          stroke={editMode ? 'hsl(var(--primary))' : roomStyle.strokeColor}
                          strokeWidth={roomStyle.hasAssets ? "2.5" : "1.5"}
                          strokeDasharray={editMode ? '6 3' : 'none'}
                          rx="6"
                          style={editMode ? { cursor: isDragging && dragState?.mode === 'move' ? 'grabbing' : 'grab' } : undefined}
                          onMouseDown={editMode ? (e) => handleMouseDown(e, room.id, 'move', layout) : undefined}
                        />
                        
                        {/* Asset count */}
                        <text x={posX + roomW / 2} y={posY + roomH * 0.38} className={roomStyle.hasAssets ? 'fill-foreground' : 'fill-muted-foreground'} fontSize="18" fontWeight="700" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                          {roomAssets.length}
                        </text>
                        <text x={posX + roomW / 2} y={posY + roomH * 0.58} className="fill-muted-foreground" fontSize="9" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                          {roomAssets.length === 1 ? 'asset' : 'assets'}
                        </text>
                        
                        {/* Room code */}
                        <text x={posX + roomW / 2} y={posY + roomH * 0.82} fill={roomStyle.isOnline ? '#64748b' : '#475569'} fontSize="10" fontWeight="500" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                          {room.room_code}
                        </text>
                        
                        {/* Online status indicator */}
                        {roomStyle.isOnline && <circle cx={posX + 8} cy={posY + 8} r="4" fill="#22c55e" opacity="0.9" />}
                        {roomStyle.isStale && <circle cx={posX + 8} cy={posY + 8} r="4" fill="#eab308" opacity="0.9" />}
                        
                        {/* Live tracking indicator */}
                        {trackedActiveInRoom > 0 && (
                          <g>
                            <circle cx={posX + roomW - 8} cy={posY + 8} r="9" fill="#22c55e" />
                            <circle cx={posX + roomW - 8} cy={posY + 8} r="12" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.4" className="animate-ping" style={{ transformOrigin: `${posX + roomW - 8}px ${posY + 8}px` }} />
                            <text x={posX + roomW - 8} y={posY + 8} fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>{trackedActiveInRoom}</text>
                          </g>
                        )}
                        
                        {/* Inactive tracking indicator */}
                        {trackedInactiveInRoom > 0 && (
                          <g>
                            <circle cx={posX + roomW - (trackedActiveInRoom > 0 ? 24 : 8)} cy={posY + 8} r="8" fill="#f59e0b" />
                            <text x={posX + roomW - (trackedActiveInRoom > 0 ? 24 : 8)} y={posY + 8} fill="#ffffff" fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>{trackedInactiveInRoom}</text>
                          </g>
                        )}
                        
                        {/* Ghost asset warning */}
                        {hasGhostAssets && (
                          <g className="animate-pulse">
                            <polygon points={`${posX + 12},${posY + roomH - 14} ${posX + 2},${posY + roomH} ${posX + 22},${posY + roomH}`} fill="#ef4444" opacity="0.3" filter="blur(3px)" />
                            <polygon points={`${posX + 12},${posY + roomH - 12} ${posX + 4},${posY + roomH - 2} ${posX + 20},${posY + roomH - 2}`} fill="#ef4444" stroke="#ffffff" strokeWidth="0.5" />
                            <text x={posX + 12} y={posY + roomH - 4} fill="#ffffff" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>!</text>
                            <title>⚠️ Ghost Asset: {ghostAssets.length} aset tidak di posisi seharusnya</title>
                          </g>
                        )}

                        {/* ── RESIZE HANDLE (Edit Mode only) ── */}
                        {editMode && (
                          <g>
                            {/* Corner triangle indicator */}
                            <polygon
                              points={`${posX + roomW},${posY + roomH - 12} ${posX + roomW},${posY + roomH} ${posX + roomW - 12},${posY + roomH}`}
                              fill="hsl(var(--primary))"
                              opacity="0.6"
                              style={{ cursor: 'nwse-resize' }}
                              onMouseDown={(e) => handleMouseDown(e, room.id, 'resize', layout)}
                            />
                            {/* Invisible larger hit area for easier grabbing */}
                            <rect
                              x={posX + roomW - 16} y={posY + roomH - 16}
                              width="16" height="16"
                              fill="transparent"
                              style={{ cursor: 'nwse-resize' }}
                              onMouseDown={(e) => handleMouseDown(e, room.id, 'resize', layout)}
                            />
                          </g>
                        )}
                      </g>
                    );

                    // In edit mode, no popover; in view mode, wrap with Popover
                    if (editMode) {
                      return <g key={room.id}>{roomContent}</g>;
                    }

                    return (
                      <Popover key={room.id}>
                        <PopoverTrigger asChild>{roomContent}</PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{room.room_name}</h4>
                              <Button variant="outline" size="sm" onClick={() => setSelectedRoom(room.id)}>View Details</Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="flex items-center gap-1"><Signal className="h-3 w-3 text-green-500" /><span className="text-xs">{trackedActiveInRoom} Live</span></div>
                              <div className="flex items-center gap-1"><SignalZero className="h-3 w-3 text-amber-500" /><span className="text-xs">{trackedInactiveInRoom} Inactive</span></div>
                              <div className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{untrackedInRoom} Untracked</span></div>
                            </div>
                            {roomAssets.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Assets:</p>
                                {roomAssets.slice(0, 4).map(asset => {
                                  const trackingStatus = getTrackingStatus(asset);
                                  const trackingConfig = trackingStatusConfig[trackingStatus];
                                  const assetLoc = getAssetLocation(asset.id);
                                  const TrackingIcon = trackingConfig.icon;
                                  return (
                                    <div key={asset.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/50">
                                      <div className="flex items-center gap-2">
                                        {React.createElement(categoryIcons[asset.category] || Package, { className: "h-3 w-3" })}
                                        <span className="font-medium">{asset.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <TrackingIcon className={`h-3 w-3 ${trackingConfig.color}`} />
                                        <span className={`text-[10px] ${trackingConfig.color}`}>
                                          {trackingStatus === 'tracked_active' ? 'Live' : trackingStatus === 'tracked_inactive' ? 'Inactive' : 'No Tag'}
                                        </span>
                                        {assetLoc && trackingStatus !== 'untracked' && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">{assetLoc.rssi}dBm</Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })
                )}

                {/* Gateway Markers */}
                {gateways
                  .filter(gw => gw.room?.floor === selectedFloor)
                  .map(gateway => {
                    // Use the room's effective layout for gateway position
                    const gwRoom = rooms.find(r => r.id === gateway.room?.id);
                    const gwLayout = gwRoom ? getEffectiveLayout(gwRoom.id, gwRoom.position_x, gwRoom.position_y) : null;
                    const x = gwLayout ? gwLayout.x : (gateway.room?.position_x || 0);
                    const y = gwLayout ? gwLayout.y : (gateway.room?.position_y || 0);
                    const StatusIcon = getGatewayStatusIcon(gateway.status);
                    
                    return (
                      <g key={gateway.receiver_id}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <g className="cursor-pointer hover:opacity-80 transition-opacity">
                              <circle cx={x} cy={y} r="12" className={getGatewayStatusColor(gateway.status)} opacity="0.9" />
                              <g transform={`translate(${x - 8}, ${y - 8})`}>
                                {React.createElement(StatusIcon, { className: "text-white", width: 16, height: 16 })}
                              </g>
                              {gateway.status === 'online' && <circle cx={x + 8} cy={y - 8} r="4" className="fill-green-500 animate-pulse" />}
                              {gateway.status === 'stale' && <circle cx={x + 8} cy={y - 8} r="4" className="fill-yellow-500" />}
                            </g>
                          </PopoverTrigger>
                          <PopoverContent className="w-64">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2"><Radio className="h-4 w-4" />{gateway.receiver_id}</h4>
                                <Badge variant={gateway.status === 'online' ? "default" : gateway.status === 'stale' ? "secondary" : "outline"} className={gateway.status === 'online' ? 'bg-green-500' : gateway.status === 'stale' ? 'bg-yellow-500' : ''}>
                                  {gateway.status === 'online' ? "Online" : gateway.status === 'stale' ? "Stale" : "Offline"}
                                </Badge>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-muted-foreground" /><span>{gateway.room?.room_name || 'Unknown Room'}</span></div>
                                <div className="text-muted-foreground">Scans: {gateway.scanCount}</div>
                                {gateway.lastSeen && <div className="text-muted-foreground text-xs">Last seen: {new Date(gateway.lastSeen).toLocaleTimeString()}</div>}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </g>
                    );
                  })}
              </svg>
              
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Gateway:</span>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span>Online</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span>Stale</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /><span>Offline</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Room:</span>
                  <div className="flex items-center gap-1"><span className="w-4 h-2.5 rounded-sm bg-primary/20 border border-primary" /><span>Has Assets</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-2.5 rounded-sm bg-card border border-border" /><span>Empty</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Tracking:</span>
                  <div className="flex items-center gap-1"><Signal className="w-3 h-3 text-green-500" /><span>Live</span></div>
                  <div className="flex items-center gap-1"><SignalZero className="w-3 h-3 text-amber-500" /><span>Inactive</span></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Assets</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{floorStats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><div className="text-2xl font-bold">{floorStats.active}</div></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Maintenance</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Settings className="h-4 w-4 text-yellow-500" /><div className="text-2xl font-bold">{floorStats.maintenance}</div></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Lost/Damaged</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><div className="text-2xl font-bold">{floorStats.lostDamaged}</div></div></CardContent>
        </Card>
      </div>

      {/* Room Details Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRoom && rooms.find(r => r.id === selectedRoom)?.room_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {selectedRoom && (() => {
                const room = rooms.find(r => r.id === selectedRoom);
                const roomAssets = room ? getRoomAssets(room.id, room.room_code) : [];
                if (roomAssets.length === 0) {
                  return <div className="text-center py-8 text-muted-foreground">No assets in this room</div>;
                }
                return roomAssets.map(asset => {
                  const StatusIcon = statusConfig[asset.status]?.icon || Package;
                  const trackingStatus = getTrackingStatus(asset);
                  const trackingConfig = trackingStatusConfig[trackingStatus];
                  const TrackingIcon = trackingConfig.icon;
                  const assetLoc = getAssetLocation(asset.id);
                  return (
                    <Card key={asset.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {React.createElement(categoryIcons[asset.category] || Package, { className: "h-5 w-5 text-primary mt-1" })}
                            <div>
                              <div className="font-semibold">{asset.name}</div>
                              <div className="text-sm text-muted-foreground">{asset.type}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <StatusIcon className={`h-4 w-4 ${statusConfig[asset.status]?.color || 'text-muted-foreground'}`} />
                                <Badge variant="outline">{statusConfig[asset.status]?.label || asset.status}</Badge>
                                {assetLoc && <Badge variant="secondary" className="text-xs">RSSI: {assetLoc.rssi} dBm ({assetLoc.confidence})</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={trackingStatus === 'tracked_active' ? 'default' : 'secondary'} className={`gap-1 ${trackingStatus === 'tracked_active' ? 'bg-green-500' : trackingStatus === 'tracked_inactive' ? 'bg-amber-500 text-white' : ''}`}>
                              <TrackingIcon className="h-3 w-3" />{trackingConfig.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{trackingConfig.description}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
