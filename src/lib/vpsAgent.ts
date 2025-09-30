import { supabase } from '@/integrations/supabase/client';

interface VpsAgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, any>;
}

interface CaddyHost {
  hostname: string;
  upstream?: string;
  configured: boolean;
}

class VpsAgentError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'VpsAgentError';
  }
}

export class VpsAgentClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;

  constructor(baseUrl: string, token: string, timeout = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
    this.timeout = timeout;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<VpsAgentResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`[VpsAgent] Making request to: ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`[VpsAgent] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[VpsAgent] HTTP Error ${response.status}: ${errorText}`);
        
        throw new VpsAgentError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status,
          { url, errorText }
        );
      }

      const data = await response.json();
      console.log(`[VpsAgent] Success response:`, data);
      
      return {
        success: true,
        data,
        details: { url, status: response.status }
      };

    } catch (error) {
      console.error(`[VpsAgent] Request failed:`, error);

      if (error instanceof VpsAgentError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new VpsAgentError(
          'Request timeout - VPS agent não respondeu',
          'TIMEOUT',
          408,
          { url, timeout: this.timeout }
        );
      }

      throw new VpsAgentError(
        `Falha na comunicação com VPS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        0,
        { url, originalError: error }
      );
    }
  }

  async healthCheck(): Promise<VpsAgentResponse<{ status: string; uptime?: number }>> {
    return this.makeRequest('/status');
  }

  async getCaddyHosts(): Promise<VpsAgentResponse<CaddyHost[]>> {
    return this.makeRequest('/caddy/hosts');
  }

  async syncCaddyHosts(hosts: string[]): Promise<VpsAgentResponse<{ updated: string[]; errors: string[] }>> {
    return this.makeRequest('/caddy/sync', {
      method: 'POST',
      body: JSON.stringify({ hosts }),
    });
  }

  async restartServices(services: string[] = ['caddy']): Promise<VpsAgentResponse<{ restarted: string[]; errors: string[] }>> {
    return this.makeRequest('/services/restart', {
      method: 'POST',
      body: JSON.stringify({ services }),
    });
  }

  async getCaddyConfig(): Promise<VpsAgentResponse<{ config: string; valid: boolean }>> {
    return this.makeRequest('/caddy/config');
  }

  async updateCaddyConfig(config: string): Promise<VpsAgentResponse<{ updated: boolean }>> {
    return this.makeRequest('/caddy/config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }
}

// Singleton instances for each VPS
const vpsClients = new Map<string, VpsAgentClient>();

export async function getVpsAgentClient(vpsId: string): Promise<VpsAgentClient> {
  if (vpsClients.has(vpsId)) {
    return vpsClients.get(vpsId)!;
  }

  console.log(`[VpsAgent] Creating new client for VPS: ${vpsId}`);

  // Get VPS details from database
  const { data: vps, error } = await supabase
    .from('vps_servers')
    .select('ipv4, agent_url')
    .eq('id', vpsId)
    .single();

  if (error || !vps) {
    console.error(`[VpsAgent] Failed to get VPS details:`, error);
    throw new VpsAgentError(
      `VPS não encontrada: ${vpsId}`,
      'VPS_NOT_FOUND',
      404,
      { vpsId, error }
    );
  }

  const baseUrl = vps.agent_url || `http://${vps.ipv4}:8888`;
  const token = import.meta.env.VITE_VPS_AGENT_TOKEN || '3db4fe2fb1d43942ae895f927efef38d2bbc19aec275c2138cb1765a692c3cd5';

  const client = new VpsAgentClient(baseUrl, token);
  vpsClients.set(vpsId, client);

  return client;
}

export { VpsAgentError };