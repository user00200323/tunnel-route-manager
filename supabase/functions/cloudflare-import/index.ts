import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cloudflareToken = Deno.env.get('CLOUDFLARE_API_TOKEN')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Utils function for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  return dp[m][n];
}

interface CloudflareZone {
  id: string
  name: string
  status: string
  account: {
    id: string
    name: string
  }
  created_on: string
  modified_on: string
}

interface CloudflareTunnel {
  id: string
  name: string
  created_at: string
  conns: Array<{
    colo_name: string
    uuid: string
    is_pending_reconnect: boolean
  }>
  connections?: Array<any>
}

async function getCloudflareZones(): Promise<CloudflareZone[]> {
  console.log('Fetching zones from Cloudflare...')
  
  if (!cloudflareToken) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured')
  }
  
  const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Cloudflare API error:', response.status, errorText)
    
    if (response.status === 403) {
      throw new Error('Cloudflare API token lacks required permissions. Please ensure your token has Zone.Zone:Read and Zone.DNS:Read permissions.')
    } else if (response.status === 401) {
      throw new Error('Invalid Cloudflare API token. Please check your token is correct.')
    } else {
      throw new Error(`Cloudflare API error: ${response.status} ${errorText}`)
    }
  }

  const data = await response.json()
  
  if (!data.success) {
    const errors = data.errors?.map((e: any) => e.message).join(', ') || 'Unknown error'
    console.error('Cloudflare API returned errors:', errors)
    throw new Error(`Cloudflare API errors: ${errors}`)
  }
  
  console.log(`Found ${data.result?.length || 0} zones`)
  return data.result || []
}

async function getCloudflareTunnels(): Promise<CloudflareTunnel[]> {
  console.log('Fetching tunnels from Cloudflare...')
  
  // First get account ID
  const accountResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!accountResponse.ok) {
    console.error('Failed to get account info')
    return []
  }

  const accountData = await accountResponse.json()
  if (!accountData.success || !accountData.result?.length) {
    console.error('No accounts found')
    return []
  }

  const accountId = accountData.result[0].id
  
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error('Failed to fetch tunnels:', response.status)
    return []
  }

  const data = await response.json()
  
  if (!data.success) {
    console.error('Cloudflare tunnels API returned errors:', data.errors)
    return []
  }
  
  console.log(`Found ${data.result?.length || 0} tunnels`)
  return data.result || []
}

function determineTunnelStatus(tunnel: CloudflareTunnel): 'connected' | 'disconnected' {
  // Check different possible connection fields
  if (tunnel.conns && tunnel.conns.length > 0) {
    return 'connected';
  }
  if (tunnel.connections && tunnel.connections.length > 0) {
    return 'connected';
  }
  // Fallback for recently created tunnels
  const createdAt = new Date(tunnel.created_at);
  const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreated < 24) {
    return 'connected'; // Assume recently created tunnels are likely connected
  }
  return 'disconnected';
}

async function importTunnelsToDatabase(tunnels: CloudflareTunnel[]) {
  console.log(`Importing ${tunnels.length} tunnels to database...`);
  
  const tunnelData = tunnels.map(tunnel => ({
    cf_tunnel_id: tunnel.id, // Use cf_tunnel_id for Cloudflare ID
    name: tunnel.name,
    provider: 'cloudflared',
    status: determineTunnelStatus(tunnel),
    last_seen_at: tunnel.conns && tunnel.conns.length > 0 
      ? new Date().toISOString() 
      : tunnel.created_at ? new Date(tunnel.created_at) : null,
    created_at: tunnel.created_at ? new Date(tunnel.created_at) : new Date(),
    updated_at: new Date()
  }));

  // Use upsert to handle existing tunnels
  const { data, error } = await supabase
    .from('tunnels')
    .upsert(tunnelData, { 
      onConflict: 'cf_tunnel_id',
      ignoreDuplicates: false 
    })
    .select('id, name, cf_tunnel_id');

  if (error) {
    console.error('Error importing tunnels:', error);
    throw error;
  }

  console.log(`Successfully imported ${data?.length || 0} tunnels`);
  return data || [];
}

