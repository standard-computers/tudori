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
      accounts: {
        Row: {
          account_id: string
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          type: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          account_id: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          type?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          account_id?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          type?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          area_id: string
          created_at: string
          description: string | null
          height: number | null
          height_uom: string | null
          id: string
          is_production_enabled: boolean
          length: number | null
          length_uom: string | null
          location_id: string
          name: string
          updated_at: string
          width: number | null
          width_uom: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          is_production_enabled?: boolean
          length?: number | null
          length_uom?: string | null
          location_id: string
          name: string
          updated_at?: string
          width?: number | null
          width_uom?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          is_production_enabled?: boolean
          length?: number | null
          length_uom?: string | null
          location_id?: string
          name?: string
          updated_at?: string
          width?: number | null
          width_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assignment_id: string
          company_id: string
          created_at: string
          destination_location_id: string
          id: string
          is_active: boolean
          notes: string | null
          priority: number | null
          product_id: string
          source_location_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assignment_id: string
          company_id: string
          created_at?: string
          destination_location_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number | null
          product_id: string
          source_location_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assignment_id?: string
          company_id?: string
          created_at?: string
          destination_location_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number | null
          product_id?: string
          source_location_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          company_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          company_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          company_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          bom_id: string
          company_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          output_quantity: number
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bom_id: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          output_quantity?: number
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bom_id?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          output_quantity?: number
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_products: {
        Row: {
          bin_id: string
          created_at: string
          id: string
          max_quantity: number | null
          product_id: string
        }
        Insert: {
          bin_id: string
          created_at?: string
          id?: string
          max_quantity?: number | null
          product_id: string
        }
        Update: {
          bin_id?: string
          created_at?: string
          id?: string
          max_quantity?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bin_products_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bin_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bins: {
        Row: {
          allow_auto_picking: boolean
          allow_auto_put_away: boolean
          allow_picking: boolean
          allow_put_away: boolean
          area_id: string
          bin_id: string
          capacity: string | null
          created_at: string
          description: string | null
          height: number | null
          height_uom: string | null
          id: string
          is_production_enabled: boolean
          length: number | null
          length_uom: string | null
          name: string
          updated_at: string
          weight_capacity: number | null
          weight_capacity_uom: string | null
          width: number | null
          width_uom: string | null
        }
        Insert: {
          allow_auto_picking?: boolean
          allow_auto_put_away?: boolean
          allow_picking?: boolean
          allow_put_away?: boolean
          area_id: string
          bin_id: string
          capacity?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          is_production_enabled?: boolean
          length?: number | null
          length_uom?: string | null
          name: string
          updated_at?: string
          weight_capacity?: number | null
          weight_capacity_uom?: string | null
          width?: number | null
          width_uom?: string | null
        }
        Update: {
          allow_auto_picking?: boolean
          allow_auto_put_away?: boolean
          allow_picking?: boolean
          allow_put_away?: boolean
          area_id?: string
          bin_id?: string
          capacity?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          is_production_enabled?: boolean
          length?: number | null
          length_uom?: string | null
          name?: string
          updated_at?: string
          weight_capacity?: number | null
          weight_capacity_uom?: string | null
          width?: number | null
          width_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bins_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_step_items: {
        Row: {
          bom_step_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          bom_step_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          bom_step_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_step_items_bom_step_id_fkey"
            columns: ["bom_step_id"]
            isOneToOne: false
            referencedRelation: "bom_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_step_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_steps: {
        Row: {
          bin_id: string | null
          bom_id: string
          created_at: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          location_id: string | null
          name: string
          step_number: number
        }
        Insert: {
          bin_id?: string | null
          bom_id: string
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          location_id?: string | null
          name: string
          step_number?: number
        }
        Update: {
          bin_id?: string | null
          bom_id?: string
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          location_id?: string | null
          name?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_steps_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_steps_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_steps_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          carrier_id: string
          city: string | null
          company_id: string
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          carrier_id: string
          city?: string | null
          company_id: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          carrier_id?: string
          city?: string | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carriers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string
          size: string | null
          state: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code: string
          size?: string | null
          state: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string
          size?: string | null
          state?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memos: {
        Row: {
          account_id: string
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string | null
          ledger_id: string | null
          memo_date: string
          memo_number: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          ledger_id?: string | null
          memo_date?: string
          memo_number: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          ledger_id?: string | null
          memo_date?: string
          memo_number?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_memos_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_id: string
          contact_name: string | null
          country: string | null
          created_at: string
          customer_id: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_memos: {
        Row: {
          account_id: string
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string | null
          ledger_id: string | null
          memo_date: string
          memo_number: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          ledger_id?: string | null
          memo_date?: string
          memo_number: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          ledger_id?: string | null
          memo_date?: string
          memo_number?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debit_memos_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_memos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_memos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_memos_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          delivered_date: string | null
          delivery_id: string
          expected_date: string | null
          id: string
          is_fulfilled: boolean
          location_id: string | null
          notes: string | null
          purchase_order_id: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          delivered_date?: string | null
          delivery_id: string
          expected_date?: string | null
          id?: string
          is_fulfilled?: boolean
          location_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          delivered_date?: string | null
          delivery_id?: string
          expected_date?: string | null
          id?: string
          is_fulfilled?: boolean
          location_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      document_id_config: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          id: string
          num_digits: number
          prefix: string | null
          starting_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type: string
          id?: string
          num_digits?: number
          prefix?: string | null
          starting_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          id?: string
          num_digits?: number
          prefix?: string | null
          starting_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_id_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bonus_eligible: boolean | null
          company_id: string
          created_at: string
          department: string | null
          email: string | null
          employee_id: string
          first_name: string
          hire_date: string | null
          id: string
          is_hourly: boolean | null
          job_title: string | null
          last_name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
          wage: number | null
        }
        Insert: {
          bonus_eligible?: boolean | null
          company_id: string
          created_at?: string
          department?: string | null
          email?: string | null
          employee_id: string
          first_name: string
          hire_date?: string | null
          id?: string
          is_hourly?: boolean | null
          job_title?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wage?: number | null
        }
        Update: {
          bonus_eligible?: boolean | null
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string | null
          employee_id?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          is_hourly?: boolean | null
          job_title?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_issue_items: {
        Row: {
          bin_id: string | null
          created_at: string
          goods_issue_id: string
          id: string
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          goods_issue_id: string
          id?: string
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          goods_issue_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_issue_items_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issue_items_goods_issue_id_fkey"
            columns: ["goods_issue_id"]
            isOneToOne: false
            referencedRelation: "goods_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issue_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issue_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_issues: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          issue_date: string
          issue_number: string
          location_id: string
          notes: string | null
          outbound_delivery_id: string | null
          sales_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          issue_number: string
          location_id: string
          notes?: string | null
          outbound_delivery_id?: string | null
          sales_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          issue_number?: string
          location_id?: string
          notes?: string | null
          outbound_delivery_id?: string | null
          sales_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issues_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issues_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issues_outbound_delivery_id_fkey"
            columns: ["outbound_delivery_id"]
            isOneToOne: false
            referencedRelation: "outbound_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_issues_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          bin_id: string | null
          created_at: string
          goods_receipt_id: string
          id: string
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          goods_receipt_id: string
          id?: string
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          goods_receipt_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          company_id: string
          created_at: string
          delivery_id: string | null
          id: string
          location_id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_date: string
          receipt_number: string
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          location_id: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          receipt_number: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          receipt_number?: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          bin_id: string | null
          created_at: string
          id: string
          last_counted_at: string | null
          location_id: string
          max_quantity: number | null
          min_quantity: number | null
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          id?: string
          last_counted_at?: string | null
          location_id: string
          max_quantity?: number | null
          min_quantity?: number | null
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          id?: string
          last_counted_at?: string | null
          location_id?: string
          max_quantity?: number | null
          min_quantity?: number | null
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string | null
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string | null
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string | null
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
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
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tax_rates: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          tax_amount: number
          tax_rate_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          tax_amount?: number
          tax_rate_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          tax_amount?: number
          tax_rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tax_rates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tax_rates_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          amount: number
          company_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          ledger_id: string | null
          notes: string | null
          purchase_order_id: string | null
          sales_order_id: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          company_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          ledger_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          company_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          ledger_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ledger_id: string
          reference_id: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ledger_id: string
          reference_id?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ledger_id?: string
          reference_id?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          ledger_id: string
          location_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          ledger_id: string
          location_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          ledger_id?: string
          location_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_users: {
        Row: {
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_users_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          company_id: string
          country: string
          created_at: string
          id: string
          is_internal_vendor: boolean
          is_pos_enabled: boolean
          is_production_enabled: boolean
          location_id: string
          name: string
          postal_code: string
          state: string
          type: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          company_id: string
          country?: string
          created_at?: string
          id?: string
          is_internal_vendor?: boolean
          is_pos_enabled?: boolean
          is_production_enabled?: boolean
          location_id: string
          name: string
          postal_code: string
          state: string
          type?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          company_id?: string
          country?: string
          created_at?: string
          id?: string
          is_internal_vendor?: boolean
          is_pos_enabled?: boolean
          is_production_enabled?: boolean
          location_id?: string
          name?: string
          postal_code?: string
          state?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_movements: {
        Row: {
          bin_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          destination_bin_id: string | null
          id: string
          location_id: string
          movement_id: string
          movement_type: string
          notes: string | null
          product_id: string
          pu_id: string | null
          quantity: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          source_bin_id: string | null
        }
        Insert: {
          bin_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          destination_bin_id?: string | null
          id?: string
          location_id: string
          movement_id: string
          movement_type: string
          notes?: string | null
          product_id: string
          pu_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          source_bin_id?: string | null
        }
        Update: {
          bin_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          destination_bin_id?: string | null
          id?: string
          location_id?: string
          movement_id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          pu_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          source_bin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_movements_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_destination_bin_id_fkey"
            columns: ["destination_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_source_bin_id_fkey"
            columns: ["source_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_deliveries: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          delivered_date: string | null
          delivery_number: string
          from_location_id: string | null
          goods_issue_id: string | null
          id: string
          notes: string | null
          sales_order_id: string | null
          ship_to_address_line1: string | null
          ship_to_address_line2: string | null
          ship_to_city: string | null
          ship_to_country: string | null
          ship_to_postal_code: string | null
          ship_to_state: string | null
          shipped_date: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          delivery_number: string
          from_location_id?: string | null
          goods_issue_id?: string | null
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          ship_to_address_line1?: string | null
          ship_to_address_line2?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_postal_code?: string | null
          ship_to_state?: string | null
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          delivery_number?: string
          from_location_id?: string | null
          goods_issue_id?: string | null
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          ship_to_address_line1?: string | null
          ship_to_address_line2?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_postal_code?: string | null
          ship_to_state?: string | null
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_deliveries_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_deliveries_goods_issue_id_fkey"
            columns: ["goods_issue_id"]
            isOneToOne: false
            referencedRelation: "goods_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_deliveries_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_units: {
        Row: {
          company_id: string
          created_at: string
          id: string
          product_id: string | null
          pu_number: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          pu_number: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          pu_number?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packaging_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          component_product_id: string
          created_at: string
          id: string
          parent_product_id: string
          quantity: number
        }
        Insert: {
          component_product_id: string
          created_at?: string
          id?: string
          parent_product_id: string
          quantity?: number
        }
        Update: {
          component_product_id?: string
          created_at?: string
          id?: string
          parent_product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_safety_stock: {
        Row: {
          created_at: string
          id: string
          location_id: string
          product_id: string
          safety_stock_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          safety_stock_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          safety_stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_safety_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_safety_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_uoms: {
        Row: {
          abbreviation: string | null
          conversion_factor: number
          created_at: string
          id: string
          name: string
          product_id: string
        }
        Insert: {
          abbreviation?: string | null
          conversion_factor?: number
          created_at?: string
          id?: string
          name: string
          product_id: string
        }
        Update: {
          abbreviation?: string | null
          conversion_factor?: number
          created_at?: string
          id?: string
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_uoms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_consumptions: {
        Row: {
          bin_id: string | null
          bom_step_id: string
          consumed_at: string
          created_at: string
          id: string
          ledger_transaction_id: string | null
          product_id: string
          production_order_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          bin_id?: string | null
          bom_step_id: string
          consumed_at?: string
          created_at?: string
          id?: string
          ledger_transaction_id?: string | null
          product_id: string
          production_order_id: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          bin_id?: string | null
          bom_step_id?: string
          consumed_at?: string
          created_at?: string
          id?: string
          ledger_transaction_id?: string | null
          product_id?: string
          production_order_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_order_consumptions_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_consumptions_bom_step_id_fkey"
            columns: ["bom_step_id"]
            isOneToOne: false
            referencedRelation: "bom_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_consumptions_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_consumptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_consumptions_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          consumed_quantity: number
          created_at: string
          id: string
          product_id: string
          production_order_id: string
          required_quantity: number
        }
        Insert: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          product_id: string
          production_order_id: string
          required_quantity?: number
        }
        Update: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          product_id?: string
          production_order_id?: string
          required_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          bom_id: string | null
          company_id: string
          completed_date: string | null
          completed_step_ids: string[] | null
          created_at: string
          id: string
          location_id: string
          notes: string | null
          order_number: string
          product_id: string
          quantity: number
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bom_id?: string | null
          company_id: string
          completed_date?: string | null
          completed_step_ids?: string[] | null
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          order_number: string
          product_id: string
          quantity?: number
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bom_id?: string | null
          company_id?: string
          completed_date?: string | null
          completed_step_ids?: string[] | null
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          order_number?: string
          product_id?: string
          quantity?: number
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          height: number | null
          height_uom: string | null
          id: string
          image_url: string | null
          is_batched: boolean
          is_consumable: boolean
          keep_inventory: boolean
          lead_time_days: number | null
          length: number | null
          length_uom: string | null
          manufacture_time_days: number | null
          min_shelf_life_days: number | null
          name: string
          price: number | null
          product_id: string
          sku: string | null
          status: string
          transport_time_days: number | null
          unit: string | null
          updated_at: string
          vendor_id: string | null
          weight: number | null
          weight_uom: string | null
          width: number | null
          width_uom: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          image_url?: string | null
          is_batched?: boolean
          is_consumable?: boolean
          keep_inventory?: boolean
          lead_time_days?: number | null
          length?: number | null
          length_uom?: string | null
          manufacture_time_days?: number | null
          min_shelf_life_days?: number | null
          name: string
          price?: number | null
          product_id: string
          sku?: string | null
          status?: string
          transport_time_days?: number | null
          unit?: string | null
          updated_at?: string
          vendor_id?: string | null
          weight?: number | null
          weight_uom?: string | null
          width?: number | null
          width_uom?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          height?: number | null
          height_uom?: string | null
          id?: string
          image_url?: string | null
          is_batched?: boolean
          is_consumable?: boolean
          keep_inventory?: boolean
          lead_time_days?: number | null
          length?: number | null
          length_uom?: string | null
          manufacture_time_days?: number | null
          min_shelf_life_days?: number | null
          name?: string
          price?: number | null
          product_id?: string
          sku?: string | null
          status?: string
          transport_time_days?: number | null
          unit?: string | null
          updated_at?: string
          vendor_id?: string | null
          weight?: number | null
          weight_uom?: string | null
          width?: number | null
          width_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          pu_id: string | null
          purchase_order_id: string
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          pu_id?: string | null
          purchase_order_id: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          pu_id?: string | null
          purchase_order_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_tax_rates: {
        Row: {
          created_at: string
          id: string
          purchase_order_id: string
          tax_amount: number
          tax_rate_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          purchase_order_id: string
          tax_amount?: number
          tax_rate_id: string
        }
        Update: {
          created_at?: string
          id?: string
          purchase_order_id?: string
          tax_amount?: number
          tax_rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_tax_rates_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_tax_rates_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          bill_to_location_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          ledger_id: string | null
          location_id: string | null
          notes: string | null
          order_date: string | null
          po_number: string
          requisition_id: string | null
          source_location_id: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          tax_rate_id: string | null
          total_amount: number | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          bill_to_location_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          ledger_id?: string | null
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          po_number: string
          requisition_id?: string | null
          source_location_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          bill_to_location_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          ledger_id?: string | null
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          po_number?: string
          requisition_id?: string | null
          source_location_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_bill_to_location_id_fkey"
            columns: ["bill_to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          requisition_id: string
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          requisition_id: string
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          requisition_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          requisition_id: string
          status: string
          total_amount: number | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          requisition_id: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          requisition_id?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          carrier_id: string | null
          company_id: string
          created_at: string
          destination_location_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          priority: number | null
          route_id: string
          source_location_id: string
          updated_at: string
        }
        Insert: {
          carrier_id?: string | null
          company_id: string
          created_at?: string
          destination_location_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          priority?: number | null
          route_id: string
          source_location_id: string
          updated_at?: string
        }
        Update: {
          carrier_id?: string | null
          company_id?: string
          created_at?: string
          destination_location_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          priority?: number | null
          route_id?: string
          source_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          pu_id: string | null
          quantity: number
          sales_order_id: string
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          pu_id?: string | null
          quantity?: number
          sales_order_id: string
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          pu_id?: string | null
          quantity?: number
          sales_order_id?: string
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_pu_id_fkey"
            columns: ["pu_id"]
            isOneToOne: false
            referencedRelation: "packaging_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_tax_rates: {
        Row: {
          created_at: string
          id: string
          sales_order_id: string
          tax_amount: number
          tax_rate_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sales_order_id: string
          tax_amount?: number
          tax_rate_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sales_order_id?: string
          tax_amount?: number
          tax_rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_tax_rates_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_tax_rates_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          bill_to_location_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          expected_delivery_date: string | null
          id: string
          ledger_id: string | null
          location_id: string | null
          notes: string | null
          order_date: string
          so_number: string
          status: string
          subtotal: number | null
          tax_amount: number | null
          tax_rate_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          bill_to_location_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          ledger_id?: string | null
          location_id?: string | null
          notes?: string | null
          order_date?: string
          so_number: string
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          bill_to_location_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          ledger_id?: string | null
          location_id?: string | null
          notes?: string | null
          order_date?: string
          so_number?: string
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_bill_to_location_id_fkey"
            columns: ["bill_to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          location_id: string | null
          priority: string
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          rate: number
          rate_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          rate?: number
          rate_type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          rate?: number
          rate_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          role: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          role?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          role?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_punches: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          location_id: string | null
          notes: string | null
          punch_in: string
          punch_out: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          location_id?: string | null
          notes?: string | null
          punch_in: string
          punch_out?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          punch_in?: string
          punch_out?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          dashboard_tile_order: string[] | null
          hidden_tiles: string[] | null
          id: string
          open_apps_in_new_tab: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_tile_order?: string[] | null
          hidden_tiles?: string[] | null
          id?: string
          open_apps_in_new_tab?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_tile_order?: string[] | null
          hidden_tiles?: string[] | null
          id?: string
          open_apps_in_new_tab?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_transaction_access: {
        Row: {
          company_id: string
          created_at: string
          has_access: boolean
          id: string
          transaction_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          has_access?: boolean
          id?: string
          transaction_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          has_access?: boolean
          id?: string
          transaction_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_transaction_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_id: string
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          status: string
          type: string
          updated_at: string
          vendor_id: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          type?: string
          updated_at?: string
          vendor_id: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          type?: string
          updated_at?: string
          vendor_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customers_safe: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_id: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          customer_id: string | null
          email: string | null
          id: string | null
          name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          type: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string | null
          contact_name?: never
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: never
          id?: string | null
          name?: string | null
          notes?: string | null
          phone?: never
          postal_code?: string | null
          state?: string | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string | null
          contact_name?: never
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: never
          id?: string | null
          name?: string | null
          notes?: string | null
          phone?: never
          postal_code?: string | null
          state?: string | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_assignment_id: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_carrier_id: { Args: { p_company_id: string }; Returns: string }
      generate_route_id: { Args: { p_company_id: string }; Returns: string }
      get_next_account_id: { Args: { p_company_id: string }; Returns: string }
      get_next_bom_id: { Args: { p_company_id: string }; Returns: string }
      get_next_credit_memo_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_customer_id: { Args: { p_company_id: string }; Returns: string }
      get_next_debit_memo_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_delivery_id: { Args: { p_company_id: string }; Returns: string }
      get_next_employee_id: { Args: { p_company_id: string }; Returns: string }
      get_next_goods_issue_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_goods_receipt_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_ledger_id: { Args: { p_company_id: string }; Returns: string }
      get_next_location_id: { Args: { p_company_id: string }; Returns: string }
      get_next_movement_id: { Args: { p_company_id: string }; Returns: string }
      get_next_outbound_delivery_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_po_number: { Args: { p_company_id: string }; Returns: string }
      get_next_product_id: { Args: { p_company_id: string }; Returns: string }
      get_next_production_order_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_pu_number: { Args: { p_company_id: string }; Returns: string }
      get_next_requisition_id: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_so_number: { Args: { p_company_id: string }; Returns: string }
      get_next_team_id: { Args: { p_company_id: string }; Returns: string }
      get_next_vendor_id: { Args: { p_company_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_it: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer" | "it"
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
      app_role: ["owner", "admin", "member", "viewer", "it"],
    },
  },
} as const
