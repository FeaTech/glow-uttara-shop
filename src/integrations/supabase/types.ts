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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          pincode: string
          profile_id: string
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string | null
          pincode: string
          profile_id: string
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          pincode?: string
          profile_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      coupon_customer_usage: {
        Row: {
          coupon_id: string
          created_at: string
          customer_id: string
          lifetime_used_count: number
          monthly_used_count: number
          updated_at: string
          usage_month: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_id: string
          lifetime_used_count?: number
          monthly_used_count?: number
          updated_at?: string
          usage_month: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_id?: string
          lifetime_used_count?: number
          monthly_used_count?: number
          updated_at?: string
          usage_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_customer_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_id: string
          id: string
          order_id: string
          released_at: string | null
          status: string
          usage_month: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          released_at?: string | null
          status?: string
          usage_month: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          released_at?: string | null
          status?: string
          usage_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          customer_lifetime_limit: number | null
          customer_monthly_limit: number | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          eligibility: string
          expires_at: string | null
          id: string
          max_discount_inr: number | null
          min_order_inr: number
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          customer_lifetime_limit?: number | null
          customer_monthly_limit?: number | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          eligibility?: string
          expires_at?: string | null
          id?: string
          max_discount_inr?: number | null
          min_order_inr?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          customer_lifetime_limit?: number | null
          customer_monthly_limit?: number | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          eligibility?: string
          expires_at?: string | null
          id?: string
          max_discount_inr?: number | null
          min_order_inr?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          order_id: string
          price_inr: number
          product_id: string
          quantity: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_id: string
          price_inr: number
          product_id: string
          quantity: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          price_inr?: number
          product_id?: string
          quantity?: number
          variant_id?: string | null
          variant_name?: string | null
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_email: string | null
          discount_inr: number
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_channel: string | null
          payment_fee_inr: number
          payment_fee_paise: number
          payment_fee_rate_bps: number
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          shipping_address: Json
          shipping_inr: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_inr: number | null
          tax_paise: number
          tax_rate_bps: number
          taxes_inr: number
          total_inr: number
          total_paise: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          discount_inr?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_channel?: string | null
          payment_fee_inr?: number
          payment_fee_paise?: number
          payment_fee_rate_bps?: number
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          shipping_address: Json
          shipping_inr?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_inr?: number | null
          tax_paise?: number
          tax_rate_bps?: number
          taxes_inr?: number
          total_inr: number
          total_paise?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          discount_inr?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_channel?: string | null
          payment_fee_inr?: number
          payment_fee_paise?: number
          payment_fee_rate_bps?: number
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          shipping_address?: Json
          shipping_inr?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_inr?: number | null
          tax_paise?: number
          tax_rate_bps?: number
          taxes_inr?: number
          total_inr?: number
          total_paise?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          compare_price_inr: number | null
          created_at: string
          id: string
          price_inr: number | null
          product_id: string
          sku: string | null
          stock: number
          updated_at: string
          variant_name: string
        }
        Insert: {
          compare_price_inr?: number | null
          created_at?: string
          id?: string
          price_inr?: number | null
          product_id: string
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_name: string
        }
        Update: {
          compare_price_inr?: number | null
          created_at?: string
          id?: string
          price_inr?: number | null
          product_id?: string
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          base_unit: string | null
          category_id: string | null
          compare_price_inr: number | null
          created_at: string
          description: string | null
          id: string
          images: Json
          is_featured: boolean
          name: string
          price_inr: number
          product_type: Database["public"]["Enums"]["product_type"]
          rating_avg: number
          rating_count: number
          short_description: string | null
          slug: string
          stock: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          attributes?: Json
          base_unit?: string | null
          category_id?: string | null
          compare_price_inr?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          name: string
          price_inr: number
          product_type?: Database["public"]["Enums"]["product_type"]
          rating_avg?: number
          rating_count?: number
          short_description?: string | null
          slug: string
          stock?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          attributes?: Json
          base_unit?: string | null
          category_id?: string | null
          compare_price_inr?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          name?: string
          price_inr?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          rating_avg?: number
          rating_count?: number
          short_description?: string | null
          slug?: string
          stock?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          referral_code: string
          referral_registered_at: string | null
          referred_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string
          referral_registered_at?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string
          referral_registered_at?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_commission_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          amount_delta: number
          commission_id: string
          created_at: string
          id: string
          new_status:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          previous_status:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          amount_delta?: number
          commission_id: string
          created_at?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          previous_status?:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          amount_delta?: number
          commission_id?: string
          created_at?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          previous_status?:
            | Database["public"]["Enums"]["referral_commission_status"]
            | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_commission_audit_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "referral_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          adjustment_amount: number
          adjustment_reason: string | null
          approved_at: string | null
          beneficiary_user_id: string
          cancelled_at: string | null
          commission_amount: number
          commission_percentage: number
          created_at: string
          eligible_order_amount: number
          id: string
          order_id: string
          paid_at: string | null
          purchasing_user_id: string
          referral_level: number
          status: Database["public"]["Enums"]["referral_commission_status"]
        }
        Insert: {
          adjustment_amount?: number
          adjustment_reason?: string | null
          approved_at?: string | null
          beneficiary_user_id: string
          cancelled_at?: string | null
          commission_amount?: number
          commission_percentage: number
          created_at?: string
          eligible_order_amount?: number
          id?: string
          order_id: string
          paid_at?: string | null
          purchasing_user_id: string
          referral_level: number
          status?: Database["public"]["Enums"]["referral_commission_status"]
        }
        Update: {
          adjustment_amount?: number
          adjustment_reason?: string | null
          approved_at?: string | null
          beneficiary_user_id?: string
          cancelled_at?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          eligible_order_amount?: number
          id?: string
          order_id?: string
          paid_at?: string | null
          purchasing_user_id?: string
          referral_level?: number
          status?: Database["public"]["Enums"]["referral_commission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          approval_waiting_days: number
          id: boolean
          level_1_percentage: number
          level_2_percentage: number
          minimum_payout_amount: number
          program_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_waiting_days?: number
          id?: boolean
          level_1_percentage?: number
          level_2_percentage?: number
          minimum_payout_amount?: number
          program_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_waiting_days?: number
          id?: boolean
          level_1_percentage?: number
          level_2_percentage?: number
          minimum_payout_amount?: number
          program_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string
          id: string
          is_verified: boolean
          product_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          product_id?: string
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_cart_item: {
        Args: { p_product_id: string; p_quantity: number; p_variant_id: string }
        Returns: string
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      approve_due_referral_commissions: { Args: never; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: { Args: { _code: string }; Returns: undefined }
      my_referral_counts: {
        Args: never
        Returns: {
          direct_count: number
          indirect_count: number
        }[]
      }
      my_referral_history: {
        Args: never
        Returns: {
          adjustment_amount: number
          commission_amount: number
          commission_percentage: number
          eligible_order_amount: number
          id: string
          order_date: string
          order_id: string
          referral_level: number
          referred_customer: string
          status: Database["public"]["Enums"]["referral_commission_status"]
        }[]
      }
      release_coupon_usage: { Args: { _order_id: string }; Returns: undefined }
      reserve_coupon_usage: {
        Args: { _code: string; _customer_id: string; _order_id: string }
        Returns: undefined
      }
      restore_order_stock: { Args: { _order_id: string }; Returns: undefined }
      set_cart_item_quantity: {
        Args: { p_item_id: string; p_quantity: number }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "customer"
      discount_type: "percent" | "fixed"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      product_type: "regular" | "organic" | "korean" | "budget"
      referral_commission_status: "pending" | "approved" | "paid" | "cancelled"
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
      app_role: ["admin", "customer"],
      discount_type: ["percent", "fixed"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      product_type: ["regular", "organic", "korean", "budget"],
      referral_commission_status: ["pending", "approved", "paid", "cancelled"],
    },
  },
} as const
