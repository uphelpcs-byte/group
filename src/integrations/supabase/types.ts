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
      attendance_records: {
        Row: {
          adjusted_hours: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          meal_duration: number | null
          meal_in: string | null
          meal_out: string | null
          notes: string | null
          total_hours: number | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          adjusted_hours?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          meal_duration?: number | null
          meal_in?: string | null
          meal_out?: string | null
          notes?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          adjusted_hours?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          meal_duration?: number | null
          meal_in?: string | null
          meal_out?: string | null
          notes?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      client_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_channels: {
        Row: {
          channel_identifier: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          client_id: string
          created_at: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          channel_identifier?: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          channel_identifier?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_channels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          is_primary: boolean | null
          name: string
          phone: string | null
          position: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          client_id: string
          contract_file_path: string | null
          created_at: string
          end_date: string | null
          fee_structure: Json | null
          id: string
          monthly_fee: number | null
          notes: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_file_path?: string | null
          created_at?: string
          end_date?: string | null
          fee_structure?: Json | null
          id?: string
          monthly_fee?: number | null
          notes?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_file_path?: string | null
          created_at?: string
          end_date?: string | null
          fee_structure?: Json | null
          id?: string
          monthly_fee?: number | null
          notes?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          base_amount: number
          billed_amount: number
          billing_month: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_issued: boolean
          invoice_issued_date: string | null
          is_paid: boolean
          is_prorated: boolean
          notes: string | null
          paid_date: string | null
          prorate_business_days: number | null
          total_business_days: number | null
          updated_at: string
        }
        Insert: {
          base_amount?: number
          billed_amount?: number
          billing_month: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_issued?: boolean
          invoice_issued_date?: string | null
          is_paid?: boolean
          is_prorated?: boolean
          notes?: string | null
          paid_date?: string | null
          prorate_business_days?: number | null
          total_business_days?: number | null
          updated_at?: string
        }
        Update: {
          base_amount?: number
          billed_amount?: number
          billing_month?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_issued?: boolean
          invoice_issued_date?: string | null
          is_paid?: boolean
          is_prorated?: boolean
          notes?: string | null
          paid_date?: string | null
          prorate_business_days?: number | null
          total_business_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          business_number: string | null
          channeltalk_access_key: string | null
          channeltalk_secret: string | null
          contract_start_date: string | null
          contract_end_date: string | null
          created_at: string
          id: string
          industry: string | null
          manager_email: string | null
          monthly_fee: number | null
          name: string
          notes: string | null
          report_show_first_response: boolean
          report_show_response_rate: boolean
          report_show_tags: boolean
          report_top_comment: string | null
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          channeltalk_access_key?: string | null
          channeltalk_secret?: string | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          manager_email?: string | null
          monthly_fee?: number | null
          name: string
          notes?: string | null
          report_show_first_response?: boolean
          report_show_response_rate?: boolean
          report_show_tags?: boolean
          report_top_comment?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_number?: string | null
          channeltalk_access_key?: string | null
          channeltalk_secret?: string | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          manager_email?: string | null
          monthly_fee?: number | null
          name?: string
          notes?: string | null
          report_show_first_response?: boolean
          report_show_response_rate?: boolean
          report_show_tags?: boolean
          report_top_comment?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          agent_id: string
          channel_id: string | null
          client_id: string
          consultation_type: string | null
          content: string
          created_at: string
          customer_contact: string | null
          customer_name: string | null
          id: string
          status: Database["public"]["Enums"]["consultation_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          channel_id?: string | null
          client_id: string
          consultation_type?: string | null
          content: string
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["consultation_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          channel_id?: string | null
          client_id?: string
          consultation_type?: string | null
          content?: string
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["consultation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "client_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          client_id: string
          consultation_id: string | null
          created_at: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          consultation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          consultation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          content: string
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          meeting_id: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          meeting_id: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          content: string
          created_at: string
          id: string
          item_order: number
          meeting_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          item_order?: number
          meeting_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          item_order?: number
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          meeting_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_date: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_sensitive: {
        Row: {
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_name: string | null
          resident_number: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          resident_number?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          resident_number?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_sensitive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payments: {
        Row: {
          paid: boolean
          paid_at: string
          paid_by: string | null
          pay_month: string
          user_id: string
        }
        Insert: {
          paid?: boolean
          paid_at?: string
          paid_by?: string | null
          pay_month: string
          user_id: string
        }
        Update: {
          paid?: boolean
          paid_at?: string
          paid_by?: string | null
          pay_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          hourly_rate: number
          id: string
          notes: string | null
          training_end_date: string | null
          training_hourly_rate: number | null
          training_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from?: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          training_end_date?: string | null
          training_hourly_rate?: number | null
          training_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          training_end_date?: string | null
          training_hourly_rate?: number | null
          training_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          base_pay: number
          created_at: string
          hourly_rate: number
          id: string
          issued_at: string
          issued_by: string | null
          memo: string | null
          pay_month: string
          total_hours: number
          total_pay: number
          updated_at: string
          user_id: string
          weekly_breakdown: Json | null
          weekly_holiday_pay: number
        }
        Insert: {
          base_pay?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          memo?: string | null
          pay_month: string
          total_hours?: number
          total_pay?: number
          updated_at?: string
          user_id: string
          weekly_breakdown?: Json | null
          weekly_holiday_pay?: number
        }
        Update: {
          base_pay?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          memo?: string | null
          pay_month?: string
          total_hours?: number
          total_pay?: number
          updated_at?: string
          user_id?: string
          weekly_breakdown?: Json | null
          weekly_holiday_pay?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_all_day: boolean
          leave_date: string
          reason: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          leave_date: string
          reason?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          leave_date?: string
          reason?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_schedules: {
        Row: {
          agenda: string | null
          company_name: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_time: string
          reminded_d1: boolean
          reminded_dday: boolean
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_time: string
          reminded_d1?: boolean
          reminded_dday?: boolean
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_time?: string
          reminded_d1?: boolean
          reminded_dday?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_checkpoints: {
        Row: {
          checkpoint_order: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          phase: string
          pilot_id: string
          title: string
          updated_at: string
        }
        Insert: {
          checkpoint_order: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          phase: string
          pilot_id: string
          title: string
          updated_at?: string
        }
        Update: {
          checkpoint_order?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          phase?: string
          pilot_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_checkpoints_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_projects: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          position: string | null
          updated_at: string
          work_status: Database["public"]["Enums"]["work_status"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          work_status?: Database["public"]["Enums"]["work_status"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          work_status?: Database["public"]["Enums"]["work_status"]
        }
        Relationships: []
      }
      report_send_history: {
        Row: {
          client_id: string
          id: string
          period_end: string | null
          period_start: string | null
          report_type: string
          sent_at: string
          sent_by: string | null
          sent_to: string | null
          subject: string | null
        }
        Insert: {
          client_id: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type: string
          sent_at?: string
          sent_by?: string | null
          sent_to?: string | null
          subject?: string | null
        }
        Update: {
          client_id?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type?: string
          sent_at?: string
          sent_by?: string | null
          sent_to?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      schedule_assignments: {
        Row: {
          assigned_by: string
          availability_id: string
          client_id: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          assigned_by: string
          availability_id: string
          client_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          assigned_by?: string
          availability_id?: string
          client_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "schedule_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tools: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          login_id: string | null
          login_password: string | null
          name: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          name: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          name?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_client_access: { Args: { _client_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_plus: { Args: never; Returns: boolean }
      process_meeting_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "director" | "manager" | "agent" | "contractor"
      channel_type: "channel_talk" | "kakao" | "phone" | "email" | "other"
      consultation_status: "pending" | "in_progress" | "completed" | "escalated"
      contract_status: "pilot" | "active" | "terminated"
      issue_priority: "low" | "medium" | "high" | "critical"
      issue_status: "open" | "in_progress" | "resolved" | "closed"
      task_status: "pending" | "in_progress" | "review" | "completed"
      work_status: "active" | "freelancer" | "on_leave" | "resigned"
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
      app_role: ["admin", "director", "manager", "agent", "contractor"],
      channel_type: ["channel_talk", "kakao", "phone", "email", "other"],
      consultation_status: ["pending", "in_progress", "completed", "escalated"],
      contract_status: ["pilot", "active", "terminated"],
      issue_priority: ["low", "medium", "high", "critical"],
      issue_status: ["open", "in_progress", "resolved", "closed"],
      task_status: ["pending", "in_progress", "review", "completed"],
      work_status: ["active", "freelancer", "on_leave", "resigned"],
    },
  },
} as const
