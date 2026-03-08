export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      asset_locations: {
        Row: {
          asset_id: string | null
          confidence: string | null
          created_at: string | null
          id: string
          receiver_id: string
          room_id: string | null
          rssi: number
          tag_mac: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          receiver_id: string
          room_id?: string | null
          rssi: number
          tag_mac: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          receiver_id?: string
          room_id?: string | null
          rssi?: number
          tag_mac?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_locations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_locations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_movement_history: {
        Row: {
          asset_id: string
          created_at: string
          detected_by: string | null
          from_room_id: string | null
          from_room_name: string | null
          id: string
          moved_at: string
          rssi: number | null
          to_room_id: string
          to_room_name: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          detected_by?: string | null
          from_room_id?: string | null
          from_room_name?: string | null
          id?: string
          moved_at?: string
          rssi?: number | null
          to_room_id: string
          to_room_name?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          detected_by?: string | null
          from_room_id?: string | null
          from_room_name?: string | null
          id?: string
          moved_at?: string
          rssi?: number | null
          to_room_id?: string
          to_room_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_movement_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movement_history_from_room_id_fkey"
            columns: ["from_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movement_history_to_room_id_fkey"
            columns: ["to_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_usage_logs: {
        Row: {
          asset_id: string
          created_at: string | null
          duration_hours: number | null
          ended_at: string | null
          id: string
          location: string | null
          notes: string | null
          started_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          duration_hours?: number | null
          ended_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          started_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          duration_hours?: number | null
          ended_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          started_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_usage_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          ble_tag_mac: string | null
          category: Database["public"]["Enums"]["asset_category"]
          condition: string
          created_at: string | null
          floor: string
          id: string
          image_url: string | null
          last_maintenance: string | null
          last_user: string | null
          latitude: number | null
          longitude: number | null
          name: string
          position_x: number | null
          position_y: number | null
          room: string
          room_id: string
          status: Database["public"]["Enums"]["asset_status"]
          type: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          ble_tag_mac?: string | null
          category: Database["public"]["Enums"]["asset_category"]
          condition: string
          created_at?: string | null
          floor: string
          id?: string
          image_url?: string | null
          last_maintenance?: string | null
          last_user?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          position_x?: number | null
          position_y?: number | null
          room: string
          room_id: string
          status?: Database["public"]["Enums"]["asset_status"]
          type: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          ble_tag_mac?: string | null
          category?: Database["public"]["Enums"]["asset_category"]
          condition?: string
          created_at?: string | null
          floor?: string
          id?: string
          image_url?: string | null
          last_maintenance?: string | null
          last_user?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          position_x?: number | null
          position_y?: number | null
          room?: string
          room_id?: string
          status?: Database["public"]["Enums"]["asset_status"]
          type?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
          user_name?: string
          user_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ble_gateways: {
        Row: {
          created_at: string | null
          id: string
          last_seen: string
          receiver_id: string
          room_id: string | null
          scan_count: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen?: string
          receiver_id: string
          room_id?: string | null
          scan_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen?: string
          receiver_id?: string
          room_id?: string | null
          scan_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ble_gateways_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ble_rssi_buffer: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          rssi: number
          tag_mac: string
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          rssi: number
          tag_mac: string
          timestamp?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          rssi?: number
          tag_mac?: string
          timestamp?: string
        }
        Relationships: []
      }
      ble_tracking_data: {
        Row: {
          asset_id: string | null
          created_at: string | null
          id: string
          receiver_id: string
          receiver_location: Json
          rssi: number
          tag_mac: string
          timestamp: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          id?: string
          receiver_id: string
          receiver_location: Json
          rssi: number
          tag_mac: string
          timestamp: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          id?: string
          receiver_id?: string
          receiver_location?: Json
          rssi?: number
          tag_mac?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "ble_tracking_data_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      borrow_requests: {
        Row: {
          alasan: string
          approved_by: string | null
          asset_id: string
          created_at: string | null
          id: string
          notes: string | null
          status: string
          student_id: string
          tanggal_kembali: string
          tanggal_pinjam: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alasan: string
          approved_by?: string | null
          asset_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          tanggal_kembali: string
          tanggal_pinjam: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alasan?: string
          approved_by?: string | null
          asset_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          tanggal_kembali?: string
          tanggal_pinjam?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrow_requests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_history: {
        Row: {
          asset_id: string
          completed_date: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          maintenance_type: string
          notes: string | null
          scheduled_date: string | null
          status: string
          technician_name: string
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_type: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          technician_name: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          technician_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read_status: boolean | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read_status?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read_status?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          area_sqm: number | null
          building: string | null
          capacity: number | null
          created_at: string | null
          floor: string
          id: string
          position_x: number | null
          position_y: number | null
          room_code: string
          room_name: string
          updated_at: string | null
        }
        Insert: {
          area_sqm?: number | null
          building?: string | null
          capacity?: number | null
          created_at?: string | null
          floor: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          room_code: string
          room_name: string
          updated_at?: string | null
        }
        Update: {
          area_sqm?: number | null
          building?: string | null
          capacity?: number | null
          created_at?: string | null
          floor?: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          room_code?: string
          room_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          angkatan: number | null
          created_at: string | null
          full_name: string
          id: string
          nim: string | null
          program_studi: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          angkatan?: number | null
          created_at?: string | null
          full_name: string
          id?: string
          nim?: string | null
          program_studi?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          angkatan?: number | null
          created_at?: string | null
          full_name?: string
          id?: string
          nim?: string | null
          program_studi?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_borrow_request: {
        Args: { _approver_id: string; _notes?: string; _request_id: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          _message: string
          _related_entity_id?: string
          _related_entity_type?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_asset_available: { Args: { _asset_id: string }; Returns: boolean }
      reject_borrow_request: {
        Args: { _approver_id: string; _notes?: string; _request_id: string }
        Returns: undefined
      }
      return_asset: {
        Args: { _notes?: string; _request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "user"
      asset_category: "laptop" | "server" | "furniture" | "vehicle" | "other"
      asset_status:
        | "active"
        | "maintenance"
        | "lost"
        | "damaged"
        | "idle"
        | "borrowed"
        | "untracked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "user"],
      asset_category: ["laptop", "server", "furniture", "vehicle", "other"],
      asset_status: [
        "active",
        "maintenance",
        "lost",
        "damaged",
        "idle",
        "borrowed",
        "untracked",
      ],
    },
  },
} as const
