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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_member_id: string | null
          actor_name: string | null
          client_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          follow_up_id: string | null
          id: string
          invoice_id: string | null
          lead_id: string | null
          metadata: Json
          occurred_at: string
          organization_id: string
          title: string
          type: string
        }
        Insert: {
          actor_member_id?: string | null
          actor_name?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          follow_up_id?: string | null
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          metadata?: Json
          occurred_at?: string
          organization_id: string
          title: string
          type: string
        }
        Update: {
          actor_member_id?: string | null
          actor_name?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          follow_up_id?: string | null
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_invoice_fk"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_member_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          last_run_at: string | null
          name: string
          organization_id: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name: string
          organization_id: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name?: string
          organization_id?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          job_title: string | null
          name: string
          organization_id: string
          phone: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          name: string
          organization_id: string
          phone?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          billing_address: string | null
          client_code: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          industry: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          public_id: string
          shipping_address: string | null
          status: Database["public"]["Enums"]["client_status"]
          tax_number: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          billing_address?: string | null
          client_code?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          public_id?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          billing_address?: string | null
          client_code?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          public_id?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          created_at: string
          default_probability: number
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_probability?: number
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_probability?: number
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_member_id: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          deal_number: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["lead_priority"]
          probability: number
          public_id: string
          source: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
          value: number
          weighted_value: number
        }
        Insert: {
          assigned_member_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_number?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          probability?: number
          public_id?: string
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          value?: number
          weighted_value?: number
        }
        Update: {
          assigned_member_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_number?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          probability?: number
          public_id?: string
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          value?: number
          weighted_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_member_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string
          id: string
          invoice_id: string | null
          lead_id: string | null
          meeting_link: string | null
          notes: string | null
          organization_id: string
          outcome: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          reminder_minutes: number | null
          rescheduled_from: string | null
          status: Database["public"]["Enums"]["followup_status"]
          subject: string | null
          type: Database["public"]["Enums"]["followup_type"]
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at: string
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          organization_id: string
          outcome?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          reminder_minutes?: number | null
          rescheduled_from?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          subject?: string | null
          type?: Database["public"]["Enums"]["followup_type"]
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          organization_id?: string
          outcome?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          reminder_minutes?: number | null
          rescheduled_from?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          subject?: string | null
          type?: Database["public"]["Enums"]["followup_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_invoice_fk"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          accent_color: string
          auto_create_lead: boolean
          created_at: string
          created_by: string | null
          default_assigned_to: string | null
          default_deal_stage_id: string | null
          default_lead_source_id: string | null
          default_theme: string
          description: string | null
          id: string
          is_active: boolean
          organization_id: string
          redirect_url: string | null
          slug: string
          submission_count: number
          submit_button_text: string
          success_message: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          auto_create_lead?: boolean
          created_at?: string
          created_by?: string | null
          default_assigned_to?: string | null
          default_deal_stage_id?: string | null
          default_lead_source_id?: string | null
          default_theme?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          redirect_url?: string | null
          slug: string
          submission_count?: number
          submit_button_text?: string
          success_message?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          auto_create_lead?: boolean
          created_at?: string
          created_by?: string | null
          default_assigned_to?: string | null
          default_deal_stage_id?: string | null
          default_lead_source_id?: string | null
          default_theme?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          redirect_url?: string | null
          slug?: string
          submission_count?: number
          submit_button_text?: string
          success_message?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_type: string
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          map_to_lead_field: string | null
          options: Json | null
          placeholder: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_type?: string
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          map_to_lead_field?: string | null
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_type?: string
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          map_to_lead_field?: string | null
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          data: Json
          form_id: string
          id: string
          ip_address: string | null
          lead_id: string | null
          organization_id: string
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          data?: Json
          form_id: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          organization_id: string
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          data?: Json
          form_id?: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          organization_id?: string
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          discount_percent: number
          id: string
          invoice_id: string
          line_total: number
          organization_id: string
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          description: string
          discount_percent?: number
          id?: string
          invoice_id: string
          line_total?: number
          organization_id: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Update: {
          description?: string
          discount_percent?: number
          id?: string
          invoice_id?: string
          line_total?: number
          organization_id?: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          discount_total: number
          due_date: string
          id: string
          invoice_number: string | null
          issue_date: string
          notes: string | null
          organization_id: string
          outstanding_amount: number
          paid_amount: number
          public_id: string
          quotation_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_total?: number
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          organization_id: string
          outstanding_amount?: number
          paid_amount?: number
          public_id?: string
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_total?: number
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          organization_id?: string
          outstanding_amount?: number
          paid_amount?: number
          public_id?: string
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          lead_id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          alt_phone: string | null
          assigned_member_id: string | null
          city: string | null
          company: string | null
          converted_at: string | null
          converted_client_id: string | null
          converted_deal_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          estimated_value: number
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          last_contacted_at: string | null
          last_name: string | null
          lead_number: string | null
          next_followup_at: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          public_id: string
          source_id: string | null
          state: string | null
          status_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          assigned_member_id?: string | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          converted_deal_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number
          first_name: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_number?: string | null
          next_followup_at?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          public_id?: string
          source_id?: string | null
          state?: string | null
          status_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          assigned_member_id?: string | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          converted_deal_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_number?: string | null
          next_followup_at?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          public_id?: string
          source_id?: string | null
          state?: string | null
          status_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_deal_fk"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          member_id: string
          organization_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          member_id: string
          organization_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          member_id?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          deal_prefix: string
          default_payment_terms_days: number
          default_tax_percent: number
          invoice_prefix: string
          lead_prefix: string
          organization_id: string
          payment_prefix: string
          quotation_prefix: string
          reminder_defaults: Json
          updated_at: string
        }
        Insert: {
          deal_prefix?: string
          default_payment_terms_days?: number
          default_tax_percent?: number
          invoice_prefix?: string
          lead_prefix?: string
          organization_id: string
          payment_prefix?: string
          quotation_prefix?: string
          reminder_defaults?: Json
          updated_at?: string
        }
        Update: {
          deal_prefix?: string
          default_payment_terms_days?: number
          default_tax_percent?: number
          invoice_prefix?: string
          lead_prefix?: string
          organization_id?: string
          payment_prefix?: string
          quotation_prefix?: string
          reminder_defaults?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          invited_at: string
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          currency_symbol: string
          date_format: string
          email: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          phone: string | null
          public_id: string
          slug: string
          state: string | null
          tax_number: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          date_format?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          phone?: string | null
          public_id?: string
          slug: string
          state?: string | null
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          date_format?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          phone?: string | null
          public_id?: string
          slug?: string
          state?: string | null
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          organization_id: string
          paid_on: string
          payment_number: string | null
          public_id: string
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id: string
          paid_on?: string
          payment_number?: string | null
          public_id?: string
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id?: string
          paid_on?: string
          payment_number?: string | null
          public_id?: string
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_clients: number | null
          max_leads: number | null
          max_users: number | null
          name: string
          price_monthly: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_clients?: number | null
          max_leads?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_clients?: number | null
          max_leads?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          sort_order?: number
        }
        Relationships: []
      }
      product_collections: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          code: string | null
          collection_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["product_kind"]
          name: string
          notes: string | null
          organization_id: string
          sort_order: number
          tax_percent: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          collection_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name: string
          notes?: string | null
          organization_id: string
          sort_order?: number
          tax_percent?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          collection_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name?: string
          notes?: string | null
          organization_id?: string
          sort_order?: number
          tax_percent?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          description: string
          discount_percent: number
          id: string
          line_total: number
          organization_id: string
          quantity: number
          quotation_id: string
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          description: string
          discount_percent?: number
          id?: string
          line_total?: number
          organization_id: string
          quantity?: number
          quotation_id: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Update: {
          description?: string
          discount_percent?: number
          id?: string
          line_total?: number
          organization_id?: string
          quantity?: number
          quotation_id?: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          discount_total: number
          expiry_date: string | null
          id: string
          issue_date: string
          notes: string | null
          organization_id: string
          public_id: string
          quotation_number: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_total?: number
          expiry_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          public_id?: string
          quotation_number?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_total?: number
          expiry_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          public_id?: string
          quotation_number?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      record_products: {
        Row: {
          created_at: string
          follow_up_id: string | null
          id: string
          lead_id: string | null
          note: string | null
          organization_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          follow_up_id?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id: string
          product_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          follow_up_id?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_products_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          organization_id: string
          plan_id: string
          renews_at: string | null
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          plan_id: string
          renews_at?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          plan_id?: string
          renews_at?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_member_id: { Args: { _org: string }; Returns: string }
      has_perm: { Args: { _org: string; _perm: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      next_record_number: {
        Args: {
          _column: string
          _org_id: string
          _prefix: string
          _table: string
        }
        Returns: string
      }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "sales_manager"
        | "sales_executive"
        | "accountant"
      client_status: "active" | "inactive" | "vip" | "at_risk" | "lost"
      deal_status: "open" | "won" | "lost"
      followup_status: "pending" | "completed" | "rescheduled" | "cancelled"
      followup_type:
        | "call"
        | "whatsapp"
        | "email"
        | "meeting"
        | "proposal"
        | "payment_reminder"
        | "demo"
        | "other"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      lead_priority: "low" | "medium" | "high" | "urgent"
      member_status: "active" | "invited" | "disabled"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "upi"
        | "card"
        | "cheque"
        | "other"
      payment_status: "recorded" | "reversed"
      product_kind: "service" | "product"
      quotation_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
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
        "owner",
        "admin",
        "sales_manager",
        "sales_executive",
        "accountant",
      ],
      client_status: ["active", "inactive", "vip", "at_risk", "lost"],
      deal_status: ["open", "won", "lost"],
      followup_status: ["pending", "completed", "rescheduled", "cancelled"],
      followup_type: [
        "call",
        "whatsapp",
        "email",
        "meeting",
        "proposal",
        "payment_reminder",
        "demo",
        "other",
      ],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      lead_priority: ["low", "medium", "high", "urgent"],
      member_status: ["active", "invited", "disabled"],
      payment_method: [
        "cash",
        "bank_transfer",
        "upi",
        "card",
        "cheque",
        "other",
      ],
      payment_status: ["recorded", "reversed"],
      product_kind: ["service", "product"],
      quotation_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
    },
  },
} as const
