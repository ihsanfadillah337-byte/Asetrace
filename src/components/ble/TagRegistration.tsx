import { useState } from 'react';
import { useAssets } from '@/hooks/useAssets';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, XCircle, Bluetooth } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TagRegistration() {
  const { assets, loading, refetch } = useAssets();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [macAddress, setMacAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [registering, setRegistering] = useState(false);

  const handleRegister = async () => {
    if (!selectedAssetId || !macAddress) {
      toast.error('Please select an asset and enter MAC address');
      return;
    }

    // Validate MAC address format
    const macRegex = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
    if (!macRegex.test(macAddress)) {
      toast.error('Invalid MAC address format. Use format: aa:bb:cc:dd:ee:ff');
      return;
    }

    setRegistering(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ ble_tag_mac: macAddress.toLowerCase() })
        .eq('id', selectedAssetId);

      if (error) throw error;

      toast.success('BLE tag registered successfully');
      setMacAddress('');
      setSelectedAssetId('');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to register BLE tag');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ ble_tag_mac: null })
        .eq('id', assetId);

      if (error) throw error;

      toast.success('BLE tag unregistered successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unregister BLE tag');
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.ble_tag_mac?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assetsWithTags = filteredAssets.filter(a => a.ble_tag_mac);
  const assetsWithoutTags = filteredAssets.filter(a => !a.ble_tag_mac);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" />
            Register BLE Tag
          </CardTitle>
          <CardDescription>
            Assign BLE tag MAC address to an asset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asset">Select Asset</Label>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger id="asset">
                <SelectValue placeholder="Choose an asset..." />
              </SelectTrigger>
              <SelectContent>
                {assetsWithoutTags.map(asset => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name} - {asset.room}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mac">BLE Tag MAC Address</Label>
            <Input
              id="mac"
              placeholder="aa:bb:cc:dd:ee:ff"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Format: lowercase with colons (e.g., 24:0a:c4:12:34:56)
            </p>
          </div>

          <Button 
            onClick={handleRegister} 
            disabled={registering || !selectedAssetId || !macAddress}
            className="w-full"
          >
            {registering ? 'Registering...' : 'Register Tag'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Tags ({assetsWithTags.length})</CardTitle>
          <CardDescription>
            Assets with BLE tags assigned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading...</p>
            ) : assetsWithTags.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No tags registered yet</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {assetsWithTags.map(asset => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-smooth"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.room}</div>
                      <div className="text-xs font-mono text-primary mt-1">
                        {asset.ble_tag_mac}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnregister(asset.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>All Assets Status</CardTitle>
          <CardDescription>
            Overview of all assets and their BLE tag registration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>BLE Tag</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map(asset => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>{asset.room}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{asset.category}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {asset.ble_tag_mac || '-'}
                  </TableCell>
                  <TableCell>
                    {asset.ble_tag_mac ? (
                      <Badge className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Registered
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Not Registered
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
