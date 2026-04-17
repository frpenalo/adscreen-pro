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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          type?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          updated_at: string
          yodeck_playlist_id: string | null
        }
        Insert: {
          id?: string
          updated_at?: string
          yodeck_playlist_id?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          yodeck_playlist_id?: string | null
        }
        Relationships: []
      }
      ads: {
        Row: {
          advertiser_id: string
          created_at: string
          final_media_path: string | null
          id: string
          normalized_media_path: string | null
          overlay_json: Json | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["ad_status"]
          type: Database["public"]["Enums"]["ad_type"]
          updated_at: string
          yodeck_asset_id: string | null
          yodeck_playlist_item_id: string | null
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          final_media_path?: string | null
          id?: string
          normalized_media_path?: string | null
          overlay_json?: Json | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          type: Database["public"]["Enums"]["ad_type"]
          updated_at?: string
          yodeck_asset_id?: string | null
          yodeck_playlist_item_id?: string | null
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          final_media_path?: string | null
          id?: string
          normalized_media_path?: string | null
          overlay_json?: Json | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          type?: Database["public"]["Enums"]["ad_type"]
          updated_at?: string
          yodeck_asset_id?: string | null
          yodeck_playlist_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_brand_assets: {
        Row: {
          advertiser_id: string
          created_at: string
          id: string
          logo_path: string
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          id?: string
          logo_path: string
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          id?: string
          logo_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_brand_assets_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_notifications: {
        Row: {
          advertiser_id: string
          created_at: string
          id: string
          message: string
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_notifications_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          activated_at: string | null
          business_name: string
          category: string
          customer_name: string
          id: string
          is_active: boolean
          phone: string
          referred_partner_id: string | null
        }
        Insert: {
          activated_at?: string | null
          business_name: string
          category: string
          customer_name: string
          id: string
          is_active?: boolean
          phone: string
          referred_partner_id?: string | null
        }
        Update: {
          activated_at?: string | null
          business_name?: string
          category?: string
          customer_name?: string
          id?: string
          is_active?: boolean
          phone?: string
          referred_partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisers_referred_partner_id_fkey"
            columns: ["referred_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          advertiser_id: string
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["cancellation_status"]
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_qr_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_qr_codes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referral_earnings_manual: {
        Row: {
          advertiser_id: string
          amount_usd: number
          created_at: string
          id: string
          month: string
          partner_id: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          amount_usd: number
          created_at?: string
          id?: string
          month: string
          partner_id: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          amount_usd?: number
          created_at?: string
          id?: string
          month?: string
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referral_earnings_manual_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referral_earnings_manual_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sales_attribution: {
        Row: {
          created_at: string
          gross_sales_usd: number
          id: string
          import_id: string
          order_date: string
          order_id: string
          partner_id: string
          raw_row: Json
          referral_code: string | null
        }
        Insert: {
          created_at?: string
          gross_sales_usd: number
          id?: string
          import_id: string
          order_date: string
          order_id: string
          partner_id: string
          raw_row: Json
          referral_code?: string | null
        }
        Update: {
          created_at?: string
          gross_sales_usd?: number
          id?: string
          import_id?: string
          order_date?: string
          order_id?: string
          partner_id?: string
          raw_row?: Json
          referral_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_sales_attribution_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "shopify_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_sales_attribution_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string
          approved_at: string | null
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          payout_zelle: string | null
          status: Database["public"]["Enums"]["partner_status"]
        }
        Insert: {
          address: string
          approved_at?: string | null
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id: string
          payout_zelle?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
        }
        Update: {
          address?: string
          approved_at?: string | null
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          payout_zelle?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
        }
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          paid_at: string | null
          partner_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      shopify_imports: {
        Row: {
          id: string
          imported_at: string
          notes: string | null
          uploaded_by_admin_id: string
        }
        Insert: {
          id?: string
          imported_at?: string
          notes?: string | null
          uploaded_by_admin_id: string
        }
        Update: {
          id?: string
          imported_at?: string
          notes?: string | null
          uploaded_by_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_imports_uploaded_by_admin_id_fkey"
            columns: ["uploaded_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_advertiser: { Args: never; Returns: boolean }
      is_partner: { Args: never; Returns: boolean }
    }
    Enums: {
      ad_status: "draft" | "approved" | "published" | "rejected"
      ad_type: "image" | "video"
      app_role: "admin" | "partner" | "advertiser"
      cancellation_status: "new" | "in_progress" | "completed"
      partner_status: "pending" | "approved" | "rejected"
      payout_status: "requested" | "approved" | "rejected" | "paid"
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
      ad_status: ["draft", "approved", "published", "rejected"],
      ad_type: ["image", "video"],
      app_role: ["admin", "partner", "advertiser"],
      cancellation_status: ["new", "in_progress", "completed"],
      partner_status: ["pending", "approved", "rejected"],
      payout_status: ["requested", "approved", "rejected", "paid"],
    },
  },
} as const
