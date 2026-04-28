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
      api_credentials: {
        Row: {
          api_provider_id: string
          created_at: string | null
          credential_name: string
          credential_value: string
          id: string
          is_encrypted: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_provider_id: string
          created_at?: string | null
          credential_name: string
          credential_value: string
          id?: string
          is_encrypted?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_provider_id?: string
          created_at?: string | null
          credential_name?: string
          credential_value?: string
          id?: string
          is_encrypted?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_credentials_api_provider_id_fkey"
            columns: ["api_provider_id"]
            isOneToOne: false
            referencedRelation: "api_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_providers: {
        Row: {
          auth_header_name: string | null
          auth_header_prefix: string | null
          auth_type: string | null
          base_url: string
          created_at: string | null
          display_name: string
          endpoint_path: string
          execution_order: number | null
          http_method: string | null
          id: string
          is_enabled: boolean | null
          is_mandatory: boolean | null
          provider_name: string
          request_body_template: Json | null
          request_headers: Json | null
          response_data_mapping: Json | null
          response_message_path: string | null
          response_success_path: string | null
          response_success_value: string | null
          retry_count: number | null
          retry_delay_ms: number | null
          schedule_enabled: boolean | null
          schedule_frequency_days: number | null
          tenant_id: string | null
          timeout_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          auth_type?: string | null
          base_url: string
          created_at?: string | null
          display_name: string
          endpoint_path: string
          execution_order?: number | null
          http_method?: string | null
          id?: string
          is_enabled?: boolean | null
          is_mandatory?: boolean | null
          provider_name: string
          request_body_template?: Json | null
          request_headers?: Json | null
          response_data_mapping?: Json | null
          response_message_path?: string | null
          response_success_path?: string | null
          response_success_value?: string | null
          retry_count?: number | null
          retry_delay_ms?: number | null
          schedule_enabled?: boolean | null
          schedule_frequency_days?: number | null
          tenant_id?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          auth_type?: string | null
          base_url?: string
          created_at?: string | null
          display_name?: string
          endpoint_path?: string
          execution_order?: number | null
          http_method?: string | null
          id?: string
          is_enabled?: boolean | null
          is_mandatory?: boolean | null
          provider_name?: string
          request_body_template?: Json | null
          request_headers?: Json | null
          response_data_mapping?: Json | null
          response_message_path?: string | null
          response_success_path?: string | null
          response_success_value?: string | null
          retry_count?: number | null
          retry_delay_ms?: number | null
          schedule_enabled?: boolean | null
          schedule_frequency_days?: number | null
          tenant_id?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_matrix_approvers: {
        Row: {
          added_at: string
          added_by: string | null
          approver_email: string | null
          approver_name: string | null
          id: string
          level_id: string
          user_id: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          approver_email?: string | null
          approver_name?: string | null
          id?: string
          level_id: string
          user_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          approver_email?: string | null
          approver_name?: string | null
          id?: string
          level_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_matrix_approvers_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "approval_matrix_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_matrix_levels: {
        Row: {
          approval_mode: string
          created_at: string
          designation: string | null
          id: string
          is_active: boolean
          level_name: string
          level_number: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          created_at?: string
          designation?: string | null
          id?: string
          is_active?: boolean
          level_name: string
          level_number: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          created_at?: string
          designation?: string | null
          id?: string
          is_active?: boolean
          level_name?: string
          level_number?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_matrix_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflow_steps: {
        Row: {
          auto_approve_after_days: number | null
          can_reject: boolean | null
          can_request_info: boolean | null
          created_at: string | null
          id: string
          is_mandatory: boolean | null
          notify_on_complete: boolean | null
          notify_on_pending: boolean | null
          required_role: Database["public"]["Enums"]["app_role"]
          step_name: string
          step_order: number
          workflow_id: string
        }
        Insert: {
          auto_approve_after_days?: number | null
          can_reject?: boolean | null
          can_request_info?: boolean | null
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          notify_on_complete?: boolean | null
          notify_on_pending?: boolean | null
          required_role: Database["public"]["Enums"]["app_role"]
          step_name: string
          step_order: number
          workflow_id: string
        }
        Update: {
          auto_approve_after_days?: number | null
          can_reject?: boolean | null
          can_request_info?: boolean | null
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          notify_on_complete?: boolean | null
          notify_on_pending?: boolean | null
          required_role?: Database["public"]["Enums"]["app_role"]
          step_name?: string
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          tenant_id: string
          updated_at: string | null
          workflow_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string | null
          workflow_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      custom_role_screen_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          custom_role_id: string
          id: string
          screen_key: string
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          custom_role_id: string
          id?: string
          screen_key: string
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          custom_role_id?: string
          id?: string
          screen_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_screen_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_configs: {
        Row: {
          created_at: string | null
          default_value: string | null
          display_label: string
          display_order: number | null
          field_name: string
          field_type: string | null
          help_text: string | null
          id: string
          is_editable: boolean | null
          is_mandatory: boolean | null
          is_visible: boolean | null
          options: Json | null
          placeholder: string | null
          step_name: string
          tenant_id: string | null
          updated_at: string | null
          validation_message: string | null
          validation_regex: string | null
        }
        Insert: {
          created_at?: string | null
          default_value?: string | null
          display_label: string
          display_order?: number | null
          field_name: string
          field_type?: string | null
          help_text?: string | null
          id?: string
          is_editable?: boolean | null
          is_mandatory?: boolean | null
          is_visible?: boolean | null
          options?: Json | null
          placeholder?: string | null
          step_name: string
          tenant_id?: string | null
          updated_at?: string | null
          validation_message?: string | null
          validation_regex?: string | null
        }
        Update: {
          created_at?: string | null
          default_value?: string | null
          display_label?: string
          display_order?: number | null
          field_name?: string
          field_type?: string | null
          help_text?: string | null
          id?: string
          is_editable?: boolean | null
          is_mandatory?: boolean | null
          is_visible?: boolean | null
          options?: Json | null
          placeholder?: string | null
          step_name?: string
          tenant_id?: string | null
          updated_at?: string | null
          validation_message?: string | null
          validation_regex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_field_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      form_step_configs: {
        Row: {
          created_at: string
          id: string
          is_built_in: boolean
          is_visible: boolean
          step_description: string | null
          step_key: string
          step_label: string
          step_order: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_built_in?: boolean
          is_visible?: boolean
          step_description?: string | null
          step_key: string
          step_label: string
          step_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_built_in?: boolean
          is_visible?: boolean
          step_description?: string | null
          step_key?: string
          step_label?: string
          step_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_step_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_email_events: {
        Row: {
          created_at: string
          email_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          invitation_id: string | null
        }
        Insert: {
          created_at?: string
          email_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          invitation_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          invitation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_email_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "vendor_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          document_type: string
          extracted_data: Json
          id: string
          raw_text: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          document_type: string
          extracted_data?: Json
          id?: string
          raw_text?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          document_type?: string
          extracted_data?: Json
          id?: string
          raw_text?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_extractions_vendor_id_fkey"
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
      role_screen_permissions: {
        Row: {
          can_access: boolean
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          screen_key: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          can_access?: boolean
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          screen_key: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          can_access?: boolean
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          screen_key?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_screen_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_validations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          next_run_at: string
          validation_type: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          next_run_at: string
          validation_type: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          next_run_at?: string
          validation_type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_validations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          accent_color: string | null
          company_name: string | null
          created_at: string | null
          footer_text: string | null
          help_email: string | null
          help_phone: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          privacy_url: string | null
          secondary_color: string | null
          tagline: string | null
          tenant_id: string
          terms_url: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          company_name?: string | null
          created_at?: string | null
          footer_text?: string | null
          help_email?: string | null
          help_phone?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          privacy_url?: string | null
          secondary_color?: string | null
          tagline?: string | null
          tenant_id: string
          terms_url?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          company_name?: string | null
          created_at?: string | null
          footer_text?: string | null
          help_email?: string | null
          help_phone?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          privacy_url?: string | null
          secondary_color?: string | null
          tagline?: string | null
          tenant_id?: string
          terms_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
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
      user_tenants: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_api_logs: {
        Row: {
          api_provider: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          is_success: boolean
          request_payload: Json | null
          response_payload: Json | null
          response_status: number | null
          validation_type: string
          vendor_id: string | null
        }
        Insert: {
          api_provider?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          is_success?: boolean
          request_payload?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          validation_type: string
          vendor_id?: string | null
        }
        Update: {
          api_provider?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          is_success?: boolean
          request_payload?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          validation_type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_api_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_configs: {
        Row: {
          api_endpoint: string | null
          api_provider: string | null
          created_at: string
          description: string | null
          display_name: string
          execution_stage: string
          id: string
          is_enabled: boolean
          is_mandatory: boolean
          matching_threshold: number | null
          priority_order: number | null
          retry_count: number | null
          schedule_frequency_days: number | null
          timeout_seconds: number | null
          updated_at: string
          validation_type: string
        }
        Insert: {
          api_endpoint?: string | null
          api_provider?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          execution_stage?: string
          id?: string
          is_enabled?: boolean
          is_mandatory?: boolean
          matching_threshold?: number | null
          priority_order?: number | null
          retry_count?: number | null
          schedule_frequency_days?: number | null
          timeout_seconds?: number | null
          updated_at?: string
          validation_type: string
        }
        Update: {
          api_endpoint?: string | null
          api_provider?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          execution_stage?: string
          id?: string
          is_enabled?: boolean
          is_mandatory?: boolean
          matching_threshold?: number | null
          priority_order?: number | null
          retry_count?: number | null
          schedule_frequency_days?: number | null
          timeout_seconds?: number | null
          updated_at?: string
          validation_type?: string
        }
        Relationships: []
      }
      vendor_approval_progress: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          comments: string | null
          created_at: string
          id: string
          level_id: string
          level_number: number
          status: string
          vendor_id: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          level_id: string
          level_number: number
          status?: string
          vendor_id: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          level_id?: string
          level_number?: number
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_approval_progress_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "approval_matrix_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_approval_progress_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
      vendor_feedback: {
        Row: {
          comments: string | null
          created_at: string
          ease_of_use_rating: number | null
          id: string
          overall_rating: number
          support_rating: number | null
          user_id: string | null
          vendor_id: string | null
          would_recommend: boolean | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          ease_of_use_rating?: number | null
          id?: string
          overall_rating: number
          support_rating?: number | null
          user_id?: string | null
          vendor_id?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          ease_of_use_rating?: number | null
          id?: string
          overall_rating?: number
          support_rating?: number | null
          user_id?: string | null
          vendor_id?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_feedback_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invitations: {
        Row: {
          access_count: number | null
          created_at: string
          created_by: string | null
          email: string
          email_clicked_at: string | null
          email_opened_at: string | null
          email_sent_at: string | null
          expires_at: string
          id: string
          phone_number: string | null
          resend_email_id: string | null
          tenant_id: string | null
          token: string
          used_at: string | null
          user_id: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          created_by?: string | null
          email: string
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at: string
          id?: string
          phone_number?: string | null
          resend_email_id?: string | null
          tenant_id?: string | null
          token: string
          used_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string
          created_by?: string | null
          email?: string
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          phone_number?: string | null
          resend_email_id?: string | null
          tenant_id?: string | null
          token?: string
          used_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          authorized_distributor_address: string | null
          authorized_distributor_name: string | null
          bank_address: string | null
          bank_branch_name: string | null
          bank_name: string | null
          bank_verification_status: string | null
          branch_address: string | null
          branch_address_line2: string | null
          branch_address_line3: string | null
          branch_address_line4: string | null
          branch_city: string | null
          branch_contact_designation: string | null
          branch_contact_email: string | null
          branch_contact_fax: string | null
          branch_contact_name: string | null
          branch_contact_phone: string | null
          branch_country: string | null
          branch_email: string | null
          branch_name: string | null
          branch_pincode: string | null
          branch_state: string | null
          branch_website: string | null
          certifications: Json | null
          communication_address: string | null
          communication_city: string | null
          communication_pincode: string | null
          communication_state: string | null
          created_at: string
          credit_period_expected: number | null
          custom_field_values: Json
          customer_service_designation: string | null
          customer_service_email: string | null
          customer_service_name: string | null
          customer_service_phone: string | null
          dg_capacity: string | null
          enlistments: Json | null
          entity_type: string | null
          environmental_issues: string | null
          equipment_availability: string | null
          esi_number: string | null
          finance_comments: string | null
          finance_reviewed_at: string | null
          finance_reviewed_by: string | null
          firm_registration_no: string | null
          gst_additional_places: Json | null
          gst_business_nature: string[] | null
          gst_constitution_of_business: string | null
          gst_declaration_reason: string | null
          gst_jurisdiction_centre: string | null
          gst_jurisdiction_state: string | null
          gst_principal_place_of_business: string | null
          gst_registration_date: string | null
          gst_status: string | null
          gst_taxpayer_type: string | null
          gst_verification_status: string | null
          gstin: string | null
          health_issues: string | null
          id: string
          iec_no: string | null
          ifsc_code: string | null
          industry_type: string | null
          inspection_testing: string | null
          invitation_id: string | null
          is_gst_registered: boolean | null
          is_msme_registered: boolean | null
          labour_permit_no: string | null
          lead_time_required: string | null
          legal_name: string | null
          machinery_availability: string | null
          major_customer1: string | null
          major_customer2: string | null
          major_customer3: string | null
          manpower: string | null
          manufacturing_address: string | null
          manufacturing_address_line2: string | null
          manufacturing_address_line3: string | null
          manufacturing_address_line4: string | null
          manufacturing_city: string | null
          manufacturing_email: string | null
          manufacturing_fax: string | null
          manufacturing_phone: string | null
          manufacturing_pincode: string | null
          manufacturing_state: string | null
          memberships: Json | null
          micr_code: string | null
          msme_category: string | null
          msme_number: string | null
          msme_verification_status: string | null
          name_match_verification_status: string | null
          nearest_airport: string | null
          nearest_bus_station: string | null
          nearest_port: string | null
          nearest_railway: string | null
          operational_network: string | null
          organization_type: string | null
          ownership_type: string | null
          pan: string | null
          pan_verification_status: string | null
          pennydrop_init: boolean | null
          pennydrop_status: Json | null
          pennydrop_verification_status: string | null
          pf_number: string | null
          power_supply: string | null
          primary_contact_name: string | null
          primary_designation: string | null
          primary_email: string | null
          primary_email_2: string | null
          primary_phone: string | null
          primary_phone_2: string | null
          product_categories: string[] | null
          product_types: string[] | null
          product_types_other: string | null
          production_capacity: string | null
          production_contact_name: string | null
          production_designation: string | null
          production_email: string | null
          production_facilities: string[] | null
          production_phone: string | null
          purchase_comments: string | null
          purchase_reviewed_at: string | null
          purchase_reviewed_by: string | null
          quality_issues: string | null
          raw_materials_used: string | null
          registered_address: string | null
          registered_address_line2: string | null
          registered_address_line3: string | null
          registered_address_line4: string | null
          registered_city: string | null
          registered_email: string | null
          registered_fax: string | null
          registered_phone: string | null
          registered_pincode: string | null
          registered_state: string | null
          registered_website: string | null
          safety_issues: string | null
          same_as_registered: boolean | null
          sap_synced_at: string | null
          sap_vendor_code: string | null
          secondary_contact_name: string | null
          secondary_designation: string | null
          secondary_email: string | null
          secondary_phone: string | null
          self_declared: boolean | null
          status: Database["public"]["Enums"]["vendor_status"]
          store_capacity: string | null
          submitted_at: string | null
          supply_capacity: string | null
          swift_iban_code: string | null
          tenant_id: string | null
          terms_accepted: boolean | null
          trade_name: string | null
          turnover_year1: number | null
          turnover_year2: number | null
          turnover_year3: number | null
          updated_at: string
          user_id: string | null
          water_supply: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          authorized_distributor_address?: string | null
          authorized_distributor_name?: string | null
          bank_address?: string | null
          bank_branch_name?: string | null
          bank_name?: string | null
          bank_verification_status?: string | null
          branch_address?: string | null
          branch_address_line2?: string | null
          branch_address_line3?: string | null
          branch_address_line4?: string | null
          branch_city?: string | null
          branch_contact_designation?: string | null
          branch_contact_email?: string | null
          branch_contact_fax?: string | null
          branch_contact_name?: string | null
          branch_contact_phone?: string | null
          branch_country?: string | null
          branch_email?: string | null
          branch_name?: string | null
          branch_pincode?: string | null
          branch_state?: string | null
          branch_website?: string | null
          certifications?: Json | null
          communication_address?: string | null
          communication_city?: string | null
          communication_pincode?: string | null
          communication_state?: string | null
          created_at?: string
          credit_period_expected?: number | null
          custom_field_values?: Json
          customer_service_designation?: string | null
          customer_service_email?: string | null
          customer_service_name?: string | null
          customer_service_phone?: string | null
          dg_capacity?: string | null
          enlistments?: Json | null
          entity_type?: string | null
          environmental_issues?: string | null
          equipment_availability?: string | null
          esi_number?: string | null
          finance_comments?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          firm_registration_no?: string | null
          gst_additional_places?: Json | null
          gst_business_nature?: string[] | null
          gst_constitution_of_business?: string | null
          gst_declaration_reason?: string | null
          gst_jurisdiction_centre?: string | null
          gst_jurisdiction_state?: string | null
          gst_principal_place_of_business?: string | null
          gst_registration_date?: string | null
          gst_status?: string | null
          gst_taxpayer_type?: string | null
          gst_verification_status?: string | null
          gstin?: string | null
          health_issues?: string | null
          id?: string
          iec_no?: string | null
          ifsc_code?: string | null
          industry_type?: string | null
          inspection_testing?: string | null
          invitation_id?: string | null
          is_gst_registered?: boolean | null
          is_msme_registered?: boolean | null
          labour_permit_no?: string | null
          lead_time_required?: string | null
          legal_name?: string | null
          machinery_availability?: string | null
          major_customer1?: string | null
          major_customer2?: string | null
          major_customer3?: string | null
          manpower?: string | null
          manufacturing_address?: string | null
          manufacturing_address_line2?: string | null
          manufacturing_address_line3?: string | null
          manufacturing_address_line4?: string | null
          manufacturing_city?: string | null
          manufacturing_email?: string | null
          manufacturing_fax?: string | null
          manufacturing_phone?: string | null
          manufacturing_pincode?: string | null
          manufacturing_state?: string | null
          memberships?: Json | null
          micr_code?: string | null
          msme_category?: string | null
          msme_number?: string | null
          msme_verification_status?: string | null
          name_match_verification_status?: string | null
          nearest_airport?: string | null
          nearest_bus_station?: string | null
          nearest_port?: string | null
          nearest_railway?: string | null
          operational_network?: string | null
          organization_type?: string | null
          ownership_type?: string | null
          pan?: string | null
          pan_verification_status?: string | null
          pennydrop_init?: boolean | null
          pennydrop_status?: Json | null
          pennydrop_verification_status?: string | null
          pf_number?: string | null
          power_supply?: string | null
          primary_contact_name?: string | null
          primary_designation?: string | null
          primary_email?: string | null
          primary_email_2?: string | null
          primary_phone?: string | null
          primary_phone_2?: string | null
          product_categories?: string[] | null
          product_types?: string[] | null
          product_types_other?: string | null
          production_capacity?: string | null
          production_contact_name?: string | null
          production_designation?: string | null
          production_email?: string | null
          production_facilities?: string[] | null
          production_phone?: string | null
          purchase_comments?: string | null
          purchase_reviewed_at?: string | null
          purchase_reviewed_by?: string | null
          quality_issues?: string | null
          raw_materials_used?: string | null
          registered_address?: string | null
          registered_address_line2?: string | null
          registered_address_line3?: string | null
          registered_address_line4?: string | null
          registered_city?: string | null
          registered_email?: string | null
          registered_fax?: string | null
          registered_phone?: string | null
          registered_pincode?: string | null
          registered_state?: string | null
          registered_website?: string | null
          safety_issues?: string | null
          same_as_registered?: boolean | null
          sap_synced_at?: string | null
          sap_vendor_code?: string | null
          secondary_contact_name?: string | null
          secondary_designation?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          self_declared?: boolean | null
          status?: Database["public"]["Enums"]["vendor_status"]
          store_capacity?: string | null
          submitted_at?: string | null
          supply_capacity?: string | null
          swift_iban_code?: string | null
          tenant_id?: string | null
          terms_accepted?: boolean | null
          trade_name?: string | null
          turnover_year1?: number | null
          turnover_year2?: number | null
          turnover_year3?: number | null
          updated_at?: string
          user_id?: string | null
          water_supply?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          authorized_distributor_address?: string | null
          authorized_distributor_name?: string | null
          bank_address?: string | null
          bank_branch_name?: string | null
          bank_name?: string | null
          bank_verification_status?: string | null
          branch_address?: string | null
          branch_address_line2?: string | null
          branch_address_line3?: string | null
          branch_address_line4?: string | null
          branch_city?: string | null
          branch_contact_designation?: string | null
          branch_contact_email?: string | null
          branch_contact_fax?: string | null
          branch_contact_name?: string | null
          branch_contact_phone?: string | null
          branch_country?: string | null
          branch_email?: string | null
          branch_name?: string | null
          branch_pincode?: string | null
          branch_state?: string | null
          branch_website?: string | null
          certifications?: Json | null
          communication_address?: string | null
          communication_city?: string | null
          communication_pincode?: string | null
          communication_state?: string | null
          created_at?: string
          credit_period_expected?: number | null
          custom_field_values?: Json
          customer_service_designation?: string | null
          customer_service_email?: string | null
          customer_service_name?: string | null
          customer_service_phone?: string | null
          dg_capacity?: string | null
          enlistments?: Json | null
          entity_type?: string | null
          environmental_issues?: string | null
          equipment_availability?: string | null
          esi_number?: string | null
          finance_comments?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          firm_registration_no?: string | null
          gst_additional_places?: Json | null
          gst_business_nature?: string[] | null
          gst_constitution_of_business?: string | null
          gst_declaration_reason?: string | null
          gst_jurisdiction_centre?: string | null
          gst_jurisdiction_state?: string | null
          gst_principal_place_of_business?: string | null
          gst_registration_date?: string | null
          gst_status?: string | null
          gst_taxpayer_type?: string | null
          gst_verification_status?: string | null
          gstin?: string | null
          health_issues?: string | null
          id?: string
          iec_no?: string | null
          ifsc_code?: string | null
          industry_type?: string | null
          inspection_testing?: string | null
          invitation_id?: string | null
          is_gst_registered?: boolean | null
          is_msme_registered?: boolean | null
          labour_permit_no?: string | null
          lead_time_required?: string | null
          legal_name?: string | null
          machinery_availability?: string | null
          major_customer1?: string | null
          major_customer2?: string | null
          major_customer3?: string | null
          manpower?: string | null
          manufacturing_address?: string | null
          manufacturing_address_line2?: string | null
          manufacturing_address_line3?: string | null
          manufacturing_address_line4?: string | null
          manufacturing_city?: string | null
          manufacturing_email?: string | null
          manufacturing_fax?: string | null
          manufacturing_phone?: string | null
          manufacturing_pincode?: string | null
          manufacturing_state?: string | null
          memberships?: Json | null
          micr_code?: string | null
          msme_category?: string | null
          msme_number?: string | null
          msme_verification_status?: string | null
          name_match_verification_status?: string | null
          nearest_airport?: string | null
          nearest_bus_station?: string | null
          nearest_port?: string | null
          nearest_railway?: string | null
          operational_network?: string | null
          organization_type?: string | null
          ownership_type?: string | null
          pan?: string | null
          pan_verification_status?: string | null
          pennydrop_init?: boolean | null
          pennydrop_status?: Json | null
          pennydrop_verification_status?: string | null
          pf_number?: string | null
          power_supply?: string | null
          primary_contact_name?: string | null
          primary_designation?: string | null
          primary_email?: string | null
          primary_email_2?: string | null
          primary_phone?: string | null
          primary_phone_2?: string | null
          product_categories?: string[] | null
          product_types?: string[] | null
          product_types_other?: string | null
          production_capacity?: string | null
          production_contact_name?: string | null
          production_designation?: string | null
          production_email?: string | null
          production_facilities?: string[] | null
          production_phone?: string | null
          purchase_comments?: string | null
          purchase_reviewed_at?: string | null
          purchase_reviewed_by?: string | null
          quality_issues?: string | null
          raw_materials_used?: string | null
          registered_address?: string | null
          registered_address_line2?: string | null
          registered_address_line3?: string | null
          registered_address_line4?: string | null
          registered_city?: string | null
          registered_email?: string | null
          registered_fax?: string | null
          registered_phone?: string | null
          registered_pincode?: string | null
          registered_state?: string | null
          registered_website?: string | null
          safety_issues?: string | null
          same_as_registered?: boolean | null
          sap_synced_at?: string | null
          sap_vendor_code?: string | null
          secondary_contact_name?: string | null
          secondary_designation?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          self_declared?: boolean | null
          status?: Database["public"]["Enums"]["vendor_status"]
          store_capacity?: string | null
          submitted_at?: string | null
          supply_capacity?: string | null
          swift_iban_code?: string | null
          tenant_id?: string | null
          terms_accepted?: boolean | null
          trade_name?: string | null
          turnover_year1?: number | null
          turnover_year2?: number | null
          turnover_year3?: number | null
          updated_at?: string
          user_id?: string | null
          water_supply?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "vendor_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_invitation: {
        Args: { _token: string; _vendor_id?: string }
        Returns: {
          email: string
          id: string
          used_at: string
          vendor_id: string
        }[]
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          phone_number: string
          tenant_id: string
          used_at: string
          vendor_name: string
        }[]
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
      record_invitation_access: {
        Args: { _token: string }
        Returns: {
          access_count: number
          email: string
          expires_at: string
          id: string
          phone_number: string
          tenant_id: string
          used_at: string
          vendor_name: string
        }[]
      }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "vendor"
        | "finance"
        | "purchase"
        | "admin"
        | "sharvi_admin"
        | "customer_admin"
        | "approver"
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
      app_role: [
        "vendor",
        "finance",
        "purchase",
        "admin",
        "sharvi_admin",
        "customer_admin",
        "approver",
      ],
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
