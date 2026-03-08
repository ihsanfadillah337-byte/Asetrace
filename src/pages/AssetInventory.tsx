import { AssetTable } from '@/components/dashboard/AssetTable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Activity, AlertTriangle, Search, Download } from 'lucide-react';
import { AddAssetDialog } from '@/components/dashboard/AddAssetDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAssets } from '@/hooks/useAssets';
import { useCategories } from '@/hooks/useCategories';
import { useState, useMemo } from 'react';
import { exportAssetInventory } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

const AssetInventory = () => {
  const { hasPermission } = useAuth();
  const canManageAssets = hasPermission(['admin', 'operator']);
  const { assets, loading } = useAssets();
  const { categories, loading: categoriesLoading } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const metrics = useMemo(() => {
    if (!assets.length) {
      return { total: 0, active: 0, lostDamaged: 0 };
    }
    
    const active = assets.filter(a => a.status === 'active').length;
    const lostDamaged = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;
    
    return {
      total: assets.length,
      active,
      lostDamaged
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = searchQuery === '' || 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [assets, searchQuery, categoryFilter]);

  const { toast } = useToast();

  const handleExport = () => {
    if (filteredAssets.length === 0) {
      toast({ title: "No Data", description: "No assets to export", variant: "destructive" });
      return;
    }
    exportAssetInventory(filteredAssets);
    toast({ title: "Export Success", description: `Exported ${filteredAssets.length} assets to Excel` });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Asset Inventory</h2>
          <p className="text-muted-foreground mt-1">Complete list of all assets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          {canManageAssets && <AddAssetDialog />}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Assets"
          value={loading ? '...' : metrics.total.toLocaleString()}
          icon={Package}
          variant="default"
        />
        <MetricCard
          title="Active Assets"
          value={loading ? '...' : metrics.active.toLocaleString()}
          icon={Activity}
          variant="success"
        />
        <MetricCard
          title="Lost/Damaged"
          value={loading ? '...' : metrics.lostDamaged}
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search assets by name or ID..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={categoriesLoading}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Asset Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AssetTable filteredAssets={filteredAssets} />
    </div>
  );
};

export default AssetInventory;
