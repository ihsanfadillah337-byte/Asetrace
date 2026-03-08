import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Student {
  id: string;
  user_id: string;
  nim: string;
  full_name: string;
  program_studi: string;
  angkatan: number;
  created_at?: string;
  updated_at?: string;
}

export const useStudents = () => {
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudents(data as Student[]);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("students-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => {
          fetchStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createStudent = useMutation({
    mutationFn: async (student: Omit<Student, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("students")
        .insert(student)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student record created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating student record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStudent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Student> & { id: string }) => {
      const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student record updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating student record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    students,
    isLoading,
    createStudent,
    updateStudent,
  };
};

export const useCurrentStudent = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudent = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStudent(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setStudent(data as Student | null);
    } catch (error) {
      console.error("Error fetching current student:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("current-student-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => {
          fetchStudent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { student, isLoading };
};
