import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBLEGateways } from '@/hooks/useBLEGateways';
import { useRooms } from '@/hooks/useRooms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Radio, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';

export function GatewayManager() {
  const { gateways, loading, refetch } = useBLEGateways();
  const { rooms } = useRooms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingGateway, setDeletingGateway] = useState<string | null>(null);
  const [newGateway, setNewGateway] = useState({
    receiver_id: '',
    room_id: ''
  });

  const handleAddGateway = async () => {
    if (!newGateway.receiver_id || !newGateway.room_id) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('ble_gateways')
        .insert({
          receiver_id: newGateway.receiver_id,
          room_id: newGateway.room_id,
          status: 'offline',
          scan_count: 0
        });

      if (error) throw error;

      toast.success('Gateway added successfully');
      setDialogOpen(false);
      setNewGateway({ receiver_id: '', room_id: '' });
      refetch();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Gateway ID already exists');
      } else {
        toast.error('Failed to add gateway: ' + error.message);
      }
    }
  };

  const handleDeleteGateway = async (receiverId: string) => {
    try {
      const { error } = await supabase
        .from('ble_gateways')
        .delete()
        .eq('receiver_id', receiverId);

      if (error) throw error;

      toast.success('Gateway deleted successfully');
      setDeletingGateway(null);
      refetch();
    } catch (error: any) {
      toast.error('Failed to delete gateway: ' + error.message);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'stale': return 'secondary';
      default: return 'destructive';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'stale': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gateway / Receiver Locations</h3>
          <p className="text-sm text-muted-foreground">
            Manage BLE gateway positions on your floor plan
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Gateway</DialogTitle>
              <DialogDescription>
                Register a new BLE gateway/receiver to your system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="receiver_id">Gateway ID</Label>
                <Input
                  id="receiver_id"
                  placeholder="ESP32_R101"
                  value={newGateway.receiver_id}
                  onChange={(e) => setNewGateway({ ...newGateway, receiver_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Must match the ID configured in your ESP32 firmware
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room_id">Assigned Room</Label>
                <Select
                  value={newGateway.room_id}
                  onValueChange={(value) => setNewGateway({ ...newGateway, room_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.room_code} - {room.room_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGateway}>
                Add Gateway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading gateways...</p>
          </CardContent>
        </Card>
      ) : gateways.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No gateways detected yet</p>
              <p className="text-sm text-muted-foreground">
                Gateways will appear here once they start sending data, or add one manually.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gateways.map((gateway) => {
            return (
              <Card key={gateway.receiver_id} className="relative group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(gateway.status)}`} />
                      {gateway.receiver_id}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(gateway.status)} className="gap-1">
                        {gateway.status === 'online' && <Radio className="h-3 w-3 animate-pulse" />}
                        {gateway.status.toUpperCase()}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Delete Gateway
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete gateway <strong>{gateway.receiver_id}</strong>? 
                              This action cannot be undone. The gateway will need to be re-registered if needed again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteGateway(gateway.receiver_id)}
                            >
                              Delete Gateway
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription>
                    {gateway.room ? `${gateway.room.room_code} - ${gateway.room.room_name}` : `Room ID: ${gateway.room_id}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="pt-3 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Scans</span>
                      <span className="font-semibold">{gateway.scanCount.toLocaleString()}</span>
                    </div>
                    {gateway.lastSeen && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Seen</span>
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(gateway.lastSeen), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {gateway.room?.floor && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Floor</span>
                        <span className="text-xs">{gateway.room.floor}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gateway Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-medium">1. Configure ESP32 Firmware</p>
            <p className="text-muted-foreground">
              Update the gateway configuration in your ESP32 code with the receiver ID:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`const char* receiverID = "ESP32_R101";
const String roomID = "R101";`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="font-medium">2. Upload and Connect</p>
            <p className="text-muted-foreground">
              Upload the firmware to your ESP32-WROOM and ensure it's connected to WiFi.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">3. Verify Connection</p>
            <p className="text-muted-foreground">
              Check the Serial Monitor for "WiFi Connected!" and "HTTP Response: 200".
              The gateway will auto-register and appear in this dashboard once it starts sending data.
            </p>
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Status thresholds:</strong> Online (&lt;15s), Stale (15-45s), Offline (&gt;45s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