async function importZonesToDatabase(zones: CloudflareZone[], nameToDbId: Map<string, string>, cfIdToDbId: Map<string, string>) {
  console.log(`Processing ${zones.length} zones for domain import...`);

  // Ensure default tenant exists
  let { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', 'Default Tenant')
    .maybeSingle();

  if (!tenant) {
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: 'Default Tenant' })
      .select('id')
      .single();
    
    if (tenantError) {
      console.error('Error creating default tenant:', tenantError);
      throw tenantError;
    }
    tenant = newTenant;
  }

  // Ensure default VPS exists
  let { data: vps } = await supabase
    .from('vps_servers')
    .select('id')
    .eq('name', 'Default VPS')
    .maybeSingle();

  if (!vps) {
    const { data: newVps, error: vpsError } = await supabase
      .from('vps_servers')
      .insert({ 
        name: 'Default VPS',
        provider: 'other',
        health: 'unknown'
      })
      .select('id')
      .single();
    
    if (vpsError) {
      console.error('Error creating default VPS:', vpsError);
      throw vpsError;
    }
    vps = newVps;
  }

  let importedDomains = 0;
  let tunnelDomains = 0;
  let dnsDomains = 0;

  for (const zone of zones) {
    try {
      // Get DNS records for this zone
      const dnsRecords = await getZoneDnsRecords(zone.id);
      
      for (const record of dnsRecords) {
        if (record.type !== 'CNAME') continue;
        
        const hostname = record.name;
        
        // Extract cf_tunnel_id from CNAME content (*.cfargotunnel.com)
        const cfTunnelMatch = /^([0-9a-f-]{36})\.cfargotunnel\.com\.?$/i.exec(record.content || "");
        const cfTunnelId = cfTunnelMatch?.[1] || null;
        const localTunnelUuid = cfTunnelId ? cfIdToDbId.get(cfTunnelId) ?? null : null;

        const publish_strategy = localTunnelUuid ? 'tunnel' : 'dns';
        
        // Create domain entry
        const domainData = {
          hostname,
          fqdn: hostname,
          type: 'apex' as const,
          tenant_id: tenant.id,
          publish_strategy,
          tunnel_id: localTunnelUuid, // Use local UUID, not CF ID
          vps_id: localTunnelUuid ? vps.id : null, // Associate with default VPS if tunnel
          status: 'live' as const,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: domainError } = await supabase
          .from('domains')
          .upsert(domainData, { 
            onConflict: 'hostname',
            ignoreDuplicates: false 
          });

        if (domainError) {
          console.error(`Error upserting domain ${hostname}:`, domainError);
        } else {
          importedDomains++;
          if (publish_strategy === 'tunnel') {
            tunnelDomains++;
          } else {
            dnsDomains++;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing zone ${zone.name}:`, error);
    }
  }

  return {
    importedDomains,
    tunnelDomains,
    dnsDomains
  };
}

async function getZoneDnsRecords(zoneId: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch DNS records for zone ${zoneId}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Cloudflare import process...');
    
    // 1) Liste TÚNEIS e faça UPSERT, retornando UUIDs LOCAIS
    const cfTunnels = await getCloudflareTunnels();
    if (!cfTunnels) {
      throw new Error('Failed to fetch tunnels from Cloudflare');
    }
    
    const upsertedTunnels = await importTunnelsToDatabase(cfTunnels);
    
    // Monte mapas por UUID LOCAL (id) e por ID do CF
    const nameToDbId = new Map<string, string>();
    const cfIdToDbId = new Map<string, string>();
    upsertedTunnels.forEach(t => {
      nameToDbId.set(t.name, t.id);
      cfIdToDbId.set(t.cf_tunnel_id, t.id);
    });
    
    // 2) Liste ZONAS (só agora você pode usar 'zones')
    const zones = await getCloudflareZones();
    if (!zones) {
      throw new Error('Failed to fetch zones from Cloudflare');
    }
    
    console.log(`Found ${zones.length} zones`);
    console.log(`Found ${cfTunnels.length} tunnels`);
    
    // 3) Importe domínios por zona (idempotente), usando **UUID local**
    const domainStats = await importZonesToDatabase(zones, nameToDbId, cfIdToDbId);
    
    console.log('Import completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cloudflare data imported successfully',
        stats: {
          zones: zones.length,
          tunnels: cfTunnels.length,
          ...domainStats
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Import error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});