import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDomainHealth(domain: string): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  statusCode?: number;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Try HTTPS first, then HTTP
    const urls = [
      `https://${domain}/health`,
      `https://${domain}/.well-known/health`,
      `https://${domain}/`,
      `http://${domain}/health`,
      `http://${domain}/.well-known/health`,
      `http://${domain}/`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          return {
            status: 'healthy',
            statusCode: response.status,
            latency
          };
        } else if (response.status < 500) {
          return {
            status: 'degraded',
            statusCode: response.status,
            latency
          };
        }
      } catch (error) {
        // Continue to next URL
        console.log(`Failed to check ${url}:`, (error as Error).message);
      }
    }

    const latency = Date.now() - startTime;
    return {
      status: 'down',
      latency,
      error: 'All health check URLs failed'
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'down',
      latency,
      error: (error as Error).message
    };
  }
}

async function checkVpsHealth(vps: any): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    if (!vps.ipv4) {
      return {
        status: 'down',
        latency: 0,
        error: 'No IP address configured'
      };
    }

    // Try to ping the VPS health endpoints
    const urls = [
      `http://${vps.ipv4}/health`,
      `http://${vps.ipv4}/.well-known/health`,
      `http://${vps.ipv4}:80/health`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000), // 5 second timeout for direct VPS
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          return {
            status: 'healthy',
            latency
          };
        }
      } catch (error) {
        console.log(`Failed to check VPS ${url}:`, (error as Error).message);
      }
    }

    const latency = Date.now() - startTime;
    return {
      status: 'down',
      latency,
      error: 'VPS health endpoints not responding'
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'down',
      latency,
      error: (error as Error).message
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, targetId, hostname } = await req.json();
    
    console.log(`Health check requested for ${type}: ${targetId || hostname}`);

    if (type === 'domain') {
      let domain;
      let domainId;

      if (targetId) {
        // Health check by domain ID
        const { data, error } = await supabase
          .from('domains')
          .select('*')
          .eq('id', targetId)
          .single();

        if (error || !data) {
          throw new Error(`Domain not found: ${error?.message}`);
        }
        
        domain = data;
        domainId = data.id;
      } else if (hostname) {
        // Health check by hostname
        const { data, error } = await supabase
          .from('domains')
          .select('*')
          .eq('hostname', hostname)
          .single();

        if (error || !data) {
          throw new Error(`Domain not found: ${error?.message}`);
        }
        
        domain = data;
        domainId = data.id;
      } else {
        throw new Error('Either targetId or hostname must be provided');
      }

      const healthResult = await checkDomainHealth(domain.hostname);

      // Save health check result
      await supabase
        .from('health_checks')
        .insert({
          domain_id: domainId,
          url: `https://${domain.hostname}`,
          status_code: healthResult.statusCode,
          latency_ms: healthResult.latency,
          checked_at: new Date().toISOString()
        });

      // Update domain status based on health
      let newStatus = domain.status;
      if (healthResult.status === 'healthy' && domain.status === 'propagating') {
        newStatus = 'live';
      } else if (healthResult.status === 'down') {
        newStatus = 'error';
      }

      await supabase
        .from('domains')
        .update({ 
          status: newStatus,
          last_check_at: new Date().toISOString(),
          error_message: healthResult.error || null
        })
        .eq('id', domainId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          result: healthResult,
          domain: domain.hostname
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } else if (type === 'vps') {
      // Health check for VPS
      const { data: vps, error: vpsError } = await supabase
        .from('vps_servers')
        .select('*')
        .eq('id', targetId)
        .single();

      if (vpsError || !vps) {
        throw new Error(`VPS not found: ${vpsError?.message}`);
      }

      const healthResult = await checkVpsHealth(vps);

      // Save health check result
      await supabase
        .from('health_checks')
        .insert({
          vps_id: targetId,
          url: `http://${vps.ipv4}`,
          status_code: healthResult.status === 'healthy' ? 200 : 0,
          latency_ms: healthResult.latency,
          checked_at: new Date().toISOString()
        });

      // Update VPS health status
      await supabase
        .from('vps_servers')
        .update({ 
          health: healthResult.status,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', targetId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          result: healthResult,
          vps: vps.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } else if (type === 'all') {
      // Health check all domains and VPS
      const results: {
        domains: Array<{ hostname: string; status: string; latency: number }>;
        vps: Array<{ name: string; status: string; latency: number }>;
      } = {
        domains: [],
        vps: []
      };

      // Check all domains
      const { data: domains } = await supabase
        .from('domains')
        .select('*')
        .eq('active', true);

      for (const domain of domains || []) {
        const healthResult = await checkDomainHealth(domain.hostname);
        
        await supabase
          .from('health_checks')
          .insert({
            domain_id: domain.id,
            url: `https://${domain.hostname}`,
            status_code: healthResult.statusCode,
            latency_ms: healthResult.latency,
            checked_at: new Date().toISOString()
          });

        let newStatus = domain.status;
        if (healthResult.status === 'healthy' && domain.status === 'propagating') {
          newStatus = 'live';
        } else if (healthResult.status === 'down') {
          newStatus = 'error';
        }

        await supabase
          .from('domains')
          .update({ 
            status: newStatus,
            last_check_at: new Date().toISOString(),
            error_message: healthResult.error || null
          })
          .eq('id', domain.id);

        results.domains.push({
          hostname: domain.hostname,
          status: healthResult.status,
          latency: healthResult.latency
        });
      }

      // Check all VPS
      const { data: vpsServers } = await supabase
        .from('vps_servers')
        .select('*');

      for (const vps of vpsServers || []) {
        const healthResult = await checkVpsHealth(vps);
        
        await supabase
          .from('health_checks')
          .insert({
            vps_id: vps.id,
            url: `http://${vps.ipv4}`,
            status_code: healthResult.status === 'healthy' ? 200 : 0,
            latency_ms: healthResult.latency,
            checked_at: new Date().toISOString()
          });

        await supabase
          .from('vps_servers')
          .update({ 
            health: healthResult.status,
            last_seen_at: new Date().toISOString()
          })
          .eq('id', vps.id);

        results.vps.push({
          name: vps.name,
          status: healthResult.status,
          latency: healthResult.latency
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          results
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    throw new Error('Invalid health check type');

  } catch (error) {
    console.error('Error in health-check function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});