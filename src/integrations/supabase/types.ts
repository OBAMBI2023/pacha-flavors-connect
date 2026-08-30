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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
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
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string | null
          restaurant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          restaurant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link_id: string | null
          link_type: string | null
          restaurant_id: string
          title: string
          type: string
          visitor_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_type?: string | null
          restaurant_id: string
          title: string
          type: string
          visitor_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_type?: string | null
          restaurant_id?: string
          title?: string
          type?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_order_at: string | null
          full_name: string
          id: string
          internal_note: string | null
          last_order_at: string | null
          marketing_opt_out: boolean
          orders_count: number
          phone: string
          restaurant_id: string
          source: string
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_order_at?: string | null
          full_name: string
          id?: string
          internal_note?: string | null
          last_order_at?: string | null
          marketing_opt_out?: boolean
          orders_count?: number
          phone: string
          restaurant_id: string
          source?: string
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_order_at?: string | null
          full_name?: string
          id?: string
          internal_note?: string | null
          last_order_at?: string | null
          marketing_opt_out?: boolean
          orders_count?: number
          phone?: string
          restaurant_id?: string
          source?: string
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          assigned_delivery_agent_id: string | null
          assigned_pickup_agent_id: string | null
          cod_amount: number | null
          created_at: string
          customer_name: string
          customer_phone: string
          declared_value: number | null
          delivery_distance_km: number | null
          delivery_fee: number | null
          delivery_fee_calculation_method: string | null
          delivery_instructions: string | null
          delivery_provider: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_latitude: number | null
          destination_longitude: number | null
          destination_name: string
          destination_phone: string
          external_reference: string | null
          id: string
          metadata: Json
          order_id: string
          organization_id: string
          package_description: string | null
          package_quantity: number
          package_weight: number | null
          pickup_address: string
          pickup_latitude: number | null
          pickup_longitude: number | null
          pickup_name: string
          pickup_phone: string
          pickup_point_id: string | null
          scheduled_pickup_at: string | null
          service_level: Database["public"]["Enums"]["delivery_service_level"]
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          assigned_delivery_agent_id?: string | null
          assigned_pickup_agent_id?: string | null
          cod_amount?: number | null
          created_at?: string
          customer_name: string
          customer_phone: string
          declared_value?: number | null
          delivery_distance_km?: number | null
          delivery_fee?: number | null
          delivery_fee_calculation_method?: string | null
          delivery_instructions?: string | null
          delivery_provider?: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          destination_name: string
          destination_phone: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          order_id: string
          organization_id: string
          package_description?: string | null
          package_quantity?: number
          package_weight?: number | null
          pickup_address: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          pickup_name: string
          pickup_phone: string
          pickup_point_id?: string | null
          scheduled_pickup_at?: string | null
          service_level?: Database["public"]["Enums"]["delivery_service_level"]
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          assigned_delivery_agent_id?: string | null
          assigned_pickup_agent_id?: string | null
          cod_amount?: number | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          declared_value?: number | null
          delivery_distance_km?: number | null
          delivery_fee?: number | null
          delivery_fee_calculation_method?: string | null
          delivery_instructions?: string | null
          delivery_provider?: Database["public"]["Enums"]["delivery_provider"]
          destination_address?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          destination_name?: string
          destination_phone?: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          organization_id?: string
          package_description?: string | null
          package_quantity?: number
          package_weight?: number | null
          pickup_address?: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          pickup_name?: string
          pickup_phone?: string
          pickup_point_id?: string | null
          scheduled_pickup_at?: string | null
          service_level?: Database["public"]["Enums"]["delivery_service_level"]
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_delivery_agent_id_fkey"
            columns: ["assigned_delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_assigned_pickup_agent_id_fkey"
            columns: ["assigned_pickup_agent_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          agent_id: string
          created_at: string
          delivery_id: string
          id: string
          performed_by: string | null
          role: Database["public"]["Enums"]["delivery_assignment_role"]
          status: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          delivery_id: string
          id?: string
          performed_by?: string | null
          role: Database["public"]["Enums"]["delivery_assignment_role"]
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          delivery_id?: string
          id?: string
          performed_by?: string | null
          role?: Database["public"]["Enums"]["delivery_assignment_role"]
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_incidents: {
        Row: {
          created_at: string
          delivery_id: string
          description: string | null
          id: string
          incident_type: string
          reported_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          description?: string | null
          id?: string
          incident_type: string
          reported_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          description?: string | null
          id?: string
          incident_type?: string
          reported_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_incidents_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proofs: {
        Row: {
          captured_by: string | null
          created_at: string
          delivery_id: string
          file_path: string | null
          id: string
          notes: string | null
          proof_type: string
          signature_data: string | null
        }
        Insert: {
          captured_by?: string | null
          created_at?: string
          delivery_id: string
          file_path?: string | null
          id?: string
          notes?: string | null
          proof_type: string
          signature_data?: string | null
        }
        Update: {
          captured_by?: string | null
          created_at?: string
          delivery_id?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          proof_type?: string
          signature_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
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
      delivery_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          delivery_id: string
          from_status: Database["public"]["Enums"]["delivery_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          delivery_id: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          delivery_id?: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_fee: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          per_km_fee: number
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          per_km_fee?: number
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          per_km_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_assignment_history: {
        Row: {
          assignment_type: Database["public"]["Enums"]["driver_assignment_type"]
          created_at: string
          id: string
          new_driver_id: string | null
          order_id: string
          performed_by: string | null
          previous_driver_id: string | null
          restaurant_id: string
        }
        Insert: {
          assignment_type: Database["public"]["Enums"]["driver_assignment_type"]
          created_at?: string
          id?: string
          new_driver_id?: string | null
          order_id: string
          performed_by?: string | null
          previous_driver_id?: string | null
          restaurant_id: string
        }
        Update: {
          assignment_type?: Database["public"]["Enums"]["driver_assignment_type"]
          created_at?: string
          id?: string
          new_driver_id?: string | null
          order_id?: string
          performed_by?: string | null
          previous_driver_id?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignment_history_new_driver_id_fkey"
            columns: ["new_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignment_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignment_history_previous_driver_id_fkey"
            columns: ["previous_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignment_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          back_path: string | null
          category: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          driver_id: string
          expires_at: string | null
          front_path: string | null
          id: string
          issued_at: string | null
          kind: Database["public"]["Enums"]["driver_document_kind"]
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          back_path?: string | null
          category?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          driver_id: string
          expires_at?: string | null
          front_path?: string | null
          id?: string
          issued_at?: string | null
          kind: Database["public"]["Enums"]["driver_document_kind"]
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          back_path?: string | null
          category?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          driver_id?: string
          expires_at?: string | null
          front_path?: string | null
          id?: string
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["driver_document_kind"]
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          account_status: string
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          hired_at: string | null
          id: string
          internal_note: string | null
          invited_at: string | null
          is_active: boolean
          is_saovia_agent: boolean
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          phone: string
          phone_secondary: string | null
          photo_path: string | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          account_status?: string
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          hired_at?: string | null
          id: string
          internal_note?: string | null
          invited_at?: string | null
          is_active?: boolean
          is_saovia_agent?: boolean
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          phone: string
          phone_secondary?: string | null
          photo_path?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          account_status?: string
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          hired_at?: string | null
          id?: string
          internal_note?: string | null
          invited_at?: string | null
          is_active?: boolean
          is_saovia_agent?: boolean
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          phone?: string
          phone_secondary?: string | null
          photo_path?: string | null
          restaurant_id?: string | null
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
      inventory: {
        Row: {
          alert_threshold: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          restaurant_id: string
          tracking_enabled: boolean
          updated_at: string
        }
        Insert: {
          alert_threshold?: number
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          restaurant_id: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          alert_threshold?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          restaurant_id?: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          movement_type: string
          note: string | null
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          movement_type: string
          note?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          id: string
          message_rendered: string
          name_snapshot: string
          phone_snapshot: string
          restaurant_id: string
          sent_at: string | null
          status: string
          wa_link: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          id?: string
          message_rendered: string
          name_snapshot: string
          phone_snapshot: string
          restaurant_id: string
          sent_at?: string | null
          status?: string
          wa_link: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          message_rendered?: string
          name_snapshot?: string
          phone_snapshot?: string
          restaurant_id?: string
          sent_at?: string | null
          status?: string
          wa_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_recipients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience_filters: Json
          audience_segment: string | null
          created_at: string
          created_by: string | null
          id: string
          message_template: string
          name: string
          objective: string
          promo_code_id: string | null
          recipient_count: number
          restaurant_id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience_filters?: Json
          audience_segment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_template: string
          name: string
          objective: string
          promo_code_id?: string | null
          recipient_count?: number
          restaurant_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience_filters?: Json
          audience_segment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_template?: string
          name?: string
          objective?: string
          promo_code_id?: string | null
          recipient_count?: number
          restaurant_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_restaurant_id_fkey"
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
      offer_recipients: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          offer_id: string
          read_at: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          offer_id: string
          read_at?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          offer_id?: string
          read_at?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_recipients_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          clicks_count: number
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_path: string | null
          offer_price: number
          original_price: number
          product_id: string
          restaurant_id: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          clicks_count?: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          offer_price: number
          original_price: number
          product_id: string
          restaurant_id: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          clicks_count?: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          offer_price?: number
          original_price?: number
          product_id?: string
          restaurant_id?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_restaurant_id_fkey"
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
          allergy_information: string | null
          assigned_driver_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          customer_profile_address: string | null
          cutlery_requested: boolean
          delivered_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_commune: string | null
          delivery_dispatch_status: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_distance_km: number | null
          delivery_fee_amount: number
          delivery_fee_calculation_method: string | null
          delivery_instructions: string | null
          delivery_landmark: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_neighborhood: string | null
          discount_amount: number
          driver_delivery_status:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          driver_note: string | null
          estimated_preparation_minutes: number | null
          fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          id: string
          is_for_someone_else: boolean
          item_count: number
          offer_id: string | null
          offer_title_snapshot: string | null
          order_number: number
          order_source: string
          out_for_delivery_at: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_code: string | null
          pickup_code_attempts: number
          pickup_code_verified_at: string | null
          pickup_code_verified_by: string | null
          preparing_at: string | null
          promo_code_id: string | null
          promo_code_snapshot: string | null
          ready_at: string | null
          recipient_additional_info: string | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_landmark: string | null
          recipient_name: string | null
          recipient_neighborhood: string | null
          recipient_phone: string | null
          restaurant_id: string
          restaurant_lat_snapshot: number | null
          restaurant_lng_snapshot: number | null
          scheduled_for: string | null
          source_metadata: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number
          total_amount: number
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          allergy_information?: string | null
          assigned_driver_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          customer_profile_address?: string | null
          cutlery_requested?: boolean
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_commune?: string | null
          delivery_dispatch_status?: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_distance_km?: number | null
          delivery_fee_amount?: number
          delivery_fee_calculation_method?: string | null
          delivery_instructions?: string | null
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_neighborhood?: string | null
          discount_amount?: number
          driver_delivery_status?:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          driver_note?: string | null
          estimated_preparation_minutes?: number | null
          fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          id?: string
          is_for_someone_else?: boolean
          item_count?: number
          offer_id?: string | null
          offer_title_snapshot?: string | null
          order_number: number
          order_source?: string
          out_for_delivery_at?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_code?: string | null
          pickup_code_attempts?: number
          pickup_code_verified_at?: string | null
          pickup_code_verified_by?: string | null
          preparing_at?: string | null
          promo_code_id?: string | null
          promo_code_snapshot?: string | null
          ready_at?: string | null
          recipient_additional_info?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_landmark?: string | null
          recipient_name?: string | null
          recipient_neighborhood?: string | null
          recipient_phone?: string | null
          restaurant_id: string
          restaurant_lat_snapshot?: number | null
          restaurant_lng_snapshot?: number | null
          scheduled_for?: string | null
          source_metadata?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number
          total_amount: number
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          allergy_information?: string | null
          assigned_driver_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          customer_profile_address?: string | null
          cutlery_requested?: boolean
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_commune?: string | null
          delivery_dispatch_status?: Database["public"]["Enums"]["delivery_dispatch_status"]
          delivery_distance_km?: number | null
          delivery_fee_amount?: number
          delivery_fee_calculation_method?: string | null
          delivery_instructions?: string | null
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_neighborhood?: string | null
          discount_amount?: number
          driver_delivery_status?:
            | Database["public"]["Enums"]["driver_delivery_status"]
            | null
          driver_note?: string | null
          estimated_preparation_minutes?: number | null
          fulfillment_type?: Database["public"]["Enums"]["order_fulfillment_type"]
          id?: string
          is_for_someone_else?: boolean
          item_count?: number
          offer_id?: string | null
          offer_title_snapshot?: string | null
          order_number?: number
          order_source?: string
          out_for_delivery_at?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_code?: string | null
          pickup_code_attempts?: number
          pickup_code_verified_at?: string | null
          pickup_code_verified_by?: string | null
          preparing_at?: string | null
          promo_code_id?: string | null
          promo_code_snapshot?: string | null
          ready_at?: string | null
          recipient_additional_info?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_landmark?: string | null
          recipient_name?: string | null
          recipient_neighborhood?: string | null
          recipient_phone?: string | null
          restaurant_id?: string
          restaurant_lat_snapshot?: number | null
          restaurant_lng_snapshot?: number | null
          scheduled_for?: string | null
          source_metadata?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
          visitor_id?: string | null
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
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_code_verified_by_fkey"
            columns: ["pickup_code_verified_by"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
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
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          collected_by_driver_id: string | null
          collector_type: string | null
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
          collected_by_driver_id?: string | null
          collector_type?: string | null
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
          collected_by_driver_id?: string | null
          collector_type?: string | null
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
            foreignKeyName: "payments_collected_by_driver_id_fkey"
            columns: ["collected_by_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
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
      pickup_points: {
        Row: {
          address: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      product_promotions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          product_id: string
          restaurant_id: string
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
          title: string
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          product_id: string
          restaurant_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title: string
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          product_id?: string
          restaurant_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title?: string
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "restaurant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_promotions_restaurant_id_fkey"
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
      promo_code_targets: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          promo_code_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          promo_code_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_targets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_targets_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_usages: {
        Row: {
          customer_id: string | null
          discount_amount: number
          id: string
          order_id: string
          promo_code_id: string
          restaurant_id: string
          used_at: string
        }
        Insert: {
          customer_id?: string | null
          discount_amount: number
          id?: string
          order_id: string
          promo_code_id: string
          restaurant_id: string
          used_at?: string
        }
        Update: {
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string
          promo_code_id?: string
          restaurant_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["promotion_type"]
          discount_value: number | null
          ends_at: string
          id: string
          is_active: boolean
          max_total_uses: number | null
          max_uses_per_customer: number
          name: string
          restaurant_id: string
          starts_at: string
          updated_at: string
          visibility: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["promotion_type"]
          discount_value?: number | null
          ends_at: string
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number
          name: string
          restaurant_id: string
          starts_at: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["promotion_type"]
          discount_value?: number | null
          ends_at?: string
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number
          name?: string
          restaurant_id?: string
          starts_at?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          driver_id: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          driver_id: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          driver_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          accent_color: string | null
          background_color: string | null
          bing_site_verification: string | null
          border_radius: string | null
          cash_collection_mode: string
          commission_rate: number
          created_at: string
          custom_domain: string | null
          default_prep_time_minutes: number | null
          delivery_enabled: boolean
          delivery_fee: number
          delivery_fee_fallback: number
          description: string | null
          dine_in_enabled: boolean
          driver_location_freshness_minutes: number
          driver_proposal_timeout_seconds: number
          font_family: string | null
          google_site_verification: string | null
          manual_override: boolean
          manual_status: string | null
          meta_pixel_enabled: boolean
          meta_pixel_id: string | null
          minimum_order: number
          opening_hours: Json
          pickup_enabled: boolean
          primary_color: string | null
          reservation_enabled: boolean
          restaurant_id: string
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_og_image_url: string | null
          seo_title: string | null
          social_links: Json
          surface_color: string | null
          tagline: string | null
          text_color: string | null
          updated_at: string
          whatsapp_message_template: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          bing_site_verification?: string | null
          border_radius?: string | null
          cash_collection_mode?: string
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          default_prep_time_minutes?: number | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_fee_fallback?: number
          description?: string | null
          dine_in_enabled?: boolean
          driver_location_freshness_minutes?: number
          driver_proposal_timeout_seconds?: number
          font_family?: string | null
          google_site_verification?: string | null
          manual_override?: boolean
          manual_status?: string | null
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          minimum_order?: number
          opening_hours?: Json
          pickup_enabled?: boolean
          primary_color?: string | null
          reservation_enabled?: boolean
          restaurant_id: string
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_og_image_url?: string | null
          seo_title?: string | null
          social_links?: Json
          surface_color?: string | null
          tagline?: string | null
          text_color?: string | null
          updated_at?: string
          whatsapp_message_template?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          bing_site_verification?: string | null
          border_radius?: string | null
          cash_collection_mode?: string
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          default_prep_time_minutes?: number | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_fee_fallback?: number
          description?: string | null
          dine_in_enabled?: boolean
          driver_location_freshness_minutes?: number
          driver_proposal_timeout_seconds?: number
          font_family?: string | null
          google_site_verification?: string | null
          manual_override?: boolean
          manual_status?: string | null
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          minimum_order?: number
          opening_hours?: Json
          pickup_enabled?: boolean
          primary_color?: string | null
          reservation_enabled?: boolean
          restaurant_id?: string
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_og_image_url?: string | null
          seo_title?: string | null
          social_links?: Json
          surface_color?: string | null
          tagline?: string | null
          text_color?: string | null
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
          favicon_url: string | null
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
          favicon_url?: string | null
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
          favicon_url?: string | null
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
      review_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          restaurant_id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          restaurant_id: string
          review_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          restaurant_id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reporter_type: string
          reporter_user_id: string | null
          reporter_visitor_id: string | null
          resolved_at: string | null
          restaurant_id: string
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reporter_type: string
          reporter_user_id?: string | null
          reporter_visitor_id?: string | null
          resolved_at?: string | null
          restaurant_id: string
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reporter_type?: string
          reporter_user_id?: string | null
          reporter_visitor_id?: string | null
          resolved_at?: string | null
          restaurant_id?: string
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          order_id: string
          photos: Json
          rating: number
          restaurant_id: string
          status: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          order_id: string
          photos?: Json
          rating: number
          restaurant_id: string
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          order_id?: string
          photos?: Json
          rating?: number
          restaurant_id?: string
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_business_exceptions: {
        Row: {
          closing_time: string | null
          created_at: string
          date: string
          end_date: string | null
          id: string
          is_open: boolean
          opening_time: string | null
          reason: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closing_time?: string | null
          created_at?: string
          date: string
          end_date?: string | null
          id?: string
          is_open: boolean
          opening_time?: string | null
          reason?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closing_time?: string | null
          created_at?: string
          date?: string
          end_date?: string | null
          id?: string
          is_open?: boolean
          opening_time?: string | null
          reason?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_business_exceptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_business_hours: {
        Row: {
          closing_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          opening_time: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closing_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          opening_time?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closing_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          opening_time?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          chassis_number: string | null
          color: string | null
          created_at: string
          driver_id: string
          id: string
          inspection_expires_at: string | null
          insurance_expires_at: string | null
          is_active: boolean
          make: string | null
          model: string | null
          photo_path: string | null
          plate_number: string
          restaurant_id: string
          updated_at: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          driver_id: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          is_active?: boolean
          make?: string | null
          model?: string | null
          photo_path?: string | null
          plate_number: string
          restaurant_id: string
          updated_at?: string
          vehicle_type: string
          year?: number | null
        }
        Update: {
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          is_active?: boolean
          make?: string | null
          model?: string | null
          photo_path?: string | null
          plate_number?: string
          restaurant_id?: string
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_sessions: {
        Row: {
          id: string
          last_seen_at: string
          restaurant_id: string
          source: string | null
          started_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          last_seen_at?: string
          restaurant_id: string
          source?: string | null
          started_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          last_seen_at?: string
          restaurant_id?: string
          source?: string | null
          started_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          organization_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          organization_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          organization_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          delivery_id: string | null
          delivery_status: string
          event_type: string
          event_uuid: string
          id: string
          last_attempted_at: string | null
          last_response_status_code: number | null
          next_retry_at: string | null
          organization_id: string
          payload: Json
          webhook_endpoint_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivery_id?: string | null
          delivery_status?: string
          event_type: string
          event_uuid?: string
          id?: string
          last_attempted_at?: string | null
          last_response_status_code?: number | null
          next_retry_at?: string | null
          organization_id: string
          payload: Json
          webhook_endpoint_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          delivery_id?: string | null
          delivery_status?: string
          event_type?: string
          event_uuid?: string
          id?: string
          last_attempted_at?: string | null
          last_response_status_code?: number | null
          next_retry_at?: string | null
          organization_id?: string
          payload?: Json
          webhook_endpoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_webhook_endpoint_id_fkey"
            columns: ["webhook_endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_saovia_delivery_status: {
        Args: {
          p_delivery_id: string
          p_role: Database["public"]["Enums"]["delivery_assignment_role"]
          p_to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Returns: Json
      }
      assign_agent_to_delivery: {
        Args: {
          p_agent_id: string
          p_delivery_id: string
          p_role: Database["public"]["Enums"]["delivery_assignment_role"]
        }
        Returns: Json
      }
      assign_driver_to_order: {
        Args: { p_driver_id: string; p_order_id: string }
        Returns: Json
      }
      compute_delivery_pricing: {
        Args: {
          p_destination_lat: number
          p_destination_lng: number
          p_pickup_lat: number
          p_pickup_lng: number
        }
        Returns: {
          distance_km: number
          fee: number
          method: string
        }[]
      }
      consume_inventory_for_order: {
        Args: { p_order_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      create_delivery: {
        Args: {
          p_cod_amount?: number
          p_customer_name: string
          p_customer_phone: string
          p_declared_value?: number
          p_delivery_instructions?: string
          p_delivery_provider?: Database["public"]["Enums"]["delivery_provider"]
          p_destination_address: string
          p_destination_latitude?: number
          p_destination_longitude?: number
          p_destination_name: string
          p_destination_phone: string
          p_external_reference?: string
          p_metadata?: Json
          p_order_id: string
          p_organization_id: string
          p_package_description?: string
          p_package_quantity?: number
          p_package_weight?: number
          p_pickup_address: string
          p_pickup_latitude?: number
          p_pickup_longitude?: number
          p_pickup_name: string
          p_pickup_phone: string
          p_pickup_point_id?: string
          p_scheduled_pickup_at?: string
          p_service_level?: Database["public"]["Enums"]["delivery_service_level"]
        }
        Returns: Json
      }
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
          p_allergy_information?: string
          p_customer_name: string
          p_customer_notes?: string
          p_customer_phone: string
          p_customer_profile_address?: string
          p_cutlery_requested?: boolean
          p_delivery_address?: string
          p_delivery_city?: string
          p_delivery_commune?: string
          p_delivery_instructions?: string
          p_delivery_landmark?: string
          p_delivery_latitude?: number
          p_delivery_longitude?: number
          p_delivery_neighborhood?: string
          p_driver_note?: string
          p_fulfillment_type: Database["public"]["Enums"]["order_fulfillment_type"]
          p_is_for_someone_else?: boolean
          p_items: Json
          p_offer_id?: string
          p_order_source?: string
          p_payment_method?: string
          p_promo_code?: string
          p_recipient_additional_info?: string
          p_recipient_address?: string
          p_recipient_city?: string
          p_recipient_landmark?: string
          p_recipient_name?: string
          p_recipient_neighborhood?: string
          p_recipient_phone?: string
          p_scheduled_for?: string
          p_slug: string
          p_source_metadata?: Json
          p_visitor_id?: string
        }
        Returns: Json
      }
      create_pickup_point: {
        Args: {
          p_address: string
          p_contact_name?: string
          p_contact_phone?: string
          p_latitude?: number
          p_longitude?: number
          p_name: string
          p_organization_id: string
        }
        Returns: {
          address: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pickup_points"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_refund: {
        Args: { p_amount: number; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      delete_pickup_point: {
        Args: { p_pickup_point_id: string }
        Returns: undefined
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
      driver_refuse_delivery_assignment: {
        Args: {
          p_delivery_id: string
          p_reason?: string
          p_role: Database["public"]["Enums"]["delivery_assignment_role"]
        }
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
      find_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_active_promotion: {
        Args: { p_product_id: string }
        Returns: {
          created_at: string
          ends_at: string
          id: string
          product_id: string
          restaurant_id: string
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
          title: string
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
          value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "product_promotions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_agent_assigned_deliveries: {
        Args: never
        Returns: {
          created_at: string
          delivery_fee: number
          delivery_fee_calculation_method: string
          delivery_provider: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_name: string
          id: string
          order_id: string
          origin: string
          pickup_address: string
          pickup_name: string
          role: Database["public"]["Enums"]["delivery_assignment_role"]
          scheduled_pickup_at: string
          service_level: Database["public"]["Enums"]["delivery_service_level"]
          status: Database["public"]["Enums"]["delivery_status"]
        }[]
      }
      get_client_notifications: {
        Args: { p_slug: string; p_visitor_id: string }
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
      get_driver_fleet_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_driver_pending_proposal: { Args: never; Returns: Json }
      get_next_opening: {
        Args: { p_after: string; p_restaurant_id: string }
        Returns: string
      }
      get_offers_analytics: { Args: never; Returns: Json }
      get_order_financial_breakdown: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_order_review: {
        Args: { p_customer_phone: string; p_order_id: string }
        Returns: Json
      }
      get_organization_delivery: {
        Args: { p_delivery_id: string }
        Returns: {
          assigned_delivery_agent_id: string | null
          assigned_pickup_agent_id: string | null
          cod_amount: number | null
          created_at: string
          customer_name: string
          customer_phone: string
          declared_value: number | null
          delivery_distance_km: number | null
          delivery_fee: number | null
          delivery_fee_calculation_method: string | null
          delivery_instructions: string | null
          delivery_provider: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_latitude: number | null
          destination_longitude: number | null
          destination_name: string
          destination_phone: string
          external_reference: string | null
          id: string
          metadata: Json
          order_id: string
          organization_id: string
          package_description: string | null
          package_quantity: number
          package_weight: number | null
          pickup_address: string
          pickup_latitude: number | null
          pickup_longitude: number | null
          pickup_name: string
          pickup_phone: string
          pickup_point_id: string | null
          scheduled_pickup_at: string | null
          service_level: Database["public"]["Enums"]["delivery_service_level"]
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_cheap_products: {
        Args: { p_limit?: number; p_max_price?: number }
        Returns: Json
      }
      get_public_menu: { Args: { p_slug: string }; Returns: Json }
      get_public_restaurants: { Args: { p_query?: string }; Returns: Json }
      get_public_sitemap_index: { Args: never; Returns: Json }
      get_restaurant_availability: {
        Args: { p_now?: string; p_restaurant_id: string }
        Returns: Json
      }
      get_restaurant_dashboard_stats: {
        Args: {
          p_end_date: string
          p_restaurant_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      get_reviews_stats: { Args: never; Returns: Json }
      get_super_admin_customer_map: {
        Args: {
          p_period_days?: number
          p_restaurant_id?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_tenant_offers: {
        Args: { p_slug: string; p_visitor_id?: string }
        Returns: Json
      }
      get_tenant_qr_stats: { Args: { p_restaurant_id?: string }; Returns: Json }
      get_tenant_reviews: {
        Args: { p_limit?: number; p_slug: string }
        Returns: Json
      }
      get_unread_client_notifications_count: {
        Args: { p_slug: string; p_visitor_id: string }
        Returns: number
      }
      get_unread_offers_count: {
        Args: { p_slug: string; p_visitor_id: string }
        Returns: number
      }
      get_visitor_realtime_count: { Args: never; Returns: number }
      get_visitor_stats: { Args: never; Returns: Json }
      has_organization_access: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      has_organization_role: {
        Args: {
          _organization_id: string
          _roles: Database["public"]["Enums"]["restaurant_role"][]
        }
        Returns: boolean
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
      list_deliveries_for_dispatch: {
        Args: {
          p_origin?: string
          p_service_level?: Database["public"]["Enums"]["delivery_service_level"]
          p_status?: Database["public"]["Enums"]["delivery_status"]
        }
        Returns: {
          assigned_delivery_agent_id: string
          assigned_delivery_agent_name: string
          assigned_pickup_agent_id: string
          assigned_pickup_agent_name: string
          created_at: string
          delivery_distance_km: number
          delivery_fee: number
          delivery_fee_calculation_method: string
          delivery_provider: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_name: string
          external_reference: string
          id: string
          order_id: string
          organization_id: string
          organization_name: string
          origin: string
          pickup_address: string
          pickup_name: string
          scheduled_pickup_at: string
          service_level: Database["public"]["Enums"]["delivery_service_level"]
          status: Database["public"]["Enums"]["delivery_status"]
        }[]
      }
      list_organization_deliveries: {
        Args: { p_organization_id: string }
        Returns: {
          assigned_delivery_agent_id: string | null
          assigned_pickup_agent_id: string | null
          cod_amount: number | null
          created_at: string
          customer_name: string
          customer_phone: string
          declared_value: number | null
          delivery_distance_km: number | null
          delivery_fee: number | null
          delivery_fee_calculation_method: string | null
          delivery_instructions: string | null
          delivery_provider: Database["public"]["Enums"]["delivery_provider"]
          destination_address: string
          destination_latitude: number | null
          destination_longitude: number | null
          destination_name: string
          destination_phone: string
          external_reference: string | null
          id: string
          metadata: Json
          order_id: string
          organization_id: string
          package_description: string | null
          package_quantity: number
          package_weight: number | null
          pickup_address: string
          pickup_latitude: number | null
          pickup_longitude: number | null
          pickup_name: string
          pickup_phone: string
          pickup_point_id: string | null
          scheduled_pickup_at: string | null
          service_level: Database["public"]["Enums"]["delivery_service_level"]
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_organization_pickup_points: {
        Args: { p_organization_id: string }
        Returns: {
          address: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pickup_points"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_saovia_agents_for_dispatch: {
        Args: never
        Returns: {
          active_missions_count: number
          full_name: string
          id: string
          is_active: boolean
          phone: string
          status: Database["public"]["Enums"]["driver_status"]
        }[]
      }
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
      log_organization_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_organization_id: string
        }
        Returns: undefined
      }
      lookup_customer_name: {
        Args: { p_phone: string; p_slug: string }
        Returns: string
      }
      mark_cash_payment_received: {
        Args: { p_order_id: string }
        Returns: Json
      }
      mark_client_notification_read: {
        Args: { p_notification_id: string; p_visitor_id: string }
        Returns: undefined
      }
      mark_offer_read: {
        Args: { p_offer_id: string; p_visitor_id: string }
        Returns: undefined
      }
      merge_customers: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      quote_delivery: {
        Args: {
          p_destination_lat: number
          p_destination_lng: number
          p_pickup_lat: number
          p_pickup_lng: number
          p_service_level?: Database["public"]["Enums"]["delivery_service_level"]
        }
        Returns: Json
      }
      record_inventory_movement: {
        Args: {
          p_movement_type: string
          p_note?: string
          p_product_id: string
          p_reason: string
          p_restaurant_id: string
          p_value: number
        }
        Returns: {
          alert_threshold: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          restaurant_id: string
          tracking_enabled: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_review: {
        Args: {
          p_description?: string
          p_reason: string
          p_review_id: string
          p_visitor_id?: string
        }
        Returns: undefined
      }
      resolve_promo_code: {
        Args: {
          p_base_amount: number
          p_code: string
          p_customer_id: string
          p_restaurant_id: string
        }
        Returns: {
          code: string
          discount_amount: number
          error_message: string
          promo_code_id: string
          waives_delivery: boolean
        }[]
      }
      restore_inventory_for_order: {
        Args: { p_order_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      set_inventory_alert_threshold: {
        Args: {
          p_alert_threshold: number
          p_product_id: string
          p_restaurant_id: string
        }
        Returns: {
          alert_threshold: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          restaurant_id: string
          tracking_enabled: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_inventory_tracking: {
        Args: {
          p_alert_threshold?: number
          p_enabled: boolean
          p_initial_quantity?: number
          p_product_id: string
          p_restaurant_id: string
        }
        Returns: {
          alert_threshold: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          restaurant_id: string
          tracking_enabled: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_restaurant_commission_rate: {
        Args: { p_rate: number; p_restaurant_id: string }
        Returns: Json
      }
      signup_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: Json
      }
      submit_review: {
        Args: {
          p_comment?: string
          p_customer_phone: string
          p_order_id: string
          p_photos?: Json
          p_rating: number
          p_visitor_id?: string
        }
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
      super_admin_create_tenant: {
        Args: {
          _accent_color?: string
          _address: string
          _background_color?: string
          _border_radius?: string
          _city: string
          _commune: string
          _email: string
          _font_family?: string
          _name: string
          _owner_user_id: string
          _phone: string
          _primary_color?: string
          _secondary_color?: string
          _slug: string
          _status?: Database["public"]["Enums"]["restaurant_status"]
          _surface_color?: string
          _text_color?: string
          _whatsapp_phone: string
        }
        Returns: string
      }
      super_admin_get_tenant_owner: {
        Args: { _restaurant_id: string }
        Returns: string
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
      super_admin_list_tenants: {
        Args: never
        Returns: {
          accent_color: string
          created_at: string
          id: string
          name: string
          owner_email: string
          owner_name: string
          owner_user_id: string
          primary_color: string
          secondary_color: string
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
        }[]
      }
      super_admin_set_restaurant_plan: {
        Args: { _plan_id: string; _restaurant_id: string }
        Returns: Json
      }
      track_offer_click: { Args: { p_offer_id: string }; Returns: undefined }
      track_visitor_session: {
        Args: { p_slug: string; p_source?: string; p_visitor_id: string }
        Returns: undefined
      }
      update_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_note?: string
          p_order_id: string
        }
        Returns: Json
      }
      update_pickup_point: {
        Args: {
          p_address: string
          p_contact_name?: string
          p_contact_phone?: string
          p_is_active?: boolean
          p_latitude?: number
          p_longitude?: number
          p_name: string
          p_pickup_point_id: string
        }
        Returns: {
          address: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pickup_points"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_review: {
        Args: {
          p_comment?: string
          p_customer_phone: string
          p_photos?: Json
          p_rating: number
          p_review_id: string
        }
        Returns: undefined
      }
      validate_promo_code: {
        Args: {
          p_code: string
          p_phone: string
          p_slug: string
          p_subtotal: number
        }
        Returns: Json
      }
      verify_pickup_code: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
    }
    Enums: {
      delivery_assignment_role: "pickup" | "delivery"
      delivery_assignment_status:
        | "proposed"
        | "accepted"
        | "rejected"
        | "completed"
        | "cancelled"
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
      delivery_provider: "TENANT" | "SAOVIA"
      delivery_service_level: "EXPRESS" | "SCHEDULED"
      delivery_status:
        | "pending"
        | "pending_pickup"
        | "assigned_pickup"
        | "picked_up"
        | "ready_for_delivery"
        | "assigned_delivery"
        | "in_transit"
        | "delivered"
        | "delivery_failed"
        | "cancelled"
        | "returned"
      driver_assignment_type: "automatic" | "manual"
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
      driver_document_kind: "identity" | "license"
      driver_status:
        | "offline"
        | "available"
        | "proposed"
        | "busy"
        | "delivering"
        | "suspended"
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
      promotion_status: "draft" | "active" | "inactive" | "expired"
      promotion_type: "fixed_amount" | "percentage" | "free_delivery"
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
      delivery_assignment_role: ["pickup", "delivery"],
      delivery_assignment_status: [
        "proposed",
        "accepted",
        "rejected",
        "completed",
        "cancelled",
      ],
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
      delivery_provider: ["TENANT", "SAOVIA"],
      delivery_service_level: ["EXPRESS", "SCHEDULED"],
      delivery_status: [
        "pending",
        "pending_pickup",
        "assigned_pickup",
        "picked_up",
        "ready_for_delivery",
        "assigned_delivery",
        "in_transit",
        "delivered",
        "delivery_failed",
        "cancelled",
        "returned",
      ],
      driver_assignment_type: ["automatic", "manual"],
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
      driver_document_kind: ["identity", "license"],
      driver_status: [
        "offline",
        "available",
        "proposed",
        "busy",
        "delivering",
        "suspended",
      ],
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
      promotion_status: ["draft", "active", "inactive", "expired"],
      promotion_type: ["fixed_amount", "percentage", "free_delivery"],
      restaurant_role: ["owner", "manager", "staff"],
      restaurant_status: ["trial", "active", "suspended", "archived"],
    },
  },
} as const
