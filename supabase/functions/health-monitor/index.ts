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

interface HealthCheckResult {
  url: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

async function performHealthCheck(url: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'RotaDominios-HealthChecker/1.0',
      }
    });
    
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    
    return {
      url,
      statusCode: response.status,
      latencyMs,
      success: response.ok
    };
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      url,
      statusCode: 0,
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkAllDomains() {
  console.log('Starting health check for all domains...');
  
  // Get all active domains
  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select(`
      id,
      hostname,
      vps_id,
      status,
      publish_strategy
    `)
    .eq('active', true);

  if (domainsError) {
    throw new Error(`Failed to fetch domains: ${domainsError.message}`);
  }

  const results = [];
  
  for (const domain of domains) {
    const url = `https://${domain.hostname}`;
    console.log(`Checking health for: ${url}`);
    
    const result = await performHealthCheck(url);
    
    // Insert health check record
    const { error: insertError } = await supabase
      .from('health_checks')
      .insert({
        domain_id: domain.id,
        vps_id: domain.vps_id,
        url: result.url,
        status_code: result.statusCode || null,
        latency_ms: result.latencyMs,
        checked_at: new Date().toISOString()
      });

    if (insertError) {
      console.error(`Failed to insert health check for ${domain.hostname}:`, insertError);
    }

    // Update domain status if there's an issue
    if (!result.success && domain.status !== 'error') {
      const { error: updateError } = await supabase
        .from('domains')
        .update({
          status: 'error',
          error_message: result.error || `HTTP ${result.statusCode}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', domain.id);

      if (updateError) {
        console.error(`Failed to update domain status for ${domain.hostname}:`, updateError);
      }
    } else if (result.success && domain.status === 'error') {
      // Domain is back online, update status
      const { error: updateError } = await supabase
        .from('domains')
        .update({
          status: 'live',
          error_message: null,
          last_check_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', domain.id);

      if (updateError) {
        console.error(`Failed to update domain status for ${domain.hostname}:`, updateError);
      }
    }

    results.push({
      domain: domain.hostname,
      ...result
    });
  }
  
  console.log(`Health check completed for ${results.length} domains`);
  return results;
}

async function checkSpecificDomain(domainId: string) {
  console.log(`Starting health check for domain: ${domainId}`);
  
  // Get domain details
  const { data: domain, error: domainError } = await supabase
    .from('domains')
    .select(`
      id,
      hostname,
      vps_id,
      status
    `)
    .eq('id', domainId)
    .single();

  if (domainError || !domain) {
    throw new Error(`Domain not found: ${domainError?.message}`);
  }

  const url = `https://${domain.hostname}`;
  const result = await performHealthCheck(url);
  
  // Insert health check record
  const { error: insertError } = await supabase
    .from('health_checks')
    .insert({
      domain_id: domain.id,
      vps_id: domain.vps_id,
      url: result.url,
      status_code: result.statusCode || null,
      latency_ms: result.latencyMs,
      checked_at: new Date().toISOString()
    });

  if (insertError) {
    console.error(`Failed to insert health check:`, insertError);
  }

  return {
    domain: domain.hostname,
    ...result
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, domainId } = body;

    let result;
    
    switch (action) {
      case 'check_all':
        result = await checkAllDomains();
        break;
        
      case 'check_domain':
        if (!domainId) {
          throw new Error('Domain ID is required for check_domain action');
        }
        result = await checkSpecificDomain(domainId);
        break;
        
      default:
        // Default to checking all domains
        result = await checkAllDomains();
        break;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in health-monitor function:', error);
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