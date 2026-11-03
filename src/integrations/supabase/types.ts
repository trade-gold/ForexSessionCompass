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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          academy_name: string
          activated_at: string | null
          contact_name: string
          country: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          academy_name: string
          activated_at?: string | null
          contact_name: string
          country?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          academy_name?: string
          activated_at?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          payment_instructions: string
          updated_at: string
        }
        Insert: {
          id?: number
          payment_instructions?: string
          updated_at?: string
        }
        Update: {
          id?: number
          payment_instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_note: string | null
          amount_cents: number | null
          created_at: string
          currency: string
          id: string
          method: string
          plan_id: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_cents?: number | null
          created_at?: string
          currency?: string
          id?: string
          method: string
          plan_id: string
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          plan_id?: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          currency: string
          description: string
          features: string[]
          id: string
          is_active: boolean
          name: string
          period_days: number
          price_cents: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          currency?: string
          description?: string
          features?: string[]
          id: string
          is_active?: boolean
          name: string
          period_days?: number
          price_cents?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          currency?: string
          description?: string
          features?: string[]
          id?: string
          is_active?: boolean
          name?: string
          period_days?: number
          price_cents?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          expires_at: string
          id: string
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          plan_id: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          plan_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_payment: {
        Args: { p_approve: boolean; p_note?: string; p_payment_id: string }
        Returns: {
          admin_note: string | null
          amount_cents: number | null
          created_at: string
          currency: string
          id: string
          method: string
          plan_id: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_academy_access: {
        Args: { p_academy_id: string; p_action: string }
        Returns: {
          academy_name: string
          activated_at: string | null
          contact_name: string
          country: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "academies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_payment_instructions: {
        Args: { p_text: string }
        Returns: undefined
      }
      admin_set_subscription: {
        Args: { p_action: string; p_plan_id: string; p_user_id: string }
        Returns: {
          expires_at: string
          id: string
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_stats: {
        Args: never
        Returns: {
          active_subscriptions: number
          pending_payments: number
          total_users: number
          verified_payments: number
        }[]
      }
      admin_update_plan: {
        Args: {
          p_currency: string
          p_description: string
          p_features: string[]
          p_id: string
          p_is_active: boolean
          p_name: string
          p_period_days: number
          p_price_cents: number
        }
        Returns: {
          currency: string
          description: string
          features: string[]
          id: string
          is_active: boolean
          name: string
          period_days: number
          price_cents: number | null
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_academy_access: {
        Args: never
        Returns: {
          academy_name: string
          activated_at: string
          expires_at: string
          is_active: boolean
          status: string
        }[]
      }
      get_my_entitlements: {
        Args: never
        Returns: {
          expires_at: string
          features: string[]
          is_admin: boolean
          plan_id: string
          plan_name: string
          status: string
        }[]
      }
      has_feature: { Args: { p_feature: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      submit_payment: {
        Args: { p_method: string; p_plan_id: string; p_reference: string }
        Returns: {
          admin_note: string | null
          amount_cents: number | null
          created_at: string
          currency: string
          id: string
          method: string
          plan_id: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
