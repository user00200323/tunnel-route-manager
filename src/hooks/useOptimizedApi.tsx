import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ApiCache {
  [key: string]: {
    data: any;
    timestamp: number;
    ttl: number;
  };
}

const cache: ApiCache = {};
const CACHE_TTL = {
  domains: 30000, // 30 seconds for domain list
  vps: 60000, // 1 minute for VPS list
  health: 15000, // 15 seconds for health checks
};

export function useOptimizedApi() {
  const api = useMemo(() => ({
    // Cached domain fetcher
    fetchDomains: async () => {
      const cacheKey = 'domains_list';
      const cached = cache[cacheKey];
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }

      const { data, error } = await supabase
        .from('domains')
        .select(`
          *,
          tenant:tenants(name),
          vps:vps_servers(name),
          tunnel:tunnels(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      cache[cacheKey] = {
        data,
        timestamp: Date.now(),
        ttl: CACHE_TTL.domains
      };

      return data;
    },

    // Cached VPS fetcher
    fetchVpsServers: async () => {
      const cacheKey = 'vps_list';
      const cached = cache[cacheKey];
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }

      const { data, error } = await supabase
        .from('vps_servers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      cache[cacheKey] = {
        data,
        timestamp: Date.now(),
        ttl: CACHE_TTL.vps
      };

      return data;
    },

    // Auto-configure with intelligent retry
    autoConfigureDomain: async (domainId: string, retryCount = 0): Promise<any> => {
      try {
        const { data, error } = await supabase.functions.invoke('auto-configure-domain', {
          body: { domainId }
        });

        if (error) {
          // Retry on temporary failures
          if (retryCount < 2 && (
            error.message.includes('timeout') ||
            error.message.includes('503') ||
            error.message.includes('502')
          )) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return api.autoConfigureDomain(domainId, retryCount + 1);
          }
          throw error;
        }

        // Invalidate cache
        delete cache['domains_list'];
        
        return data;
      } catch (error) {
        console.error('Auto-configure failed:', error);
        throw error;
      }
    },

    // Clear specific cache entries
    invalidateCache: (keys: string[]) => {
      keys.forEach(key => delete cache[key]);
    },

    // Clear all cache
    clearCache: () => {
      Object.keys(cache).forEach(key => delete cache[key]);
    }

  }), []);

  return api;
}