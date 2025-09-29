import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cloudflareToken = Deno.env.get('CLOUDFLARE_API_TOKEN')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getCloudflareAccountId(): Promise<string> {
  const response = await fetch('https://api.cloudflare.com/v4/accounts', {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  
  if (!data.success || data.result.length === 0) {
    throw new Error('No Cloudflare accounts found');
  }

  return data.result[0].id;
}

async function createCloudflaredTunnel(name: string, accountId: string): Promise<{
  id: string;
  name: string;
  token: string;
}> {
  console.log(`Creating Cloudflare tunnel: ${name}`);

  // Create tunnel
  const createResponse = await fetch(
    `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        tunnel_secret: crypto.randomUUID().replace(/-/g, ''),
      }),
    }
  );

  const createData = await createResponse.json();
  
  if (!createData.success) {
    throw new Error(`Failed to create tunnel: ${JSON.stringify(createData.errors)}`);
  }

  const tunnel = createData.result;

  // Get tunnel token
  const tokenResponse = await fetch(
    `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel/${tunnel.id}/token`,
    {
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.success) {
    throw new Error(`Failed to get tunnel token: ${JSON.stringify(tokenData.errors)}`);
  }

  return {
    id: tunnel.id,
    name: tunnel.name,
    token: tokenData.result,
  };
}

async function updateTunnelConfig(tunnelId: string, accountId: string, config: any): Promise<void> {
  console.log(`Updating tunnel config for: ${tunnelId}`);

  const response = await fetch(
    `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config
      }),
    }
  );

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to update tunnel config: ${JSON.stringify(data.errors)}`);
  }
}

async function deleteTunnel(tunnelId: string, accountId: string): Promise<void> {
  console.log(`Deleting tunnel: ${tunnelId}`);

  const response = await fetch(
    `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
      },
    }
  );

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to delete tunnel: ${JSON.stringify(data.errors)}`);
  }
}

function generateTunnelConfig(tunnelId: string, domains: string[]): any {
  const ingress = [];

  // Add rules for each domain
  for (const domain of domains) {
    ingress.push({
      hostname: domain,
      service: 'http://caddy:80'
    });
    
    // Add www variant if it's an apex domain
    if (!domain.startsWith('www.')) {
      ingress.push({
        hostname: `www.${domain}`,
        service: 'http://caddy:80'
      });
    }
  }

  // Default catch-all rule (required)
  ingress.push({
    service: 'http_status:404'
  });

  return {
    tunnel: tunnelId,
    'credentials-file': '/etc/cloudflared/credentials.json',
    ingress
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tunnelId, vpsId, name, domains = [] } = await req.json();
    
    console.log(`Tunnel management action: ${action}`);

    const accountId = await getCloudflareAccountId();
    let result = {};

    switch (action) {
      case 'create':
        if (!name) {
          throw new Error('Tunnel name is required');
        }

        const newTunnel = await createCloudflaredTunnel(name, accountId);
        
        // Save tunnel to database
        const { data: savedTunnel, error: saveError } = await supabase
          .from('tunnels')
          .insert({
            tunnel_id: newTunnel.id,
            name: newTunnel.name,
            provider: 'cloudflared',
            status: 'connected',
          })
          .select()
          .single();

        if (saveError) {
          // Clean up created tunnel if database save fails
          await deleteTunnel(newTunnel.id, accountId);
          throw new Error(`Failed to save tunnel: ${saveError.message}`);
        }

        result = {
          message: 'Tunnel created successfully',
          tunnel: savedTunnel,
          token: newTunnel.token
        };
        break;

      case 'update_config':
        if (!tunnelId) {
          throw new Error('Tunnel ID is required');
        }

        // Get tunnel from database
        const { data: tunnel, error: tunnelError } = await supabase
          .from('tunnels')
          .select('*')
          .eq('tunnel_id', tunnelId)
          .single();

        if (tunnelError || !tunnel) {
          throw new Error(`Tunnel not found: ${tunnelError?.message}`);
        }

        const config = generateTunnelConfig(tunnelId, domains);
        await updateTunnelConfig(tunnelId, accountId, config);

        // Update tunnel status
        await supabase
          .from('tunnels')
          .update({ 
            status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('tunnel_id', tunnelId);

        result = {
          message: 'Tunnel configuration updated',
          config,
          domains
        };
        break;

      case 'delete':
        if (!tunnelId) {
          throw new Error('Tunnel ID is required');
        }

        // Delete from Cloudflare
        await deleteTunnel(tunnelId, accountId);

        // Delete from database
        await supabase
          .from('tunnels')
          .delete()
          .eq('tunnel_id', tunnelId);

        result = {
          message: 'Tunnel deleted successfully'
        };
        break;

      case 'get_status':
        if (!tunnelId) {
          throw new Error('Tunnel ID is required');
        }

        // Get tunnel status from Cloudflare
        const statusResponse = await fetch(
          `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
          {
            headers: {
              'Authorization': `Bearer ${cloudflareToken}`,
            },
          }
        );

        const statusData = await statusResponse.json();
        
        if (!statusData.success) {
          throw new Error(`Failed to get tunnel status: ${JSON.stringify(statusData.errors)}`);
        }

        // Update database with current status
        const tunnelStatus = statusData.result.status === 'active' ? 'connected' : 'disconnected';
        
        await supabase
          .from('tunnels')
          .update({ 
            status: tunnelStatus,
            last_seen_at: new Date().toISOString()
          })
          .eq('tunnel_id', tunnelId);

        result = {
          message: 'Tunnel status retrieved',
          status: statusData.result
        };
        break;

      case 'list':
        // List all tunnels from Cloudflare
        const listResponse = await fetch(
          `https://api.cloudflare.com/v4/accounts/${accountId}/cfd_tunnel`,
          {
            headers: {
              'Authorization': `Bearer ${cloudflareToken}`,
            },
          }
        );

        const listData = await listResponse.json();
        
        if (!listData.success) {
          throw new Error(`Failed to list tunnels: ${JSON.stringify(listData.errors)}`);
        }

        result = {
          message: 'Tunnels listed successfully',
          tunnels: listData.result
        };
        break;

      case 'assign_to_vps':
        if (!tunnelId || !vpsId) {
          throw new Error('Both tunnel ID and VPS ID are required');
        }

        // Update VPS with tunnel ID
        await supabase
          .from('vps_servers')
          .update({ tunnel_id: tunnelId })
          .eq('id', vpsId);

        result = {
          message: 'Tunnel assigned to VPS successfully'
        };
        break;

      case 'add_domain':
        if (!tunnelId || !domains || domains.length === 0) {
          throw new Error('Tunnel ID and domains are required');
        }

        // Get current tunnel configuration
        const { data: currentTunnel, error: getCurrentError } = await supabase
          .from('tunnels')
          .select('*')
          .eq('tunnel_id', tunnelId)
          .single();

        if (getCurrentError || !currentTunnel) {
          throw new Error(`Tunnel not found: ${getCurrentError?.message}`);
        }

        // Update tunnel configuration with new domains
        const addConfig = generateTunnelConfig(tunnelId, domains);
        await updateTunnelConfig(tunnelId, accountId, addConfig);

        // Update tunnel status
        await supabase
          .from('tunnels')
          .update({ 
            status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('tunnel_id', tunnelId);

        result = {
          message: 'Domain added to tunnel configuration',
          config: addConfig,
          domains
        };
        break;

      case 'remove_domain':
        if (!tunnelId) {
          throw new Error('Tunnel ID is required');
        }

        // Get all remaining domains for this tunnel (excluding the one being removed)
        const { data: remainingDomains, error: getRemainingError } = await supabase
          .from('domains')
          .select('hostname')
          .eq('tunnel_id', tunnelId)
          .eq('publish_strategy', 'tunnel');

        if (getRemainingError) {
          throw new Error(`Failed to get remaining domains: ${getRemainingError.message}`);
        }

        const remainingHostnames = remainingDomains.map(d => d.hostname);
        const removeConfig = generateTunnelConfig(tunnelId, remainingHostnames);
        await updateTunnelConfig(tunnelId, accountId, removeConfig);

        // Update tunnel status
        await supabase
          .from('tunnels')
          .update({ 
            status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('tunnel_id', tunnelId);

        result = {
          message: 'Domain removed from tunnel configuration',
          config: removeConfig,
          domains: remainingHostnames
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in tunnel-management function:', error);
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