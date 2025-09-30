import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cloudflare configuration
const CF_API = "https://api.cloudflare.com/client/v4";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
const AGENT_CALL_TOKEN = Deno.env.get("VPS_AGENT_TOKEN")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cfHeaders = {
  "Authorization": `Bearer ${CF_TOKEN}`,
  "Content-Type": "application/json",
};

interface DomainHealth {
  dnsOk: boolean;
  tunnelOk?: boolean;
  agentOk?: boolean;
  details?: Record<string, any>;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const domainId = url.searchParams.get("id");
    
    if (!domainId) {
      return jsonResponse({ error: "Missing domain id parameter" }, 400);
    }

    // Fetch domain with related tunnel and VPS data
    const { data: domains, error: domainError } = await supabase
      .from('domains')
      .select(`
        *,
        tunnel:tunnels!inner(tunnel_id),
        vps:vps_servers(id, name, ssh_host)
      `)
      .eq('id', domainId);

    if (domainError) {
      console.error('Database error:', domainError);
      return jsonResponse({ error: "Database error" }, 500);
    }

    if (!domains || domains.length === 0) {
      return jsonResponse({ error: "Domain not found" }, 404);
    }

    const domain = domains[0];
    console.log(`Checking health for domain: ${domain.hostname}`);

    let dnsOk = false;
    let tunnelOk = false;
    let agentOk = false;
    let details: Record<string, any> = {};

    // Only check DNS and tunnel if domain uses tunnel strategy
    if (domain.publish_strategy === 'tunnel' && domain.tunnel?.tunnel_id) {
      try {
        // Check DNS - verify CNAME record points to correct tunnel
        const dnsResponse = await fetch(
          `${CF_API}/zones/${domain.hostname.split('.').slice(-2).join('.')}/dns_records?type=CNAME&name=${domain.hostname}`,
          { headers: cfHeaders }
        );

        if (dnsResponse.ok) {
          const dnsData = await dnsResponse.json();
          const record = dnsData.result?.[0];
          const expectedContent = `${domain.tunnel.tunnel_id}.cfargotunnel.com`;
          
          if (record) {
            dnsOk = record.content?.toLowerCase() === expectedContent.toLowerCase() && record.proxied === true;
            details.dnsRecord = {
              content: record.content,
              expected: expectedContent,
              proxied: record.proxied
            };
          }
        }
      } catch (error) {
        console.error('DNS check failed:', error);
        details.dnsError = error instanceof Error ? error.message : 'Unknown DNS error';
      }

      try {
        // Check tunnel status - verify it has active connections
        const tunnelResponse = await fetch(
          `${CF_API}/accounts/${Deno.env.get('CLOUDFLARE_ACCOUNT_ID')}/cfd_tunnel/${domain.tunnel.tunnel_id}`,
          { headers: cfHeaders }
        );

        if (tunnelResponse.ok) {
          const tunnelData = await tunnelResponse.json();
          const connections = tunnelData.result?.connections || [];
          tunnelOk = Array.isArray(connections) && connections.length > 0;
          details.tunnelConnections = connections.length;
        }
      } catch (error) {
        console.error('Tunnel check failed:', error);
        details.tunnelError = error instanceof Error ? error.message : 'Unknown tunnel error';
      }
    }

    // Check VPS agent if VPS is assigned
    if (domain.vps?.ssh_host) {
      try {
        const agentUrl = `http://${domain.vps.ssh_host}:8080/status`;
        const agentResponse = await fetch(agentUrl, {
          headers: { Authorization: `Bearer ${AGENT_CALL_TOKEN}` },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        agentOk = agentResponse.ok;
        details.agentStatus = agentResponse.status;
      } catch (error) {
        console.error('Agent check failed:', error);
        details.agentError = error instanceof Error ? error.message : 'Unknown agent error';
      }
    }

    // For DNS strategy, only check DNS
    if (domain.publish_strategy === 'dns') {
      // For DNS strategy, we consider it OK if the domain exists
      // You could add more sophisticated DNS checking here
      dnsOk = true;
    }

    const healthResult: DomainHealth = {
      dnsOk,
      tunnelOk: domain.publish_strategy === 'tunnel' ? tunnelOk : undefined,
      agentOk: domain.vps ? agentOk : undefined,
      details
    };

    console.log(`Health check result for ${domain.hostname}:`, healthResult);

    return jsonResponse(healthResult);

  } catch (error) {
    console.error('Health check error:', error);
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});