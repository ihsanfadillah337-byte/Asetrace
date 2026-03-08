import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface BorrowRequest {
  id: string;
  asset_id: string;
  user_id: string;
  student_id: string;
  tanggal_pinjam: string;
  tanggal_kembali: string;
  alasan: string;
  status: "Pending" | "Approved" | "Rejected" | "Returned";
  approved_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  assets?: {
    id: string;
    name: string;
    room_id: string;
    category: string;
  };
  students?: {
    nim: string;
    full_name: string;
    program_studi: string;
  };
}

export const useBorrowRequests = () => {
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("borrow_requests")
        .select(`
          *,
          assets(id, name, room_id, category),
          students(nim, full_name, program_studi)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data as BorrowRequest[]);
    } catch (error) {
      console.error("Error fetching borrow requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("borrow-requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrow_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createRequest = useMutation({
    mutationFn: async (request: Omit<BorrowRequest, "id" | "created_at" | "updated_at" | "status">) => {
      const { data, error } = await supabase
        .from("borrow_requests")
        .insert({ ...request, status: "Pending" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowRequests"] });
      fetchRequests(); // Update local state directly
      toast({ 
        title: "Request berhasil dikirim", 
        description: "Menunggu persetujuan operator."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveRequest = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("approve_borrow_request", {
        _request_id: id,
        _approver_id: user.id,
        _notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowRequests"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      fetchRequests(); // Automatically update dropdown UI
      toast({ title: "Request approved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error approving request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("reject_borrow_request", {
        _request_id: id,
        _approver_id: user.id,
        _notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowRequests"] });
      fetchRequests();
      toast({ title: "Request rejected" });
    },
    onError: (error: any) => {
      toast({
        title: "Error rejecting request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const returnAsset = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase.rpc("return_asset", {
        _request_id: id,
        _notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowRequests"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      fetchRequests();
      toast({ title: "Asset returned successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error returning asset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    requests,
    isLoading,
    createRequest,
    approveRequest,
    rejectRequest,
    returnAsset,
  };
};

export const useUserBorrowRequests = () => {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("borrow_requests")
        .select(`
          *,
          assets(id, name, room_id, category)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data as BorrowRequest[]);
    } catch (error) {
      console.error("Error fetching user borrow requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("user-borrow-requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrow_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { requests, isLoading };
};
