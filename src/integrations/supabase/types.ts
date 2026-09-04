export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          actor_hash: string
          request_count: number
          scope: string
          window_started_at: string
        }
        Insert: {
          actor_hash: string
          request_count: number
          scope: string
          window_started_at: string
        }
        Update: {
          actor_hash?: string
          request_count?: number
          scope?: string
          window_started_at?: string
        }
        Relationships: []
      }
      branch_products: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_available: boolean
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_available?: boolean
          price: number
          product_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_available?: boolean
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          display_order: number | null
          hours: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          restaurant_id: string
          slug: string
          updated_at: string
          voice_agent_active: boolean
          whatsapp_agent_active: boolean
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_order?: number | null
          hours?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          restaurant_id: string
          slug: string
          updated_at?: string
          voice_agent_active?: boolean
          whatsapp_agent_active?: boolean
        }
        Update: {
          address?: string | null
          created_at?: string
          display_order?: number | null
          hours?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          restaurant_id?: string
          slug?: string
          updated_at?: string
          voice_agent_active?: boolean
          whatsapp_agent_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      callback_requests: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          message: string | null
          reason: string | null
          resolved: boolean
          restaurant_id: string
          source: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          message?: string | null
          reason?: string | null
          resolved?: boolean
          restaurant_id: string
          source?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          message?: string | null
          reason?: string | null
          resolved?: boolean
          restaurant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "callback_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callback_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          restaurant_id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          restaurant_id: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          restaurant_id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
        }
        Insert: {
          address: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          last_order_at: string | null
          name: string | null
          order_count: number
          phone: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_order_at?: string | null
          name?: string | null
          order_count?: number
          phone: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_order_at?: string | null
          name?: string | null
          order_count?: number
          phone?: string
          restaurant_id?: string
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
      merida_colonias: {
        Row: {
          lat: number
          lng: number
          nombre: string
        }
        Insert: {
          lat: number
          lng: number
          nombre: string
        }
        Update: {
          lat?: number
          lng?: number
          nombre?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_repartidor_id: string | null
          branch: string | null
          branch_id: string | null
          call_recording_url: string | null
          call_transcript: string | null
          created_at: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          dedupe_fingerprint: string | null
          delivered_at: string | null
          estimated_delivery_at: string | null
          id: string
          idempotency_key: string | null
          incident_note: string | null
          items: Json
          notes: string | null
          order_number: number
          payment_method: string | null
          restaurant_id: string
          scheduled_for: string | null
          source: string
          status: string | null
          total: number
        }
        Insert: {
          assigned_repartidor_id?: string | null
          branch?: string | null
          branch_id?: string | null
          call_recording_url?: string | null
          call_transcript?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          dedupe_fingerprint?: string | null
          delivered_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          idempotency_key?: string | null
          incident_note?: string | null
          items: Json
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          restaurant_id: string
          scheduled_for?: string | null
          source?: string
          status?: string | null
          total: number
        }
        Update: {
          assigned_repartidor_id?: string | null
          branch?: string | null
          branch_id?: string | null
          call_recording_url?: string | null
          call_transcript?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          dedupe_fingerprint?: string | null
          delivered_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          idempotency_key?: string | null
          incident_note?: string | null
          items?: Json
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          restaurant_id?: string
          scheduled_for?: string | null
          source?: string
          status?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          card_expiry: string | null
          card_holder_name: string | null
          card_last_four: string | null
          created_at: string
          id: string
          is_default: boolean | null
          mercado_pago_email: string | null
          paypal_email: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_expiry?: string | null
          card_holder_name?: string | null
          card_last_four?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          mercado_pago_email?: string | null
          paypal_email?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_expiry?: string | null
          card_holder_name?: string | null
          card_last_four?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          mercado_pago_email?: string | null
          paypal_email?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_popular: boolean | null
          name: string
          price: number
          restaurant_id: string
          search_keywords: string[]
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_popular?: boolean | null
          name: string
          price: number
          restaurant_id: string
          search_keywords?: string[]
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_popular?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          search_keywords?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
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
          created_at: string | null
          email: string
          id: string
          nombre: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      promos: {
        Row: {
          created_at: string | null
          description: string | null
          discount_text: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          restaurant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_text?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          restaurant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_text?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          restaurant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      repartidor_perfil: {
        Row: {
          contacto_emergencia_nombre: string
          contacto_emergencia_telefono: string
          correo: string
          created_at: string
          direccion: string
          fecha_alta: string
          fecha_nacimiento: string
          nombre_completo: string
          numero_licencia: string | null
          placas: string | null
          telefono: string
          tipo_vehiculo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contacto_emergencia_nombre: string
          contacto_emergencia_telefono: string
          correo: string
          created_at?: string
          direccion: string
          fecha_alta?: string
          fecha_nacimiento: string
          nombre_completo: string
          numero_licencia?: string | null
          placas?: string | null
          telefono: string
          tipo_vehiculo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contacto_emergencia_nombre?: string
          contacto_emergencia_telefono?: string
          correo?: string
          created_at?: string
          direccion?: string
          fecha_alta?: string
          fecha_nacimiento?: string
          nombre_completo?: string
          numero_licencia?: string | null
          placas?: string | null
          telefono?: string
          tipo_vehiculo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_staff: {
        Row: {
          created_at: string
          id: string
          notify_cancelado: boolean
          notify_en_camino: boolean
          notify_entrega_tardia: boolean
          notify_entregado: boolean
          notify_escalar: boolean
          notify_nuevo: boolean
          notify_preparando: boolean
          notify_programado_por_vencer: boolean
          notify_queja: boolean
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_cancelado?: boolean
          notify_en_camino?: boolean
          notify_entrega_tardia?: boolean
          notify_entregado?: boolean
          notify_escalar?: boolean
          notify_nuevo?: boolean
          notify_preparando?: boolean
          notify_programado_por_vencer?: boolean
          notify_queja?: boolean
          restaurant_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_cancelado?: boolean
          notify_en_camino?: boolean
          notify_entrega_tardia?: boolean
          notify_entregado?: boolean
          notify_escalar?: boolean
          notify_nuevo?: boolean
          notify_preparando?: boolean
          notify_programado_por_vencer?: boolean
          notify_queja?: boolean
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_agent_config: {
        Row: {
          created_at: string
          id: string
          llm_model: string
          restaurant_id: string
          system_prompt: string
          temperature: number
          tone_style: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          llm_model?: string
          restaurant_id: string
          system_prompt: string
          temperature?: number
          tone_style?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          llm_model?: string
          restaurant_id?: string
          system_prompt?: string
          temperature?: number
          tone_style?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_leases: {
        Row: {
          locked_until: string
          owner_message_id: string
          phone_hash: string
          restaurant_id: string
        }
        Insert: {
          locked_until: string
          owner_message_id: string
          phone_hash: string
          restaurant_id: string
        }
        Update: {
          locked_until?: string
          owner_message_id?: string
          phone_hash?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_leases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          messages: Json
          order_id: string | null
          phone: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          order_id?: string | null
          phone: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          order_id?: string | null
          phone?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_events: {
        Row: {
          attempts: number
          claimed_at: string
          last_error_class: string | null
          message_id: string
          phone_hash: string
          processed_at: string | null
          restaurant_id: string
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string
          last_error_class?: string | null
          message_id: string
          phone_hash: string
          processed_at?: string | null
          restaurant_id: string
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string
          last_error_class?: string | null
          message_id?: string
          phone_hash?: string
          processed_at?: string | null
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_customer_tier: {
        Args: { p_customer_id: string; p_restaurant_id: string }
        Returns: Json
      }
      claim_whatsapp_conversation: {
        Args: {
          p_lease_seconds?: number
          p_message_id: string
          p_phone_hash: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      claim_whatsapp_message: {
        Args: {
          p_message_id: string
          p_phone_hash: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      consume_api_rate_limit: {
        Args: {
          p_actor_hash: string
          p_max_requests: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      create_order_idempotent: {
        Args: {
          p_dedupe_fingerprint: string
          p_idempotency_key?: string
          p_order: Json
        }
        Returns: Json
      }
      finish_whatsapp_message: {
        Args: {
          p_error_class?: string
          p_message_id: string
          p_phone_hash: string
          p_restaurant_id: string
          p_status: string
        }
        Returns: undefined
      }
      get_order_status: { Args: { _order_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_staff: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      orders_bucketed_stats: {
        Args: {
          p_bucket_ends: string[]
          p_bucket_starts: string[]
          p_restaurant_id: string
        }
        Returns: {
          customer_count: number
          idx: number
          order_count: number
          revenue: number
        }[]
      }
      orders_channel_stats: {
        Args: { p_branch_id?: string; p_restaurant_id: string }
        Returns: {
          total_orders: number
          total_revenue: number
          voice_cancelled: number
          voice_completed: number
          voice_orders: number
          voice_revenue: number
          whatsapp_cancelled: number
          whatsapp_completed: number
          whatsapp_orders: number
          whatsapp_revenue: number
        }[]
      }
      shares_restaurant: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      sucursal_mas_cercana: {
        Args: { p_colonia: string; p_restaurant_id: string }
        Returns: {
          branch_name: string
          branch_slug: string
          colonia_encontrada: string
          distancia_km: number
        }[]
      }
      whatsapp_append_turn: {
        Args: {
          p_branch_id?: string
          p_new_messages: Json
          p_order_id?: string
          p_phone: string
          p_restaurant_id: string
          p_status?: string
        }
        Returns: Json
      }
      whatsapp_conversation_stats: {
        Args: { p_branch_id?: string; p_restaurant_id: string }
        Returns: {
          average_messages: number
          total: number
          with_order: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "repartidor" | "superadmin"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "repartidor", "superadmin"],
    },
  },
} as const
