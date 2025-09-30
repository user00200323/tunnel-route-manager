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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deploys: {
        Row: {
          commit_hash: string | null
          created_at: string | null
          domain_id: string | null
          id: string
          logs: string | null
          status: Database["public"]["Enums"]["deploy_status"] | null
          tenant_id: string | null
          updated_at: string | null
          vps_id: string | null
        }
        Insert: {
          commit_hash?: string | null
          created_at?: string | null
          domain_id?: string | null
          id?: string
          logs?: string | null
          status?: Database["public"]["Enums"]["deploy_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          vps_id?: string | null
        }
        Update: {
          commit_hash?: string | null
          created_at?: string | null
          domain_id?: string | null
          id?: string
          logs?: string | null
          status?: Database["public"]["Enums"]["deploy_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deploys_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deploys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deploys_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      dns_records: {
        Row: {
          content: string
          created_at: string
          domain_id: string
          id: string
          name: string
          provider_ref: string | null
          proxied: boolean | null
          ttl: number | null
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          domain_id: string
          id?: string
          name: string
          provider_ref?: string | null
          proxied?: boolean | null
          ttl?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          domain_id?: string
          id?: string
          name?: string
          provider_ref?: string | null
          proxied?: boolean | null
          ttl?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dns_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          active: boolean | null
          created_at: string | null
          error_message: string | null
          fqdn: string
          hostname: string
          id: string
          last_check_at: string | null
          publish_strategy:
            | Database["public"]["Enums"]["publish_strategy"]
            | null
          status: Database["public"]["Enums"]["domain_status"] | null
          tenant_id: string | null
          tunnel_id: string | null
          type: Database["public"]["Enums"]["domain_type"] | null
          updated_at: string | null
          vps_id: string | null
          www_alias: boolean | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          error_message?: string | null
          fqdn: string
          hostname: string
          id?: string
          last_check_at?: string | null
          publish_strategy?:
            | Database["public"]["Enums"]["publish_strategy"]
            | null
          status?: Database["public"]["Enums"]["domain_status"] | null
          tenant_id?: string | null
          tunnel_id?: string | null
          type?: Database["public"]["Enums"]["domain_type"] | null
          updated_at?: string | null
          vps_id?: string | null
          www_alias?: boolean | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          error_message?: string | null
          fqdn?: string
          hostname?: string
          id?: string
          last_check_at?: string | null
          publish_strategy?:
            | Database["public"]["Enums"]["publish_strategy"]
            | null
          status?: Database["public"]["Enums"]["domain_status"] | null
          tenant_id?: string | null
          tunnel_id?: string | null
          type?: Database["public"]["Enums"]["domain_type"] | null
          updated_at?: string | null
          vps_id?: string | null
          www_alias?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_tunnel_id_fkey"
            columns: ["tunnel_id"]
            isOneToOne: false
            referencedRelation: "tunnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          checked_at: string | null
          domain_id: string | null
          id: string
          latency_ms: number | null
          status_code: number | null
          url: string
          vps_id: string | null
        }
        Insert: {
          checked_at?: string | null
          domain_id?: string | null
          id?: string
          latency_ms?: number | null
          status_code?: number | null
          url: string
          vps_id?: string | null
        }
        Update: {
          checked_at?: string | null
          domain_id?: string | null
          id?: string
          latency_ms?: number | null
          status_code?: number | null
          url?: string
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_checks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_checks_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tunnels: {
        Row: {
          created_at: string | null
          id: string
          last_seen_at: string | null
          name: string
          provider: string | null
          status: Database["public"]["Enums"]["tunnel_status"] | null
          tunnel_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          provider?: string | null
          status?: Database["public"]["Enums"]["tunnel_status"] | null
          tunnel_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          provider?: string | null
          status?: Database["public"]["Enums"]["tunnel_status"] | null
          tunnel_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vps_servers: {
        Row: {
          created_at: string | null
          health: Database["public"]["Enums"]["health_status"] | null
          id: string
          ipv4: unknown | null
          ipv6: unknown | null
          last_seen_at: string | null
          name: string
          notes: string | null
          provider: Database["public"]["Enums"]["vps_provider"] | null
          region: string | null
          ssh_host: unknown | null
          ssh_user: string | null
          tunnel_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          health?: Database["public"]["Enums"]["health_status"] | null
          id?: string
          ipv4?: unknown | null
          ipv6?: unknown | null
          last_seen_at?: string | null
          name: string
          notes?: string | null
          provider?: Database["public"]["Enums"]["vps_provider"] | null
          region?: string | null
          ssh_host?: unknown | null
          ssh_user?: string | null
          tunnel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          health?: Database["public"]["Enums"]["health_status"] | null
          id?: string
          ipv4?: unknown | null
          ipv6?: unknown | null
          last_seen_at?: string | null
          name?: string
          notes?: string | null
          provider?: Database["public"]["Enums"]["vps_provider"] | null
          region?: string | null
          ssh_host?: unknown | null
          ssh_user?: string | null
          tunnel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_domain_health_summary: {
        Args: { domain_uuid: string }
        Returns: {
          avg_latency_24h: number
          latest_check: string
          latest_latency_ms: number
          latest_status_code: number
          uptime_percentage_24h: number
        }[]
      }
    }
    Enums: {
      deploy_status: "pending" | "running" | "success" | "failed"
      domain_status: "pending" | "propagating" | "live" | "error"
      domain_type: "apex" | "www" | "custom"
      health_status: "healthy" | "degraded" | "down" | "unknown"
      publish_strategy: "dns" | "tunnel"
      tunnel_status: "connected" | "disconnected" | "error"
      vps_provider: "digitalocean" | "aws" | "linode" | "vultr" | "other"
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
      deploy_status: ["pending", "running", "success", "failed"],
      domain_status: ["pending", "propagating", "live", "error"],
      domain_type: ["apex", "www", "custom"],
      health_status: ["healthy", "degraded", "down", "unknown"],
      publish_strategy: ["dns", "tunnel"],
      tunnel_status: ["connected", "disconnected", "error"],
      vps_provider: ["digitalocean", "aws", "linode", "vultr", "other"],
    },
  },
} as const
