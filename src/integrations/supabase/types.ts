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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_documents: {
        Row: {
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
          vendor_id: string
        }
        Insert: {
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          vendor_id: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      vendor_validations: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          message: string | null
          status: Database["public"]["Enums"]["validation_status"]
          validated_at: string
          validation_type: Database["public"]["Enums"]["validation_type"]
          vendor_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          validated_at?: string
          validation_type: Database["public"]["Enums"]["validation_type"]
          vendor_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          validated_at?: string
          validation_type?: Database["public"]["Enums"]["validation_type"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_validations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          branch_name: string | null
          communication_address: string | null
          communication_city: string | null
          communication_pincode: string | null
          communication_state: string | null
          created_at: string
          credit_period_expected: number | null
          entity_type: string | null
          finance_comments: string | null
          finance_reviewed_at: string | null
          finance_reviewed_by: string | null
          gstin: string | null
          id: string
          ifsc_code: string | null
          industry_type: string | null
          invitation_id: string | null
          legal_name: string | null
          msme_category: string | null
          msme_number: string | null
          pan: string | null
          primary_contact_name: string | null
          primary_designation: string | null
          primary_email: string | null
          primary_phone: string | null
          product_categories: string[] | null
          purchase_comments: string | null
          purchase_reviewed_at: string | null
          purchase_reviewed_by: string | null
          registered_address: string | null
          registered_city: string | null
          registered_pincode: string | null
          registered_state: string | null
          same_as_registered: boolean | null
          sap_synced_at: string | null
          sap_vendor_code: string | null
          secondary_contact_name: string | null
          secondary_designation: string | null
          secondary_email: string | null
          secondary_phone: string | null
          self_declared: boolean | null
          status: Database["public"]["Enums"]["vendor_status"]
          submitted_at: string | null
          terms_accepted: boolean | null
          trade_name: string | null
          turnover_year1: number | null
          turnover_year2: number | null
          turnover_year3: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          branch_name?: string | null
          communication_address?: string | null
          communication_city?: string | null
          communication_pincode?: string | null
          communication_state?: string | null
          created_at?: string
          credit_period_expected?: number | null
          entity_type?: string | null
          finance_comments?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          gstin?: string | null
          id?: string
          ifsc_code?: string | null
          industry_type?: string | null
          invitation_id?: string | null
          legal_name?: string | null
          msme_category?: string | null
          msme_number?: string | null
          pan?: string | null
          primary_contact_name?: string | null
          primary_designation?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          product_categories?: string[] | null
          purchase_comments?: string | null
          purchase_reviewed_at?: string | null
          purchase_reviewed_by?: string | null
          registered_address?: string | null
          registered_city?: string | null
          registered_pincode?: string | null
          registered_state?: string | null
          same_as_registered?: boolean | null
          sap_synced_at?: string | null
          sap_vendor_code?: string | null
          secondary_contact_name?: string | null
          secondary_designation?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          self_declared?: boolean | null
          status?: Database["public"]["Enums"]["vendor_status"]
          submitted_at?: string | null
          terms_accepted?: boolean | null
          trade_name?: string | null
          turnover_year1?: number | null
          turnover_year2?: number | null
          turnover_year3?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          branch_name?: string | null
          communication_address?: string | null
          communication_city?: string | null
          communication_pincode?: string | null
          communication_state?: string | null
          created_at?: string
          credit_period_expected?: number | null
          entity_type?: string | null
          finance_comments?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          gstin?: string | null
          id?: string
          ifsc_code?: string | null
          industry_type?: string | null
          invitation_id?: string | null
          legal_name?: string | null
          msme_category?: string | null
          msme_number?: string | null
          pan?: string | null
          primary_contact_name?: string | null
          primary_designation?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          product_categories?: string[] | null
          purchase_comments?: string | null
          purchase_reviewed_at?: string | null
          purchase_reviewed_by?: string | null
          registered_address?: string | null
          registered_city?: string | null
          registered_pincode?: string | null
          registered_state?: string | null
          same_as_registered?: boolean | null
          sap_synced_at?: string | null
          sap_vendor_code?: string | null
          secondary_contact_name?: string | null
          secondary_designation?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          self_declared?: boolean | null
          status?: Database["public"]["Enums"]["vendor_status"]
          submitted_at?: string | null
          terms_accepted?: boolean | null
          trade_name?: string | null
          turnover_year1?: number | null
          turnover_year2?: number | null
          turnover_year3?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "vendor_invitations"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "vendor" | "finance" | "purchase" | "admin"
      validation_status: "pending" | "passed" | "failed" | "skipped"
      validation_type: "gst" | "pan" | "bank" | "msme" | "name_match"
      vendor_status:
        | "draft"
        | "submitted"
        | "validation_pending"
        | "validation_failed"
        | "finance_review"
        | "finance_approved"
        | "finance_rejected"
        | "purchase_review"
        | "purchase_approved"
        | "purchase_rejected"
        | "sap_synced"
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
      app_role: ["vendor", "finance", "purchase", "admin"],
      validation_status: ["pending", "passed", "failed", "skipped"],
      validation_type: ["gst", "pan", "bank", "msme", "name_match"],
      vendor_status: [
        "draft",
        "submitted",
        "validation_pending",
        "validation_failed",
        "finance_review",
        "finance_approved",
        "finance_rejected",
        "purchase_review",
        "purchase_approved",
        "purchase_rejected",
        "sap_synced",
      ],
    },
  },
} as const
