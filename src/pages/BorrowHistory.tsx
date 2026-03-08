import { useUserBorrowRequests } from "@/hooks/useBorrowRequests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Clock } from "lucide-react";

const statusConfig = {
  Pending: { variant: "outline" as const, label: "Pending", className: "bg-yellow-50 text-yellow-700" },
  Approved: { variant: "outline" as const, label: "Approved", className: "bg-green-50 text-green-700" },
  Rejected: { variant: "outline" as const, label: "Rejected", className: "bg-red-50 text-red-700" },
  Returned: { variant: "outline" as const, label: "Returned", className: "bg-blue-50 text-blue-700" },
};

const BorrowHistory = () => {
  const { requests, isLoading } = useUserBorrowRequests();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Borrow History</h2>
        <p className="text-muted-foreground mt-1">
          View all your borrowing requests and their status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request History
          </CardTitle>
          <CardDescription>Track all your asset borrowing requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No borrowing history yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Borrow Date</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.assets?.name}</TableCell>
                    <TableCell>{request.assets?.room_id}</TableCell>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {request.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BorrowHistory;
