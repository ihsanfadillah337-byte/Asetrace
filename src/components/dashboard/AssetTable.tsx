import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { EditAssetDialog } from './EditAssetDialog';
import { DeleteAssetDialog } from './DeleteAssetDialog';
import { useAssets } from '@/hooks/useAssets';
import { cn } from '@/lib/utils';

const statusConfig = {
  active: { variant: 'default' as const, label: 'Active', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  borrowed: { variant: 'secondary' as const, label: 'Dipinjam', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  idle: { variant: 'secondary' as const, label: 'Idle', className: '' },
  maintenance: { variant: 'outline' as const, label: 'Maintenance', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  lost: { variant: 'destructive' as const, label: 'Lost', className: '' },
  damaged: { variant: 'destructive' as const, label: 'Damaged', className: '' },
  untracked: { variant: 'destructive' as const, label: 'Untracked', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' }
};

const conditionConfig = {
  Excellent: { color: 'text-success', label: 'Excellent' },
  Good: { color: 'text-primary', label: 'Good' },
  Fair: { color: 'text-warning', label: 'Fair' },
  Poor: { color: 'text-destructive', label: 'Poor' },
  Unknown: { color: 'text-muted-foreground', label: 'Unknown' }
};

import { Asset } from '@/hooks/useAssets';

interface AssetTableProps {
  filteredAssets?: Asset[];
}

export function AssetTable({ filteredAssets }: AssetTableProps = {}) {
  const navigate = useNavigate();
  const { assets: allAssets, loading } = useAssets();
  const { hasPermission } = useAuth();
  const canManageAssets = hasPermission(['admin', 'operator']);

  const assets = filteredAssets || allAssets;

  if (loading) {
    return <Card className="p-6"><p className="text-muted-foreground">Loading assets...</p></Card>;
  }

  const handleRowClick = (assetId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    navigate(`/asset/${assetId}`);
  };
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Asset Inventory</h3>
        <Badge variant="outline" className="text-xs">
          {assets.length} Total Assets
        </Badge>
      </div>
      
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="font-semibold text-foreground w-16">Image</TableHead>
              <TableHead className="font-semibold text-foreground">Asset ID</TableHead>
              <TableHead className="font-semibold text-foreground">Name</TableHead>
              <TableHead className="font-semibold text-foreground">Location</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Condition</TableHead>
              <TableHead className="font-semibold text-foreground">Last User</TableHead>
              {canManageAssets && <TableHead className="font-semibold text-foreground">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow 
                key={asset.id} 
                className="border-border hover:bg-muted/30 transition-colors cursor-pointer" 
                onClick={(e) => handleRowClick(asset.id, e)}
              >
                <TableCell>
                  {asset.image_url ? (
                    <img 
                      src={asset.image_url} 
                      alt={asset.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-primary">{asset.id.substring(0, 8)}</TableCell>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell className="text-muted-foreground">{asset.floor}, {asset.room}</TableCell>
                <TableCell>
                  <Badge 
                    variant={statusConfig[asset.status as keyof typeof statusConfig]?.variant || 'outline'}
                    className={cn("text-xs", statusConfig[asset.status as keyof typeof statusConfig]?.className)}
                  >
                    {statusConfig[asset.status as keyof typeof statusConfig]?.label || asset.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-medium ${conditionConfig[asset.condition as keyof typeof conditionConfig]?.color || 'text-muted-foreground'}`}>
                    {asset.condition}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">{asset.last_user || 'N/A'}</div>
                    <div className="text-xs">{new Date(asset.updated_at).toLocaleString()}</div>
                  </div>
                </TableCell>
                {canManageAssets && (
                  <TableCell>
                    <div className="flex gap-2">
                      <EditAssetDialog asset={{
                        id: asset.id,
                        name: asset.name,
                        type: asset.type,
                        location: `Floor ${asset.floor}, ${asset.room}`,
                        status: asset.status,
                        condition: asset.condition,
                        category: asset.category,
                        floor: asset.floor,
                        room_id: asset.room_id,
                        image_url: asset.image_url,
                      }} />
                      <DeleteAssetDialog assetId={asset.id} assetName={asset.name} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}