import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AuditAction = 
  | "login"
  | "logout"
  | "add_asset"
  | "edit_asset"
  | "delete_asset"
  | "retire_asset"
  | "add_user"
  | "edit_user"
  | "delete_user";

interface AuditDetails {
  asset_id?: string;
  asset_name?: string;
  room_name?: string;
  user_email?: string;
  [key: string]: any;
}

export function useAuditLog() {
  const { user, role } = useAuth();

  const logActivity = async (action: AuditAction, details?: AuditDetails) => {
    if (!user || !role) return;

    try {
      // Get user profile for full name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email || 'Unknown User',
        user_role: role,
        action,
        details: details || {},
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  return { logActivity };
}
