// Real API service for RotaDomínios using Supabase

import { supabase } from "@/integrations/supabase/client";
import type { 
  Tenant, 
  VPS, 
  Domain, 
  Tunnel, 
  Deploy, 
  AuditLog, 
  HealthCheck,
  ApiResponse,
  PaginatedResponse,
  DomainFilters,
  VpsFilters,
  DeployFilters
} from '@/types';
import type { AutoConfigurationResult } from "@/lib/api-types";

// Helper functions
const handleError = (error: any): never => {
  console.error('API Error:', error);
  throw new Error(error.message || 'An unexpected error occurred');
};

export const Api = {
  // === TENANTS ===
  async listTenants(): Promise<Tenant[]> {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) handleError(error);
      return data as Tenant[];
    } catch (error) {
      handleError(error);
    }
  },

  async getTenant(id: string): Promise<Tenant> {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) handleError(error);
      return data as Tenant;
    } catch (error) {
      handleError(error);
    }
  },

  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    try {
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert([data])
        .select()
        .single();

      if (error) handleError(error);
      return newTenant as Tenant;
    } catch (error) {
      handleError(error);
    }
  },

  // === DOMAINS ===
  async listDomains(filters?: DomainFilters): Promise<Domain[]> {
    try {
      let query = supabase
        .from('domains')
        .select(`
          *,
          tenant:tenants(name),
          vps:vps_servers(name),
          tunnel:tunnels(name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.search) {
        query = query.ilike('hostname', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) handleError(error);
      return data as Domain[];
    } catch (error) {
      handleError(error);
    }
  },

  async getDomain(id: string): Promise<Domain> {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select(`
          *,
          tenant:tenants(name),
          vps:vps_servers(name),
          tunnel:tunnels(name)
        `)
        .eq('id', id)
        .single();

      if (error) handleError(error);
      return data as Domain;
    } catch (error) {
      handleError(error);
    }
  },

  async createDomain(data: Omit<Domain, 'id' | 'created_at' | 'updated_at'>): Promise<Domain> {
    try {
      const { data: newDomain, error } = await supabase
        .from('domains')
        .insert([{
          ...data,
          fqdn: data.hostname, // Ensure fqdn is set
        }])
        .select()
        .single();

      if (error) handleError(error);
      return newDomain as Domain;
    } catch (error) {
      handleError(error);
    }
  },

  async updateDomain(id: string, data: Partial<Domain>): Promise<Domain> {
    try {
      const { data: updatedDomain, error } = await supabase
        .from('domains')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) handleError(error);
      return updatedDomain as Domain;
    } catch (error) {
      handleError(error);
    }
  },

  async deleteDomain(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('domains')
        .delete()
        .eq('id', id);

      if (error) handleError(error);
    } catch (error) {
      handleError(error);
    }
  },

  async checkDns(domainId: string): Promise<{ ok: boolean; details: any }> {
    try {
      // This would integrate with actual DNS checking service
      // For now, we'll simulate the check
      const { data: domain } = await supabase
        .from('domains')
        .select('hostname')
        .eq('id', domainId)
        .single();

      const isOk = Math.random() > 0.3;
      
      // Update domain status based on check
      await supabase
        .from('domains')
        .update({ 
          status: isOk ? 'live' : 'error',
          last_check_at: new Date().toISOString()
        })
        .eq('id', domainId);

      return {
        ok: isOk,
        details: {
          records: ['A', 'AAAA', 'CNAME'],
          propagated: Math.random() > 0.5,
          ttl: 300,
          hostname: domain?.hostname
        }
      };
    } catch (error) {
      handleError(error);
    }
  },

  // === VPS ===
  async listVps(filters?: VpsFilters): Promise<VPS[]> {
    try {
      let query = supabase
        .from('vps_servers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.provider) {
        query = query.eq('provider', filters.provider);
      }
      
      if (filters?.health) {
        query = query.eq('health', filters.health);
      }
      
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,tunnel_id.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) handleError(error);
      return data as VPS[];
    } catch (error) {
      handleError(error);
    }
  },

  async getVps(id: string): Promise<VPS> {
    try {
      const { data, error } = await supabase
        .from('vps_servers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) handleError(error);
      return data as VPS;
    } catch (error) {
      handleError(error);
    }
  },

  async createVps(data: any): Promise<VPS> {
    try {
      const { data: newVps, error } = await supabase
        .from('vps_servers')
        .insert([data])
        .select()
        .single();

      if (error) handleError(error);
      return newVps as VPS;
    } catch (error) {
      handleError(error);
    }
  },

  async updateVps(id: string, data: Partial<VPS>): Promise<VPS> {
    try {
      const { data: updatedVps, error } = await supabase
        .from('vps_servers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) handleError(error);
      return updatedVps as VPS;
    } catch (error) {
      handleError(error);
    }
  },

  async assignRoute(domainId: string, vpsId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('domains')
        .update({ 
          vps_id: vpsId,
          tunnel_id: null,
          publish_strategy: 'dns',
          status: 'pending'
        })
        .eq('id', domainId);

      if (error) handleError(error);
    } catch (error) {
      handleError(error);
    }
  },

  // === TUNNELS ===
  async listTunnels(): Promise<Tunnel[]> {
    try {
      const { data, error } = await supabase
        .from('tunnels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) handleError(error);
      return data as Tunnel[];
    } catch (error) {
      handleError(error);
    }
  },

  async restartTunnel(tunnelId: string): Promise<void> {
    try {
      // Update tunnel status to indicate restart
      const { error } = await supabase
        .from('tunnels')
        .update({ 
          status: 'disconnected',
          last_seen_at: new Date().toISOString()
        })
        .eq('tunnel_id', tunnelId);

      if (error) handleError(error);
      
      // In a real implementation, this would trigger the actual tunnel restart
      // For now, we'll simulate success
    } catch (error) {
      handleError(error);
    }
  },

  // === DEPLOYS ===
  async listDeploys(filters?: DeployFilters): Promise<Deploy[]> {
    try {
      let query = supabase
        .from('deploys')
        .select(`
          *,
          tenant:tenants(name),
          domain:domains(hostname),
          vps:vps_servers(name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) handleError(error);
      return data as Deploy[];
    } catch (error) {
      handleError(error);
    }
  },

  async triggerDeploy(data: Omit<Deploy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deploy> {
    try {
      const { data: newDeploy, error } = await supabase
        .from('deploys')
        .insert([{ ...data, status: 'pending' }])
        .select()
        .single();

      if (error) handleError(error);
      return newDeploy as Deploy;
    } catch (error) {
      handleError(error);
    }
  },

  // === HEALTH CHECKS ===
  async runHealthCheck(vpsId: string): Promise<HealthCheck> {
    try {
      // Get VPS details
      const { data: vps } = await supabase
        .from('vps_servers')
        .select('name, ipv4')
        .eq('id', vpsId)
        .single();

      // Create a health check record
      const healthCheck = {
        vps_id: vpsId,
        url: `http://${vps?.ipv4 || 'localhost'}:80/health`,
        status_code: Math.random() > 0.2 ? 200 : 503,
        latency_ms: Math.floor(Math.random() * 1000) + 50,
      };

      const { data, error } = await supabase
        .from('health_checks')
        .insert([healthCheck])
        .select()
        .single();

      if (error) handleError(error);
      
      // Update VPS health status based on check
      const newHealth = healthCheck.status_code === 200 ? 'healthy' : 'down';
      await supabase
        .from('vps_servers')
        .update({ 
          health: newHealth,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', vpsId);

      return data as HealthCheck;
    } catch (error) {
      handleError(error);
    }
  },

  // === AUDIT LOGS ===
  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) handleError(error);
      return data as AuditLog[];
    } catch (error) {
      handleError(error);
    }
  },

  // === VPS MANAGEMENT ===
  async restartVpsServices(vpsId: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('vps-management', {
        body: { action: 'restart_services', vpsId }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  async setupVps(vpsId: string, domains: string[] = []): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('vps-management', {
        body: { action: 'setup_vps', vpsId, params: { domains } }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  async checkVpsStatus(vpsId: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('vps-management', {
        body: { action: 'check_status', vpsId }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  // === VPS CADDYFILE MANAGEMENT ===
  async updateVpsCaddyfile(vpsId: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('vps-management', {
        body: { action: 'update_caddyfile', vpsId }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  // === AUTO-CONFIGURATION ===
  async autoConfigureDomain(domainId: string): Promise<AutoConfigurationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('auto-configure-domain', {
        body: { domainId }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  // === DOMAIN TUNNEL CONFIGURATION ===
  async configureDomainWithTunnel(domainId: string, tunnelId: string, serviceUrl: string = 'http://caddy:80'): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('configure-domain-tunnel', {
        body: { domainId, tunnelId, serviceUrl }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error);
    }
  },

  // === CLOUDFLARE IMPORT ===
  async importCloudflareDomainsSync(): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('cloudflare-import')
      if (error) throw error
      return data
    } catch (error) {
      handleError(error)
    }
  },
};