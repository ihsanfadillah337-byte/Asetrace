import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { exportAuditLog } from "@/lib/exportUtils";

type AppRole = 'admin' | 'operator' | 'user';

interface AuditLog {
  id: string;
  user_name: string;
  user_role: AppRole;
  action: string;
  details: any;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  add_asset: "Tambah Aset",
  edit_asset: "Edit Aset",
  delete_asset: "Hapus Aset",
  retire_asset: "Retire Aset",
  add_user: "Tambah User",
  edit_user: "Edit User",
  delete_user: "Hapus User",
};

const roleColors: Record<AppRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  operator: 'secondary',
  user: 'outline',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter (user name or action)
    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        actionLabels[log.action]?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) >= new Date(startDate)
      );
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => 
        new Date(log.created_at) <= endDateTime
      );
    }

    setFilteredLogs(filtered);
  };

  const formatDetails = (log: AuditLog) => {
    const { details } = log;
    if (!details || Object.keys(details).length === 0) return "-";

    const parts: string[] = [];
    if (details.asset_name) parts.push(`Aset: ${details.asset_name}`);
    if (details.room_name) parts.push(`Ruangan: ${details.room_name}`);
    if (details.user_email) parts.push(`User: ${details.user_email}`);
    if (details.asset_id) parts.push(`ID: ${details.asset_id}`);

    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "No Data", description: "No logs to export", variant: "destructive" });
      return;
    }
    exportAuditLog(filteredLogs);
    toast({ title: "Export Success", description: `Exported ${filteredLogs.length} log entries` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-muted-foreground">Riwayat aktivitas pengguna sistem</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Cari User/Aksi</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Cari nama atau aksi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="action">Jenis Aksi</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="add_asset">Tambah Aset</SelectItem>
                  <SelectItem value="edit_asset">Edit Aset</SelectItem>
                  <SelectItem value="delete_asset">Hapus Aset</SelectItem>
                  <SelectItem value="retire_asset">Retire Aset</SelectItem>
                  <SelectItem value="add_user">Tambah User</SelectItem>
                  <SelectItem value="edit_user">Edit User</SelectItem>
                  <SelectItem value="delete_user">Hapus User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start_date">Tanggal Mulai</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="end_date">Tanggal Akhir</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Aktivitas ({filteredLogs.length} entri)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal & Waktu</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Tidak ada data audit log
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>{log.user_name}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[log.user_role]}>
                        {log.user_role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {formatDetails(log)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
