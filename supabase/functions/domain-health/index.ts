import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cloudflare configuration
const CF_API = "https://api.cloudflare.com/client/v4";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
const AGENT_TOKEN = Deno.env.get("VPS_AGENT_TOKEN")!;

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
  cnameOk?: boolean;
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

    // Fetch domain with related tunnel data
    const { data: domains, error: domainError } = await supabase
      .from('domains')
      .select(`
        *,
        tunnel:tunnels(tunnel_id, cf_tunnel_id)
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
    let cnameOk = false;
    let details: Record<string, any> = {
      timestamp: new Date().toISOString(),
      strategy: domain.publish_strategy
    };

    // Only check DNS and tunnel if domain uses tunnel strategy
    if (domain.publish_strategy === 'tunnel' && domain.tunnel_id) {
      // Get tunnel details
      const { data: tunnelData } = await supabase
        .from('tunnels')
        .select('cf_tunnel_id')
        .eq('tunnel_id', domain.tunnel_id)
        .single();

      if (tunnelData?.cf_tunnel_id) {
        try {
          // Check CNAME record via Google DNS
          const expectedContent = `${tunnelData.cf_tunnel_id}.cfargotunnel.com`;
          const cnameResponse = await fetch(`https://dns.google/resolve?name=${domain.hostname}&type=CNAME`);
          const cnameData = await cnameResponse.json();
          
          if (cnameData.Answer) {
            cnameOk = cnameData.Answer.some((answer: any) => 
              answer.data && answer.data.includes(tunnelData.cf_tunnel_id)
            );
          }
          
          details.expectedCname = expectedContent;
          details.cnameFound = cnameData.Answer?.[0]?.data || 'None';
          
          // For now, consider DNS OK if CNAME is correct
          dnsOk = cnameOk;
        } catch (error) {
          console.error('DNS check failed:', error);
          details.dnsError = error instanceof Error ? error.message : 'Unknown DNS error';
        }

        try {
          // Check tunnel status - verify it has active connections
          const tunnelResponse = await fetch(
            `${CF_API}/accounts/${Deno.env.get('CLOUDFLARE_ACCOUNT_ID')}/cfd_tunnel/${tunnelData.cf_tunnel_id}/connections`,
            { headers: cfHeaders }
          );

          if (tunnelResponse.ok) {
            const tunnelConnData = await tunnelResponse.json();
            const connections = tunnelConnData.result || [];
            tunnelOk = Array.isArray(connections) && connections.length > 0;
            details.tunnelConnections = connections.length;
          }
        } catch (error) {
          console.error('Tunnel check failed:', error);
          details.tunnelError = error instanceof Error ? error.message : 'Unknown tunnel error';
        }
      }
    }

    // Check VPS agent if VPS is assigned
    if (domain.vps_id) {
      try {
        // Get VPS details with agent_url
        const { data: vpsData, error: vpsError } = await supabase
          .from('vps_servers')
          .select('ipv4, agent_url')
          .eq('id', domain.vps_id)
          .single();

        if (vpsData && !vpsError) {
          const agentUrl = vpsData.agent_url || `http://${vpsData.ipv4}:8888`;
          console.log(`Checking VPS agent at: ${agentUrl}`);
          
          try {
            const agentResponse = await fetch(`${agentUrl}/status`, {
              headers: { 
                'Authorization': `Bearer ${AGENT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              signal: AbortSignal.timeout(8000) // 8 second timeout
            });
            
            agentOk = agentResponse.ok;
            details.agentStatus = agentResponse.status;
            details.agentUrl = agentUrl;
            
            if (agentResponse.ok) {
              const agentData = await agentResponse.json();
              details.agentData = agentData;
              console.log(`VPS agent health: OK - ${JSON.stringify(agentData)}`);
            } else {
              const errorText = await agentResponse.text().catch(() => 'No response body');
              details.agentError = errorText;
              console.log(`VPS agent health: FAILED - Status ${agentResponse.status}: ${errorText}`);
            }
          } catch (agentError) {
            console.error(`VPS agent request failed:`, agentError);
            details.agentRequestError = agentError instanceof Error ? agentError.message : 'Unknown error';
          }
        } else {
          console.error(`Failed to get VPS data:`, vpsError);
          details.vpsDataError = vpsError?.message || 'VPS not found';
        }
      } catch (error) {
        console.error('VPS check failed:', error);
        details.vpsCheckError = error instanceof Error ? error.message : 'Unknown VPS error';
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
      agentOk: domain.vps_id ? agentOk : undefined,
      cnameOk: domain.publish_strategy === 'tunnel' ? cnameOk : undefined,
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