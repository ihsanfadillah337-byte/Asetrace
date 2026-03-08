import { useState } from "react";
import { useBorrowRequests } from "@/hooks/useBorrowRequests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CheckCircle, XCircle, RotateCcw, Filter } from "lucide-react";

const statusConfig = {
  Pending: { variant: "outline" as const, label: "Pending", className: "bg-yellow-50 text-yellow-700" },
  Approved: { variant: "outline" as const, label: "Approved", className: "bg-green-50 text-green-700" },
  Rejected: { variant: "outline" as const, label: "Rejected", className: "bg-red-50 text-red-700" },
  Returned: { variant: "outline" as const, label: "Returned", className: "bg-blue-50 text-blue-700" },
};

const BorrowManagement = () => {
  const { requests, isLoading, approveRequest, rejectRequest, returnAsset } = useBorrowRequests();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "return">("approve");
  const [notes, setNotes] = useState("");

  const filteredRequests = requests.filter(
    (req) => statusFilter === "all" || req.status === statusFilter
  );

  const handleAction = (request: any, action: "approve" | "reject" | "return") => {
    setSelectedRequest(request);
    setActionType(action);
    setIsDialogOpen(true);
    setNotes("");
  };

  const handleSubmitAction = async () => {
    try {
      if (actionType === "approve") {
        await approveRequest.mutateAsync({
          id: selectedRequest.id,
          notes,
        });
      } else if (actionType === "reject") {
        await rejectRequest.mutateAsync({
          id: selectedRequest.id,
          notes,
        });
      } else if (actionType === "return") {
        await returnAsset.mutateAsync({
          id: selectedRequest.id,
          notes,
        });
      }

      setIsDialogOpen(false);
      setNotes("");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error handling action:", error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Borrow Request Management</h2>
        <p className="text-muted-foreground mt-1">
          Manage and approve asset borrowing requests
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Requests</CardTitle>
              <CardDescription>Review and process borrowing requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No requests found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>NIM</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Borrow Date</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.students?.full_name}</TableCell>
                    <TableCell>{request.students?.nim}</TableCell>
                    <TableCell>{request.assets?.name}</TableCell>
                    <TableCell>{format(new Date(request.tanggal_pinjam), "PPP")}</TableCell>
                    <TableCell>{format(new Date(request.tanggal_kembali), "PPP")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusConfig[request.status].variant}
                        className={statusConfig[request.status].className}
                      >
                        {statusConfig[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {request.status === "Pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(request, "approve")}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(request, "reject")}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {request.status === "Approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(request, "return")}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Return
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approve Request"}
              {actionType === "reject" && "Reject Request"}
              {actionType === "return" && "Mark as Returned"}
            </DialogTitle>
            <DialogDescription>
              Add notes for this action (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BorrowManagement;
