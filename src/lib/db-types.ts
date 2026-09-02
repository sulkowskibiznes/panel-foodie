export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_links: {
        Row: {
          can_approve: boolean
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          failed_attempts: number
          failed_window_started_at: string | null
          id: string
          label: string
          last_used_at: string | null
          locked_until: string | null
          pin_hash: string
          pin_kind: Database["public"]["Enums"]["pin_kind"]
          revoked_at: string | null
          token_enc: string
          token_hash: string
          token_lookup: string
        }
        Insert: {
          can_approve?: boolean
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_attempts?: number
          failed_window_started_at?: string | null
          id?: string
          label: string
          last_used_at?: string | null
          locked_until?: string | null
          pin_hash: string
          pin_kind?: Database["public"]["Enums"]["pin_kind"]
          revoked_at?: string | null
          token_enc: string
          token_hash: string
          token_lookup: string
        }
        Update: {
          can_approve?: boolean
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_attempts?: number
          failed_window_started_at?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          locked_until?: string | null
          pin_hash?: string
          pin_kind?: Database["public"]["Enums"]["pin_kind"]
          revoked_at?: string | null
          token_enc?: string
          token_hash?: string
          token_lookup?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_variants: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["variant_kind"]
          label: string | null
          location_id: string | null
          position: number
          updated_at: string
          value_text: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["variant_kind"]
          label?: string | null
          location_id?: string | null
          position?: number
          updated_at?: string
          value_text?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["variant_kind"]
          label?: string | null
          location_id?: string | null
          position?: number
          updated_at?: string
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "item_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "package_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_variants_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_label: string | null
          client_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          ip_hash: string | null
          meta: Json
          ua: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_label?: string | null
          client_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip_hash?: string | null
          meta?: Json
          ua?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_label?: string | null
          client_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip_hash?: string | null
          meta?: Json
          ua?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ads_folder_id: string | null
          ads_folder_url: string | null
          created_at: string
          goal: Database["public"]["Enums"]["campaign_goal"] | null
          id: string
          name: string
          note: string | null
          package_id: string
          position: number
          updated_at: string
        }
        Insert: {
          ads_folder_id?: string | null
          ads_folder_url?: string | null
          created_at?: string
          goal?: Database["public"]["Enums"]["campaign_goal"] | null
          id?: string
          name: string
          note?: string | null
          package_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          ads_folder_id?: string | null
          ads_folder_url?: string | null
          created_at?: string
          goal?: Database["public"]["Enums"]["campaign_goal"] | null
          id?: string
          name?: string
          note?: string | null
          package_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          client_id: string
          team_member_id: string
        }
        Insert: {
          client_id: string
          team_member_id: string
        }
        Update: {
          client_id?: string
          team_member_id?: string
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
            foreignKeyName: "client_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
          name: string
          phone: string | null
          role_label: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role_label?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role_label?: string | null
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
      client_sessions: {
        Row: {
          access_link_id: string
          created_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          last_seen_at: string
          previous_session_hash: string | null
          revoked_at: string | null
          rotated_at: string
          session_hash: string
          ua_hash: string | null
        }
        Insert: {
          access_link_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          previous_session_hash?: string | null
          revoked_at?: string | null
          rotated_at?: string
          session_hash: string
          ua_hash?: string | null
        }
        Update: {
          access_link_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          previous_session_hash?: string | null
          revoked_at?: string | null
          rotated_at?: string
          session_hash?: string
          ua_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_access_link_id_fkey"
            columns: ["access_link_id"]
            isOneToOne: false
            referencedRelation: "access_links"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auto_approve_default: boolean
          auto_approve_hours: number | null
          category: Database["public"]["Enums"]["client_category"]
          cooperation_started_on: string | null
          created_at: string
          drive_folder_url: string | null
          extra_locations_count: number
          id: string
          monthly_amount_net: number | null
          name: string
          opiekun_id: string | null
          slack_channel: string | null
          slug: string
          status: Database["public"]["Enums"]["client_status"]
          tier: Database["public"]["Enums"]["package_tier"]
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_approve_default?: boolean
          auto_approve_hours?: number | null
          category: Database["public"]["Enums"]["client_category"]
          cooperation_started_on?: string | null
          created_at?: string
          drive_folder_url?: string | null
          extra_locations_count?: number
          id?: string
          monthly_amount_net?: number | null
          name: string
          opiekun_id?: string | null
          slack_channel?: string | null
          slug: string
          status?: Database["public"]["Enums"]["client_status"]
          tier: Database["public"]["Enums"]["package_tier"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_approve_default?: boolean
          auto_approve_hours?: number | null
          category?: Database["public"]["Enums"]["client_category"]
          cooperation_started_on?: string | null
          created_at?: string
          drive_folder_url?: string | null
          extra_locations_count?: number
          id?: string
          monthly_amount_net?: number | null
          name?: string
          opiekun_id?: string | null
          slack_channel?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["client_status"]
          tier?: Database["public"]["Enums"]["package_tier"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_opiekun_id_fkey"
            columns: ["opiekun_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          after_approval: boolean
          author_contact_id: string | null
          author_kind: Database["public"]["Enums"]["author_kind"]
          author_member_id: string | null
          body: string
          created_at: string
          id: string
          item_id: string | null
          package_id: string
          resolved_at: string | null
          resolved_by: string | null
          round: number
          seen_by_client_at: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          after_approval?: boolean
          author_contact_id?: string | null
          author_kind: Database["public"]["Enums"]["author_kind"]
          author_member_id?: string | null
          body: string
          created_at?: string
          id?: string
          item_id?: string | null
          package_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          round: number
          seen_by_client_at?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          after_approval?: boolean
          author_contact_id?: string | null
          author_kind?: Database["public"]["Enums"]["author_kind"]
          author_member_id?: string | null
          body?: string
          created_at?: string
          id?: string
          item_id?: string | null
          package_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          round?: number
          seen_by_client_at?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_contact_id_fkey"
            columns: ["author_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "package_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ad_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string
          created_at: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          title: string
          uploaded_by: string | null
          valid_from: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_path: string
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          title: string
          uploaded_by?: string | null
          valid_from?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          title?: string
          uploaded_by?: string | null
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          files_done: number | null
          files_total: number | null
          finished_at: string | null
          id: string
          item_id: string | null
          kind: Database["public"]["Enums"]["import_kind"]
          package_id: string | null
          source_folder_id: string | null
          source_url: string
          status: Database["public"]["Enums"]["import_status"]
          warnings: Json
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          files_done?: number | null
          files_total?: number | null
          finished_at?: string | null
          id?: string
          item_id?: string | null
          kind: Database["public"]["Enums"]["import_kind"]
          package_id?: string | null
          source_folder_id?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["import_status"]
          warnings?: Json
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          files_done?: number | null
          files_total?: number | null
          finished_at?: string | null
          id?: string
          item_id?: string | null
          kind?: Database["public"]["Enums"]["import_kind"]
          package_id?: string | null
          source_folder_id?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["import_status"]
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "package_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_gross: number
          amount_net: number
          client_id: string
          created_at: string
          due_date: string
          fakturowo_id: string | null
          id: string
          issue_date: string
          note: string | null
          number: string
          paid_at: string | null
          pdf_path: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount_gross: number
          amount_net: number
          client_id: string
          created_at?: string
          due_date: string
          fakturowo_id?: string | null
          id?: string
          issue_date: string
          note?: string | null
          number: string
          paid_at?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount_gross?: number
          amount_net?: number
          client_id?: string
          created_at?: string
          due_date?: string
          fakturowo_id?: string | null
          id?: string
          issue_date?: string
          note?: string | null
          number?: string
          paid_at?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
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
        ]
      }
      item_assets: {
        Row: {
          bytes: number | null
          created_at: string
          drive_file_id: string | null
          duration_ms: number | null
          height: number | null
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          mime: string | null
          original_name: string | null
          position: number
          preview_path: string | null
          storage_path: string
          superseded_at: string | null
          superseded_by: string | null
          thumb_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          drive_file_id?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          mime?: string | null
          original_name?: string | null
          position?: number
          preview_path?: string | null
          storage_path: string
          superseded_at?: string | null
          superseded_by?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          drive_file_id?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          mime?: string | null
          original_name?: string | null
          position?: number
          preview_path?: string | null
          storage_path?: string
          superseded_at?: string | null
          superseded_by?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_assets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "package_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_assets_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "item_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      item_views: {
        Row: {
          access_link_id: string
          first_viewed_at: string
          item_id: string
        }
        Insert: {
          access_link_id: string
          first_viewed_at?: string
          item_id: string
        }
        Update: {
          access_link_id?: string
          first_viewed_at?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_views_access_link_id_fkey"
            columns: ["access_link_id"]
            isOneToOne: false
            referencedRelation: "access_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "package_items"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          avatar_path: string | null
          city: string | null
          client_id: string
          fb_page_name: string
          id: string
          ig_handle: string | null
          name: string
          position: number
          separate_materials: boolean
        }
        Insert: {
          address?: string | null
          avatar_path?: string | null
          city?: string | null
          client_id: string
          fb_page_name: string
          id?: string
          ig_handle?: string | null
          name: string
          position?: number
          separate_materials?: boolean
        }
        Update: {
          address?: string | null
          avatar_path?: string | null
          city?: string | null
          client_id?: string
          fb_page_name?: string
          id?: string
          ig_handle?: string | null
          name?: string
          position?: number
          separate_materials?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          body_md: string | null
          client_id: string
          done_at: string | null
          done_by_contact_id: string | null
          external_url: string | null
          form_url: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          body_md?: string | null
          client_id: string
          done_at?: string | null
          done_by_contact_id?: string | null
          external_url?: string | null
          form_url?: string | null
          id?: string
          position: number
          title: string
        }
        Update: {
          body_md?: string | null
          client_id?: string
          done_at?: string | null
          done_by_contact_id?: string | null
          external_url?: string | null
          form_url?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_steps_done_by_contact_id_fkey"
            columns: ["done_by_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          attempts: number
          created_at: string
          event: string
          id: number
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          event: string
          id?: number
          last_error?: string | null
          payload: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          event?: string
          id?: number
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
        }
        Relationships: []
      }
      package_events: {
        Row: {
          actor_id: string | null
          actor_kind: Database["public"]["Enums"]["actor_kind"] | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["package_event_kind"]
          package_id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["actor_kind"] | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["package_event_kind"]
          package_id: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["actor_kind"] | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["package_event_kind"]
          package_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "package_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          added_after_submit: boolean
          campaign_id: string | null
          caption: string | null
          created_at: string
          id: string
          internal_note: string | null
          location_ids: string[]
          origin: Database["public"]["Enums"]["item_origin"]
          package_id: string
          position: number
          publish_at: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_in_round: number | null
        }
        Insert: {
          added_after_submit?: boolean
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          location_ids?: string[]
          origin?: Database["public"]["Enums"]["item_origin"]
          package_id: string
          position: number
          publish_at?: string | null
          title?: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at?: string
          updated_in_round?: number | null
        }
        Update: {
          added_after_submit?: boolean
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          location_ids?: string[]
          origin?: Database["public"]["Enums"]["item_origin"]
          package_id?: string
          position?: number
          publish_at?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          updated_at?: string
          updated_in_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          approval_kind: Database["public"]["Enums"]["approval_kind"] | null
          approved_at: string | null
          approved_by_contact_id: string | null
          auto_approve_at: string | null
          auto_approve_enabled: boolean
          changed_after_approval: boolean
          client_id: string
          content_folder_id: string | null
          content_folder_url: string | null
          cooperation_month: number | null
          created_at: string
          created_by: string | null
          first_opened_at: string | null
          id: string
          location_id: string | null
          period_from: string | null
          period_month: number
          period_to: string | null
          period_year: number
          round: number
          status: Database["public"]["Enums"]["package_status"]
          submitted_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approval_kind?: Database["public"]["Enums"]["approval_kind"] | null
          approved_at?: string | null
          approved_by_contact_id?: string | null
          auto_approve_at?: string | null
          auto_approve_enabled?: boolean
          changed_after_approval?: boolean
          client_id: string
          content_folder_id?: string | null
          content_folder_url?: string | null
          cooperation_month?: number | null
          created_at?: string
          created_by?: string | null
          first_opened_at?: string | null
          id?: string
          location_id?: string | null
          period_from?: string | null
          period_month: number
          period_to?: string | null
          period_year: number
          round?: number
          status?: Database["public"]["Enums"]["package_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approval_kind?: Database["public"]["Enums"]["approval_kind"] | null
          approved_at?: string | null
          approved_by_contact_id?: string | null
          auto_approve_at?: string | null
          auto_approve_enabled?: boolean
          changed_after_approval?: boolean
          client_id?: string
          content_folder_id?: string | null
          content_folder_url?: string | null
          cooperation_month?: number | null
          created_at?: string
          created_by?: string | null
          first_opened_at?: string | null
          id?: string
          location_id?: string | null
          period_from?: string | null
          period_month?: number
          period_to?: string | null
          period_year?: number
          round?: number
          status?: Database["public"]["Enums"]["package_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_approved_by_contact_id_fkey"
            columns: ["approved_by_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_started_at: string
        }
        Insert: {
          count?: number
          key: string
          window_started_at?: string
        }
        Update: {
          count?: number
          key?: string
          window_started_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          client_id: string
          cooperation_month: number | null
          id: string
          location_id: string | null
          period_month: number
          period_year: number
          published_at: string
          source: Database["public"]["Enums"]["report_source"]
          title: string
          url: string
        }
        Insert: {
          client_id: string
          cooperation_month?: number | null
          id?: string
          location_id?: string | null
          period_month: number
          period_year: number
          published_at?: string
          source?: Database["public"]["Enums"]["report_source"]
          title: string
          url: string
        }
        Update: {
          client_id?: string
          cooperation_month?: number | null
          id?: string
          location_id?: string | null
          period_month?: number
          period_year?: number
          published_at?: string
          source?: Database["public"]["Enums"]["report_source"]
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_interests: {
        Row: {
          client_id: string
          contact_id: string | null
          created_at: string
          handled_at: string | null
          id: string
          note: string | null
          service_id: string
        }
        Insert: {
          client_id: string
          contact_id?: string | null
          created_at?: string
          handled_at?: string | null
          id?: string
          note?: string | null
          service_id: string
        }
        Update: {
          client_id?: string
          contact_id?: string | null
          created_at?: string
          handled_at?: string | null
          id?: string
          note?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_interests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          body_md: string | null
          cta_label: string
          icon: string | null
          id: string
          name: string
          position: number
          short_desc: string
          slug: string
          visible_for_tiers: Database["public"]["Enums"]["package_tier"][]
        }
        Insert: {
          active?: boolean
          body_md?: string | null
          cta_label?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          short_desc: string
          slug: string
          visible_for_tiers?: Database["public"]["Enums"]["package_tier"][]
        }
        Update: {
          active?: boolean
          body_md?: string | null
          cta_label?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          short_desc?: string
          slug?: string
          visible_for_tiers?: Database["public"]["Enums"]["package_tier"][]
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      odnotuj_nieudane_logowanie: {
        Args: { p_link_id: string }
        Returns: {
          blokada_24h: boolean
          proby: number
          zablokowany_do: string
        }[]
      }
      zwieksz_limit: {
        Args: { p_key: string; p_okno_sekund: number }
        Returns: number
      }
    }
    Enums: {
      actor_kind: "klient" | "zespol" | "system"
      approval_kind: "reczna" | "automatyczna"
      asset_kind: "image" | "video"
      author_kind: "klient" | "zespol"
      campaign_goal:
        | "sprzedaz"
        | "ruch"
        | "polubienia"
        | "leady"
        | "zasieg"
        | "inne"
      client_category: "kat1" | "kat2" | "kat3"
      client_status: "aktywny" | "wstrzymany" | "zakonczony"
      document_kind: "umowa" | "aneks" | "powierzenie" | "inne"
      import_kind: "content" | "reklamy" | "dodatkowy" | "podmiana"
      import_status: "oczekuje" | "trwa" | "zakonczony" | "blad"
      invoice_status: "do_zaplaty" | "po_terminie" | "oplacona"
      item_origin: "import" | "reczny" | "dodatkowy"
      item_type: "post" | "relacja" | "reels" | "reklama"
      outbox_status: "pending" | "sent" | "failed"
      package_event_kind:
        | "utworzony"
        | "zaimportowany"
        | "wyslany"
        | "wycofany"
        | "otwarty"
        | "komentarz"
        | "poprawki"
        | "material_dodany"
        | "material_podmieniony"
        | "zaakceptowany"
        | "auto_zaakceptowany"
        | "auto_przesunieta"
        | "auto_wstrzymana"
        | "cofniety_do_poprawek"
        | "zaplanowany"
      package_status:
        | "szkic"
        | "do_akceptacji"
        | "poprawki"
        | "zaakceptowany"
        | "zaplanowany"
      package_tier: "foodie_one" | "foodie_360" | "siec"
      pin_kind: "pin4" | "pin6" | "haslo"
      report_source: "reczne" | "webhook"
      team_role: "admin" | "csm" | "content_creator" | "media_buyer" | "sales"
      variant_kind: "grafika" | "tekst" | "naglowek" | "opis" | "cta" | "link"
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
      actor_kind: ["klient", "zespol", "system"],
      approval_kind: ["reczna", "automatyczna"],
      asset_kind: ["image", "video"],
      author_kind: ["klient", "zespol"],
      campaign_goal: [
        "sprzedaz",
        "ruch",
        "polubienia",
        "leady",
        "zasieg",
        "inne",
      ],
      client_category: ["kat1", "kat2", "kat3"],
      client_status: ["aktywny", "wstrzymany", "zakonczony"],
      document_kind: ["umowa", "aneks", "powierzenie", "inne"],
      import_kind: ["content", "reklamy", "dodatkowy", "podmiana"],
      import_status: ["oczekuje", "trwa", "zakonczony", "blad"],
      invoice_status: ["do_zaplaty", "po_terminie", "oplacona"],
      item_origin: ["import", "reczny", "dodatkowy"],
      item_type: ["post", "relacja", "reels", "reklama"],
      outbox_status: ["pending", "sent", "failed"],
      package_event_kind: [
        "utworzony",
        "zaimportowany",
        "wyslany",
        "wycofany",
        "otwarty",
        "komentarz",
        "poprawki",
        "material_dodany",
        "material_podmieniony",
        "zaakceptowany",
        "auto_zaakceptowany",
        "auto_przesunieta",
        "auto_wstrzymana",
        "cofniety_do_poprawek",
        "zaplanowany",
      ],
      package_status: [
        "szkic",
        "do_akceptacji",
        "poprawki",
        "zaakceptowany",
        "zaplanowany",
      ],
      package_tier: ["foodie_one", "foodie_360", "siec"],
      pin_kind: ["pin4", "pin6", "haslo"],
      report_source: ["reczne", "webhook"],
      team_role: ["admin", "csm", "content_creator", "media_buyer", "sales"],
      variant_kind: ["grafika", "tekst", "naglowek", "opis", "cta", "link"],
    },
  },
} as const

