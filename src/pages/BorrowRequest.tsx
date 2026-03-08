import { useState } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useCurrentStudent } from "@/hooks/useStudents";
import { useBorrowRequests } from "@/hooks/useBorrowRequests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const BorrowRequest = () => {
  const { assets, loading: assetsLoading } = useAssets();
  const { student, isLoading: studentLoading } = useCurrentStudent();
  const { createRequest } = useBorrowRequests();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [tanggalPinjam, setTanggalPinjam] = useState<Date>();
  const [tanggalKembali, setTanggalKembali] = useState<Date>();
  const [alasan, setAlasan] = useState("");

  // Filter available assets - active, idle, or untracked (untracked = in warehouse/safe zone)
  const availableAssets = assets.filter(
    (asset) =>
      ['active', 'idle', 'untracked'].includes(asset.status) &&
      asset.condition !== "Poor" &&
      (searchQuery === "" ||
        asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.room?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRequestClick = (asset: any) => {
    if (!student) {
      toast({
        title: "Student profile required",
        description: "Please complete your student profile first.",
        variant: "destructive",
      });
      return;
    }
    setSelectedAsset(asset);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!tanggalPinjam || !tanggalKembali || !alasan || !student) {
      toast({
        title: "Incomplete form",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createRequest.mutateAsync({
        asset_id: selectedAsset.id,
        user_id: student.user_id,
        student_id: student.id,
        tanggal_pinjam: format(tanggalPinjam, "yyyy-MM-dd"),
        tanggal_kembali: format(tanggalKembali, "yyyy-MM-dd"),
        alasan,
      });

      setIsDialogOpen(false);
      setTanggalPinjam(undefined);
      setTanggalKembali(undefined);
      setAlasan("");
      setSelectedAsset(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create request. The asset may already be requested.",
        variant: "destructive",
      });
    }
  };

  if (studentLoading || assetsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading available assets...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Student Profile Required</p>
          <p className="text-muted-foreground">Please complete your student profile to request assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Peminjaman Aset</h2>
        <p className="text-muted-foreground mt-1">
          Request borrowing for available assets
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by asset name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {availableAssets.length === 0 ? (
        <Card className="col-span-full p-12">
          <div className="text-center space-y-3">
            <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold text-foreground">No Available Assets</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "No assets match your search criteria." : "All assets are currently in use or under maintenance."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableAssets.map((asset) => (
          <Card key={asset.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {asset.name}
              </CardTitle>
              <CardDescription>{asset.room_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{asset.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">{asset.room}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Available
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => handleRequestClick(asset)} 
                className="w-full"
              >
                Request Asset
              </Button>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Borrowing</DialogTitle>
            <DialogDescription>
              Fill in the details to request this asset
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Asset Name</Label>
              <Input value={selectedAsset?.name || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Asset Code</Label>
              <Input value={selectedAsset?.room_id || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Student Name</Label>
              <Input value={student?.full_name || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>NIM</Label>
              <Input value={student?.nim || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Program Studi</Label>
              <Input value={student?.program_studi || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Borrow Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !tanggalPinjam && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tanggalPinjam ? format(tanggalPinjam, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tanggalPinjam}
                    onSelect={setTanggalPinjam}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Return Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !tanggalKembali && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tanggalKembali ? format(tanggalKembali, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tanggalKembali}
                    onSelect={setTanggalKembali}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Reason for Borrowing *</Label>
              <Textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Please explain why you need this asset..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BorrowRequest;
