import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuditLog } from '@/hooks/useAuditLog';

interface DeleteAssetDialogProps {
  assetId: string;
  assetName: string;
}

export function DeleteAssetDialog({ assetId, assetName }: DeleteAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logActivity } = useAuditLog();

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

      // Log activity
      await logActivity('delete_asset', {
        asset_id: assetId,
        asset_name: assetName,
      });
      
      toast({
        title: 'Asset Deleted',
        description: `${assetName} has been permanently removed from the system.`,
        variant: 'destructive',
      });

      setOpen(false);
      navigate('/asset-inventory');
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete asset',
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete Asset Permanently
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <span className="font-semibold text-foreground">{assetName}</span>?
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone. The asset will be permanently removed from the system.
            </p>
            <p className="text-sm">
              This action is intended for incorrect entries. If the asset is no longer in use, consider using the "Retire" option instead.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
