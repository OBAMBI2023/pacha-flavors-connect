export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" }
  public: {
    Tables: {
      profiles: {
        Row: { id: string; is_super_admin: boolean | null }
        Insert: { id: string; is_super_admin?: boolean | null }
        Update: { id?: string; is_super_admin?: boolean | null }
        Relationships: []
      }
      restaurants: {
        Row: {
          id: string
          slug: string
          name: string
          phone: string | null
          whatsapp_phone: string | null
          email: string | null
          address: string | null
          commune: string | null
          city: string | null
          status: "trial" | "active" | "suspended" | "archived"
          trial_ends_at: string | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          phone?: string | null
          whatsapp_phone?: string | null
          email?: string | null
          address?: string | null
          commune?: string | null
          city?: string | null
          status?: "trial" | "active" | "suspended" | "archived"
          trial_ends_at?: string | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          phone?: string | null
          whatsapp_phone?: string | null
          email?: string | null
          address?: string | null
          commune?: string | null
          city?: string | null
          status?: "trial" | "active" | "suspended" | "archived"
          trial_ends_at?: string | null
          is_public?: boolean
          created_at?: string
        }
        Relationships: []
      }
      restaurant_memberships: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string
          role: "owner" | "manager" | "staff"
          status: "active" | "invited" | "disabled" | null
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id: string
          role: "owner" | "manager" | "staff"
          status?: "active" | "invited" | "disabled" | null
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string
          role?: "owner" | "manager" | "staff"
          status?: "active" | "invited" | "disabled" | null
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: { id: string; restaurant_id: string; value: Json | null }
        Insert: { id?: string; restaurant_id: string; value?: Json | null }
        Update: { id?: string; restaurant_id?: string; value?: Json | null }
        Relationships: []
      }
      restaurant_categories: {
        Row: { id: string; restaurant_id: string; name: string; sort_order: number | null }
        Insert: { id?: string; restaurant_id: string; name: string; sort_order?: number | null }
        Update: { id?: string; restaurant_id?: string; name?: string; sort_order?: number | null }
        Relationships: []
      }
      restaurant_products: {
        Row: {
          id: string
          restaurant_id: string
          category_id: string | null
          slug: string
          name: string
          subtitle: string | null
          description: string
          price: number | null
          image_path: string | null
          is_available: boolean
          is_daily_menu: boolean
          sort_order: number | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          category_id?: string | null
          slug: string
          name: string
          subtitle?: string | null
          description?: string
          price?: number | null
          image_path?: string | null
          is_available?: boolean
          is_daily_menu?: boolean
          sort_order?: number | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          category_id?: string | null
          slug?: string
          name?: string
          subtitle?: string | null
          description?: string
          price?: number | null
          image_path?: string | null
          is_available?: boolean
          is_daily_menu?: boolean
          sort_order?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          restaurant_id: string
          order_id: string | null
          type: string
          channel: string
          title: string
          body: string | null
          metadata: Json
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          order_id?: string | null
          type: string
          channel?: string
          title: string
          body?: string | null
          metadata?: Json
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          order_id?: string | null
          type?: string
          channel?: string
          title?: string
          body?: string | null
          metadata?: Json
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_public_menu: {
        Args: { p_slug: string }
        Returns: Json
      }
      create_order: {
        Args: {
          p_slug: string
          p_fulfillment_type: "delivery" | "pickup"
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_delivery_commune?: string | null
          p_delivery_address?: string | null
          p_delivery_instructions?: string | null
          p_customer_notes?: string | null
          p_order_source?: string | null
          p_source_metadata?: Json | null
          p_payment_method?: string | null
        }
        Returns: Json
      }
      update_order_status: {
        Args: {
          p_order_id: string
          p_new_status: "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled"
          p_note?: string | null
        }
        Returns: Json
      }
      get_restaurant_dashboard_stats: {
        Args: { p_start_date: string; p_end_date: string }
        Returns: Json
      }
      mark_cash_payment_received: {
        Args: { p_order_id: string }
        Returns: Json
      }
      create_refund: {
        Args: { p_order_id: string; p_amount: number; p_reason?: string | null }
        Returns: Json
      }
      super_admin_add_restaurant_member: {
        Args: { _restaurant_id: string; _email: string; _role: "owner" | "manager" | "staff" }
        Returns: { user_id: string; restaurant_id: string; role: "owner" | "manager" | "staff" }
      }
      super_admin_list_restaurant_members: {
        Args: { _restaurant_id: string }
        Returns: { user_id: string; restaurant_id: string; role: "owner" | "manager" | "staff"; status: string | null; email: string | null }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Row: infer R } ? R : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never : never

export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never : never

export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never : never

export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals }, EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = never
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals }, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = never
