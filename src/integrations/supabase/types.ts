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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proposals: {
        Row: {
          created_at: string
          distance_km: number | null
          driver_id: string
          expires_at: string
          id: string
          order_id: string
          responded_at: string | null
          restaurant_id: string
          sent_at: string
          status: Database["public"]["Enums"]["delivery_proposal_status"]
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          driver_id: string
          expires_at: string
          id?: string
          order_id: string
          responded_at?: string | null
          restaurant_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["delivery_proposal_status"]
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string
          expires_at?: string
          id?: string
          order_id?: string
          responded_at?: string | null
          restaurant_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["delivery_proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proposals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proposals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proposals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          phone: string
          restaurant_id: string
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          phone: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          phone?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          is_read: boolean
          metadata: Json
          order_id: string | null
          restaurant_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          order_id?: string | null
          restaurant_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          order_id?: string | null
          restaurant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          created_at: string
          extra_price_snapshot: number
          id: string
          option_group_name_snapshot: string
          option_id: string | null
          option_name_snapshot: string
          order_item_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          extra_price_snapshot?: number
          id?: string
          option_group_name_snapshot: string
          option_id?: string | null
          option_name_snapshot: string
          order_item_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          extra_price_snapshot?: number
          id?: string
          option_group_name_snapshot?: string
          option_id?: string | null
          option_name_snapshot?: string
          order_item_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_notes: string | null
          line_total: number
          options_price_snapshot: number
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          restaurant_id: string
          unit_price_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_notes?: string | null
          line_total: number
          options_price_snapshot?: number
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          restaurant_id: string
          unit_price_snapshot: number
        }
        Update: {
          created_at?: string
          id?: string
          item_notes?: string | null
          line_total?: number
          options_price_snapshot?: number
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          restaurant_id?: string
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          restaurant_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_driver_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_commune: string | null
          delivery_dispatch_status: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_fee_amount: number
          delivery_instructions: string | null
          discount_amount: number
          driver_delivery_status:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          id: string
          item_count: number
          order_number: number
          order_source: string
          out_for_delivery_at: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          preparing_at: string | null
          ready_at: string | null
          restaurant_id: string
          source_metadata: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          assigned_driver_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_commune?: string | null
          delivery_dispatch_status?: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_fee_amount?: number
          delivery_instructions?: string | null
          discount_amount?: number
          driver_delivery_status?:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          id?: string
          item_count?: number
          order_number: number
          order_source?: string
          out_for_delivery_at?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          preparing_at?: string | null
          ready_at?: string | null
          restaurant_id: string
          source_metadata?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          assigned_driver_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_commune?: string | null
          delivery_dispatch_status?: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_fee_amount?: number
          delivery_instructions?: string | null
          discount_amount?: number
          driver_delivery_status?:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          fulfillment_type?: Database["public"]["Enums"]["order_fulfillment_type"]
          id?: string
          item_count?: number
          order_number?: number
          order_source?: string
          out_for_delivery_at?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          preparing_at?: string | null
          ready_at?: string | null
          restaurant_id?: string
          source_metadata?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at: string | null
          provider: string | null
          provider_reference: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          price_amount: number
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id: string
          is_active?: boolean
          name: string
          price_amount?: number
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_amount?: number
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          max_select: number | null
          min_select: number
          name: string
          product_id: string
          restaurant_id: string
          selection_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name: string
          product_id: string
          restaurant_id: string
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name?: string
          product_id?: string
          restaurant_id?: string
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          extra_price: number
          id: string
          is_active: boolean
          name: string
          option_group_id: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_price?: number
          id?: string
          is_active?: boolean
          name: string
          option_group_id: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_price?: number
          id?: string
          is_active?: boolean
          name?: string
          option_group_id?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_super_admin: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_memberships: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          is_available: boolean
          is_daily_menu: boolean
          is_featured: boolean
          name: string
          prep_time_minutes: number | null
          price: number | null
          restaurant_id: string
          sku: string | null
          slug: string
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_available?: boolean
          is_daily_menu?: boolean
          is_featured?: boolean
          name: string
          prep_time_minutes?: number | null
          price?: number | null
          restaurant_id: string
          sku?: string | null
          slug: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_available?: boolean
          is_daily_menu?: boolean
          is_featured?: boolean
          name?: string
          prep_time_minutes?: number | null
          price?: number | null
          restaurant_id?: string
          sku?: string | null
          slug?: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_products_category_tenant_fk"
            columns: ["category_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_categories"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "restaurant_products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          created_at: string
          default_prep_time_minutes: number | null
          delivery_enabled: boolean
          delivery_fee: number
          description: string | null
          dine_in_enabled: boolean
          driver_location_freshness_minutes: number
          driver_proposal_timeout_seconds: number
          minimum_order: number
          opening_hours: Json
          pickup_enabled: boolean
          primary_color: string | null
          reservation_enabled: boolean
          restaurant_id: string
          social_links: Json
          updated_at: string
          whatsapp_message_template: string | null
        }
        Insert: {
          created_at?: string
          default_prep_time_minutes?: number | null
          delivery_enabled?: boolean
          delivery_fee?: number
          description?: string | null
          dine_in_enabled?: boolean
          driver_location_freshness_minutes?: number
          driver_proposal_timeout_seconds?: number
          minimum_order?: number
          opening_hours?: Json
          pickup_enabled?: boolean
          primary_color?: string | null
          reservation_enabled?: boolean
          restaurant_id: string
          social_links?: Json
          updated_at?: string
          whatsapp_message_template?: string | null
        }
        Update: {
          created_at?: string
          default_prep_time_minutes?: number | null
          delivery_enabled?: boolean
          delivery_fee?: number
          description?: string | null
          dine_in_enabled?: boolean
          driver_location_freshness_minutes?: number
          driver_proposal_timeout_seconds?: number
          minimum_order?: number
          opening_hours?: Json
          pickup_enabled?: boolean
          primary_color?: string | null
          reservation_enabled?: boolean
          restaurant_id?: string
          social_links?: Json
          updated_at?: string
          whatsapp_message_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          commune: string | null
          country_code: string
          cover_url: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_public: boolean
          lat: number | null
          legal_name: string | null
          lng: number | null
          logo_url: string | null
          name: string
          next_order_number: number
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          commune?: string | null
          country_code?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_public?: boolean
          lat?: number | null
          legal_name?: string | null
          lng?: number | null
          logo_url?: string | null
          name: string
          next_order_number?: number
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          commune?: string | null
          country_code?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_public?: boolean
          lat?: number | null
          legal_name?: string | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          next_order_number?: number
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_body?: string
          p_metadata?: Json
          p_order_id: string
          p_restaurant_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_notes?: string
          p_customer_phone: string
          p_delivery_address?: string
          p_delivery_commune?: string
          p_delivery_instructions?: string
          p_fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          p_items: Json
          p_order_source?: string
          p_payment_method?: string
          p_slug: string
          p_source_metadata?: Json
        }
        Returns: Json
      }
      create_refund: {
        Args: { p_amount: number; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      dispatch_expire_stale_proposals: { Args: never; Returns: undefined }
      dispatch_find_and_propose_driver: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      driver_advance_delivery_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["driver_delivery_status"]
          p_order_id: string
        }
        Returns: Json
      }
      driver_confirm_cash_payment: {
        Args: { p_amount_received?: number; p_order_id: string }
        Returns: Json
      }
      driver_report_delivery_issue: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      driver_respond_to_proposal: {
        Args: { p_accept: boolean; p_proposal_id: string }
        Returns: Json
      }
      get_customer_order: {
        Args: { p_customer_phone: string; p_order_id: string }
        Returns: Json
      }
      get_customer_orders: {
        Args: { p_customer_phone: string; p_restaurant_slug: string }
        Returns: Json
      }
      get_driver_active_delivery: { Args: never; Returns: Json }
      get_driver_pending_proposal: { Args: never; Returns: Json }
      get_public_cheap_products: {
        Args: { p_limit?: number; p_max_price?: number }
        Returns: Json
      }
      get_public_menu: { Args: { p_slug: string }; Returns: Json }
      get_public_restaurants: { Args: { p_query?: string }; Returns: Json }
      get_restaurant_dashboard_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      has_restaurant_access: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      has_restaurant_role: {
        Args: {
          _restaurant_id: string
          _roles: Database["public"]["Enums"]["restaurant_role"][]
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      is_super_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_restaurant_id: string
        }
        Returns: undefined
      }
      mark_cash_payment_received: {
        Args: { p_order_id: string }
        Returns: Json
      }
      super_admin_add_restaurant_member: {
        Args: {
          _email: string
          _restaurant_id: string
          _role: Database["public"]["Enums"]["restaurant_role"]
        }
        Returns: {
          out_restaurant_id: string
          out_role: Database["public"]["Enums"]["restaurant_role"]
          out_user_id: string
        }[]
      }
      super_admin_list_restaurant_members: {
        Args: { _restaurant_id: string }
        Returns: {
          email: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status: string
          user_id: string
        }[]
      }
      update_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_note?: string
          p_order_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      delivery_dispatch_status:
        | "not_started"
        | "searching"
        | "assigned"
        | "no_driver_available"
      delivery_proposal_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      driver_delivery_status:
        | "assigned"
        | "going_to_pickup"
        | "arrived_at_restaurant"
        | "collecting"
        | "collected"
        | "en_route"
        | "arrived_at_customer"
        | "cash_collection"
        | "payment_confirmed"
        | "delivered"
      driver_status:
        | "offline"
        | "available"
        | "proposed"
        | "busy"
        | "delivering"
      membership_status: "invited" | "active" | "suspended"
      order_fulfillment_type: "delivery" | "pickup"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "cash" | "mobile_money" | "card" | "online" | "unknown"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "cash_pending"
      restaurant_role: "owner" | "manager" | "staff"
      restaurant_status: "trial" | "active" | "suspended" | "archived"
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
      delivery_dispatch_status: [
        "not_started",
        "searching",
        "assigned",
        "no_driver_available",
      ],
      delivery_proposal_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      driver_delivery_status: [
        "assigned",
        "going_to_pickup",
        "arrived_at_restaurant",
        "collecting",
        "collected",
        "en_route",
        "arrived_at_customer",
        "cash_collection",
        "payment_confirmed",
        "delivered",
      ],
      driver_status: ["offline", "available", "proposed", "busy", "delivering"],
      membership_status: ["invited", "active", "suspended"],
      order_fulfillment_type: ["delivery", "pickup"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cash", "mobile_money", "card", "online", "unknown"],
      payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "cash_pending",
      ],
      restaurant_role: ["owner", "manager", "staff"],
      restaurant_status: ["trial", "active", "suspended", "archived"],
    },
  },
} as const
