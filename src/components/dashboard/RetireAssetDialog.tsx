import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Archive, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuditLog } from '@/hooks/useAuditLog';

const formSchema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)'),
  retirementDate: z.date({
    required_error: 'Retirement date is required',
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface RetireAssetDialogProps {
  assetId: string;
  assetName: string;
}

export function RetireAssetDialog({ assetId, assetName }: RetireAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logActivity } = useAuditLog();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ status: 'idle' })
        .eq('id', assetId);

      if (error) throw error;

      // Log activity
      await logActivity('retire_asset', {
        asset_id: assetId,
        asset_name: assetName,
        reason: data.reason,
      });
      
      toast({
        title: 'Asset Retired',
        description: `${assetName} has been marked as retired and moved to the archive.`,
      });

      form.reset();
      setOpen(false);
      navigate('/asset-inventory');
    } catch (error: any) {
      console.error('Error retiring asset:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to retire asset',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950">
          <Archive className="w-4 h-4" />
          Retire
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Archive className="w-5 h-5" />
            Retire Asset
          </DialogTitle>
          <DialogDescription>
            Mark this asset as retired. This action will move the asset to the archive and record it in the history.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Retirement Date */}
            <FormField
              control={form.control}
              name="retirementDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Retirement Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Retirement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="E.g., End of life, Obsolete technology, Replaced by newer model..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-muted/50 p-3 rounded-md text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{assetName}</span> will be moved to the retired assets archive. 
                You can still view its history and details, but it will no longer appear in active asset lists.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Retire Asset
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
