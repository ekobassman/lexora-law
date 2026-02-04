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
      ai_sessions: {
        Row: {
          case_id: string | null
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          last_message_at: string
          max_messages: number
          message_count: number
          started_at: string
          user_id: string
          ym: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string
          max_messages?: number
          message_count?: number
          started_at?: string
          user_id: string
          ym: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string
          max_messages?: number
          message_count?: number
          started_at?: string
          user_id?: string
          ym?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      case_chat_messages: {
        Row: {
          case_id: string
          content: string
          created_at: string
          id: string
          language: string
          role: string
          scope: string
          user_id: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          id?: string
          language?: string
          role: string
          scope?: string
          user_id: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          language?: string
          role?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_chat_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      case_context_pack: {
        Row: {
          case_id: string
          context_text: string
          language: string
          source_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          context_text?: string
          language?: string
          source_hash?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          context_text?: string
          language?: string
          source_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_context_pack_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          action_type: string
          case_id: string | null
          created_at: string
          delta: number
          id: string
          meta: Json
          pratica_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          case_id?: string | null
          created_at?: string
          delta: number
          id?: string
          meta?: Json
          pratica_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          case_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          meta?: Json
          pratica_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_chat_messages: {
        Row: {
          created_at: string
          id: string
          message_date: string
          messages_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_date?: string
          messages_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_date?: string
          messages_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          detected_aktenzeichen: string | null
          detected_authority: string | null
          detected_date: string | null
          detected_deadline: string | null
          direction: string
          document_type: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          pratica_id: string
          raw_text: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_aktenzeichen?: string | null
          detected_authority?: string | null
          detected_date?: string | null
          detected_deadline?: string | null
          direction: string
          document_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          pratica_id: string
          raw_text?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_aktenzeichen?: string | null
          detected_authority?: string | null
          detected_date?: string | null
          detected_deadline?: string | null
          direction?: string
          document_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          pratica_id?: string
          raw_text?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      global_stats: {
        Row: {
          documents_processed: number
          id: string
          updated_at: string
        }
        Insert: {
          documents_processed?: number
          id?: string
          updated_at?: string
        }
        Update: {
          documents_processed?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_acceptance_events: {
        Row: {
          accepted_at: string
          age_policy_version: string | null
          country_code: string | null
          event_type: string
          id: string
          ip_hash: string | null
          privacy_version: string | null
          terms_version: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          age_policy_version?: string | null
          country_code?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          privacy_version?: string | null
          terms_version?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          age_policy_version?: string | null
          country_code?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          privacy_version?: string | null
          terms_version?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_versions: {
        Row: {
          doc_type: string
          published_at: string
          summary: string
          version: string
        }
        Insert: {
          doc_type: string
          published_at?: string
          summary?: string
          version: string
        }
        Update: {
          doc_type?: string
          published_at?: string
          summary?: string
          version?: string
        }
        Relationships: []
      }
      plan_override_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          new_is_active: boolean | null
          new_plan: string | null
          old_is_active: boolean | null
          old_plan: string | null
          reason: string | null
          target_user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_is_active?: boolean | null
          new_plan?: string | null
          old_is_active?: boolean | null
          old_plan?: string | null
          reason?: string | null
          target_user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_is_active?: boolean | null
          new_plan?: string | null
          old_is_active?: boolean | null
          old_plan?: string | null
          reason?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_override_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_override_audit_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          plan: string
          plan_code: string | null
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan: string
          plan_code?: string | null
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan?: string
          plan_code?: string | null
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pratiche: {
        Row: {
          aktenzeichen: string | null
          authority: string | null
          calendar_event_created: boolean | null
          chat_history: Json | null
          created_at: string
          deadline: string | null
          deadline_source: string | null
          draft_response: string | null
          explanation: string | null
          file_url: string | null
          id: string
          letter_text: string | null
          reminders: Json | null
          risks: Json | null
          sender_address: string | null
          sender_city: string | null
          sender_country: string | null
          sender_date: string | null
          sender_name: string | null
          sender_postal_code: string | null
          status: string
          title: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aktenzeichen?: string | null
          authority?: string | null
          calendar_event_created?: boolean | null
          chat_history?: Json | null
          created_at?: string
          deadline?: string | null
          deadline_source?: string | null
          draft_response?: string | null
          explanation?: string | null
          file_url?: string | null
          id?: string
          letter_text?: string | null
          reminders?: Json | null
          risks?: Json | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_date?: string | null
          sender_name?: string | null
          sender_postal_code?: string | null
          status?: string
          title: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aktenzeichen?: string | null
          authority?: string | null
          calendar_event_created?: boolean | null
          chat_history?: Json | null
          created_at?: string
          deadline?: string | null
          deadline_source?: string | null
          draft_response?: string | null
          explanation?: string | null
          file_url?: string | null
          id?: string
          letter_text?: string | null
          reminders?: Json | null
          risks?: Json | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_date?: string | null
          sender_name?: string | null
          sender_postal_code?: string | null
          status?: string
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_state: string | null
          address: string | null
          age_confirmed: boolean | null
          age_policy_version: string | null
          ai_language_level: string | null
          auto_save_drafts: boolean | null
          auto_update_draft_on_ai: boolean | null
          auto_update_letter_on_upload: boolean | null
          auto_use_sender_data: boolean | null
          billing_period_start: string | null
          cases_limit: number
          cases_used: number
          city: string | null
          country: string | null
          created_at: string
          default_ai_language: string | null
          default_tone_setting: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_family: boolean | null
          last_billing_email_at: string | null
          last_billing_event_id: string | null
          last_login_at: string | null
          last_name: string | null
          last_payment_error_code: string | null
          last_payment_error_message: string | null
          last_payment_failed_at: string | null
          last_seen_at: string | null
          max_documents_per_pratica: number | null
          payment_failed_at: string | null
          payment_status: string
          phone: string | null
          plan: string
          plan_override: string | null
          postal_code: string | null
          preferred_language: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          sender_address: string | null
          sender_city: string | null
          sender_country: string | null
          sender_full_name: string | null
          sender_location: string | null
          sender_postal_code: string | null
          sender_signature: string | null
          stripe_customer_id: string | null
          stripe_status: string | null
          stripe_subscription_id: string | null
          suggest_legal_references: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          access_state?: string | null
          address?: string | null
          age_confirmed?: boolean | null
          age_policy_version?: string | null
          ai_language_level?: string | null
          auto_save_drafts?: boolean | null
          auto_update_draft_on_ai?: boolean | null
          auto_update_letter_on_upload?: boolean | null
          auto_use_sender_data?: boolean | null
          billing_period_start?: string | null
          cases_limit?: number
          cases_used?: number
          city?: string | null
          country?: string | null
          created_at?: string
          default_ai_language?: string | null
          default_tone_setting?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_family?: boolean | null
          last_billing_email_at?: string | null
          last_billing_event_id?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_payment_error_code?: string | null
          last_payment_error_message?: string | null
          last_payment_failed_at?: string | null
          last_seen_at?: string | null
          max_documents_per_pratica?: number | null
          payment_failed_at?: string | null
          payment_status?: string
          phone?: string | null
          plan?: string
          plan_override?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_full_name?: string | null
          sender_location?: string | null
          sender_postal_code?: string | null
          sender_signature?: string | null
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          suggest_legal_references?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          access_state?: string | null
          address?: string | null
          age_confirmed?: boolean | null
          age_policy_version?: string | null
          ai_language_level?: string | null
          auto_save_drafts?: boolean | null
          auto_update_draft_on_ai?: boolean | null
          auto_update_letter_on_upload?: boolean | null
          auto_use_sender_data?: boolean | null
          billing_period_start?: string | null
          cases_limit?: number
          cases_used?: number
          city?: string | null
          country?: string | null
          created_at?: string
          default_ai_language?: string | null
          default_tone_setting?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_family?: boolean | null
          last_billing_email_at?: string | null
          last_billing_event_id?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_payment_error_code?: string | null
          last_payment_error_message?: string | null
          last_payment_failed_at?: string | null
          last_seen_at?: string | null
          max_documents_per_pratica?: number | null
          payment_failed_at?: string | null
          payment_status?: string
          phone?: string | null
          plan?: string
          plan_override?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_full_name?: string | null
          sender_location?: string | null
          sender_postal_code?: string | null
          sender_signature?: string | null
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          suggest_legal_references?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions_state: {
        Row: {
          is_active: boolean
          monthly_ai_softcap: number
          monthly_case_limit: number
          monthly_credit_refill: number
          period_end: string | null
          period_start: string | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_active?: boolean
          monthly_ai_softcap?: number
          monthly_case_limit?: number
          monthly_credit_refill?: number
          period_end?: string | null
          period_start?: string | null
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_active?: boolean
          monthly_ai_softcap?: number
          monthly_case_limit?: number
          monthly_credit_refill?: number
          period_end?: string | null
          period_start?: string | null
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters_monthly: {
        Row: {
          ai_sessions_started: number
          cases_created: number
          credits_spent: number
          id: string
          updated_at: string
          user_id: string
          ym: string
        }
        Insert: {
          ai_sessions_started?: number
          cases_created?: number
          credits_spent?: number
          id?: string
          updated_at?: string
          user_id: string
          ym: string
        }
        Update: {
          ai_sessions_started?: number
          cases_created?: number
          credits_spent?: number
          id?: string
          updated_at?: string
          user_id?: string
          ym?: string
        }
        Relationships: []
      }
      user_legal_acceptances: {
        Row: {
          accepted_at: string | null
          accepted_disclaimer_version: string | null
          accepted_privacy_version: string | null
          accepted_terms_version: string | null
          accepted_user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_disclaimer_version?: string | null
          accepted_privacy_version?: string | null
          accepted_terms_version?: string | null
          accepted_user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_disclaimer_version?: string | null
          accepted_privacy_version?: string | null
          accepted_terms_version?: string | null
          accepted_user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_key: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          cases_created: number
          id: string
          last_reset_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cases_created?: number
          id?: string
          last_reset_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cases_created?: number
          id?: string
          last_reset_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallet: {
        Row: {
          balance_credits: number
          lifetime_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_credits?: number
          lifetime_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_credits?: number
          lifetime_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_cases_created: {
        Args: { _user_id: string; _ym: string }
        Returns: number
      }
      increment_documents_processed: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
