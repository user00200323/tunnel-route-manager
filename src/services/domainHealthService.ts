import { supabase } from '@/integrations/supabase/client';

interface DomainHealth {
  dnsOk: boolean;
  tunnelOk?: boolean;
  agentOk?: boolean;
  cnameOk?: boolean;
  details?: Record<string, any>;
}

interface HealthCheckOptions {
  retries?: number;
  timeout?: number;
  useCache?: boolean;
}

class DomainHealthService {
  private cache = new Map<string, { data: DomainHealth; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  async checkDomainHealth(
    domainId: string, 
    options: HealthCheckOptions = {}
  ): Promise<DomainHealth> {
    const { retries = 2, timeout = 10000, useCache = true } = options;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(domainId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`[HealthService] Using cached health data for domain: ${domainId}`);
        return cached.data;
      }
    }

    console.log(`[HealthService] Checking health for domain: ${domainId}`);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('domain-health', {
          body: { id: domainId }
        });

        if (error) {
          throw new Error(`Health check failed: ${error.message || 'Unknown error'}`);
        }

        const healthData = data as DomainHealth;
        
        // Cache the result
        if (useCache) {
          this.cache.set(domainId, {
            data: healthData,
            timestamp: Date.now()
          });
        }

        console.log(`[HealthService] Health check completed for domain: ${domainId}`, healthData);
        return healthData;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[HealthService] Health check attempt ${attempt + 1} failed:`, lastError);

        if (attempt < retries) {
          const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
          console.log(`[HealthService] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Health check failed after all retries');
  }

  async checkMultipleDomains(
    domainIds: string[], 
    options: HealthCheckOptions = {}
  ): Promise<Record<string, DomainHealth | Error>> {
    console.log(`[HealthService] Checking health for ${domainIds.length} domains`);

    const results: Record<string, DomainHealth | Error> = {};
    
    // Process in parallel but with some rate limiting
    const batchSize = 3;
    for (let i = 0; i < domainIds.length; i += batchSize) {
      const batch = domainIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (domainId) => {
        try {
          const health = await this.checkDomainHealth(domainId, options);
          results[domainId] = health;
        } catch (error) {
          results[domainId] = error instanceof Error ? error : new Error('Unknown error');
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < domainIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  clearCache(domainId?: string) {
    if (domainId) {
      this.cache.delete(domainId);
      console.log(`[HealthService] Cleared cache for domain: ${domainId}`);
    } else {
      this.cache.clear();
      console.log(`[HealthService] Cleared all health cache`);
    }
  }

  getCacheStats() {
    const now = Date.now();
    const valid = Array.from(this.cache.values()).filter(
      entry => now - entry.timestamp < this.CACHE_TTL
    ).length;

    return {
      total: this.cache.size,
      valid,
      expired: this.cache.size - valid
    };
  }

  async refreshDomainHealth(domainId: string): Promise<DomainHealth> {
    this.clearCache(domainId);
    return this.checkDomainHealth(domainId, { useCache: false });
  }
}

// Export a singleton instance
export const domainHealthService = new DomainHealthService();
export type { DomainHealth, HealthCheckOptions };