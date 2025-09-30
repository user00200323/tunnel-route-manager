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

async function importTunnelsToDatabase(tunnels: CloudflareTunnel[]) {
  console.log('Starting tunnel import to database...')
  
  // Add detailed logging for tunnel data structure
  console.log('=== TUNNEL DATA STRUCTURE ANALYSIS ===')
  tunnels.forEach((tunnel, index) => {
    console.log(`\nTunnel ${index + 1}: ${tunnel.name}`)
    console.log(`- ID: ${tunnel.id}`)
    console.log(`- Created: ${tunnel.created_at}`)
    console.log(`- Full tunnel object:`, JSON.stringify(tunnel, null, 2))
    
    // Check different possible connection fields
    console.log(`- tunnel.conns:`, tunnel.conns)
    console.log(`- tunnel.connections:`, (tunnel as any).connections)
    console.log(`- tunnel.status:`, (tunnel as any).status)
    console.log(`- tunnel.active:`, (tunnel as any).active)
    
    // Check if conns exists and its structure
    if (tunnel.conns) {
      console.log(`- conns array length: ${tunnel.conns.length}`)
      console.log(`- conns structure:`, JSON.stringify(tunnel.conns, null, 2))
    } else {
      console.log(`- conns field is missing or null`)
    }
    
    // Check for alternative connection data
    const altConnections = (tunnel as any).connections;
    if (altConnections) {
      console.log(`- connections field found:`, JSON.stringify(altConnections, null, 2))
    }
  })
  console.log('=== END TUNNEL DATA ANALYSIS ===\n')
  
  const tunnelsToUpsert = tunnels.map(tunnel => {
    // Improved status detection logic
    let status = 'disconnected';
    
    // Method 1: Check tunnel.conns (original method)
    if (tunnel.conns && tunnel.conns.length > 0) {
      status = 'connected';
      console.log(`Tunnel ${tunnel.name}: Status = connected (via conns, count: ${tunnel.conns.length})`)
    }
    // Method 2: Check alternative connections field
    else if ((tunnel as any).connections && (tunnel as any).connections.length > 0) {
      status = 'connected';
      console.log(`Tunnel ${tunnel.name}: Status = connected (via connections, count: ${(tunnel as any).connections.length})`)
    }
    // Method 3: Check if tunnel has status field
    else if ((tunnel as any).status === 'active' || (tunnel as any).status === 'connected') {
      status = 'connected';
      console.log(`Tunnel ${tunnel.name}: Status = connected (via status field: ${(tunnel as any).status})`)
    }
    // Method 4: Assume active if created recently (fallback)
    else {
      const createdAt = new Date(tunnel.created_at);
      const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated < 24) {
        status = 'connected'; // Assume recently created tunnels are likely connected
        console.log(`Tunnel ${tunnel.name}: Status = connected (fallback - created ${hoursSinceCreated.toFixed(1)}h ago)`)
      } else {
        console.log(`Tunnel ${tunnel.name}: Status = disconnected (no connection data found)`)
      }
    }
    
    return {
      tunnel_id: tunnel.id,
      name: tunnel.name,
      provider: 'cloudflared',
      status: status as 'connected' | 'disconnected',
      last_seen_at: new Date().toISOString(),
      created_at: tunnel.created_at,
      updated_at: new Date().toISOString()
    }
  })

  const { data: upsertedTunnels, error: tunnelsError } = await supabase
    .from('tunnels')
    .upsert(tunnelsToUpsert, { 
      onConflict: 'tunnel_id',
      ignoreDuplicates: false 
    })
    .select()

  if (tunnelsError) {
    console.error('Error upserting tunnels:', tunnelsError)
    throw tunnelsError
  }

  console.log(`Successfully processed ${upsertedTunnels?.length || 0} tunnels`)
  return upsertedTunnels || []
}

async function importZonesToDatabase(zones: CloudflareZone[], tunnels: CloudflareTunnel[]) {
  console.log('Starting import to database...')
  
  // Create a default tenant if none exists
  let { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single()

  if (!tenant) {
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert([{ name: 'Default Tenant' }])
      .select('id')
      .single()

    if (tenantError) {
      console.error('Error creating tenant:', tenantError)
      throw tenantError
    }
    tenant = newTenant
  }

  // Create a default VPS if none exists
  let { data: vps } = await supabase
    .from('vps_servers')
    .select('id')
    .limit(1)
    .single()

  if (!vps) {
    const { data: newVps, error: vpsError } = await supabase
      .from('vps_servers')
      .insert([{ 
        name: 'Default VPS',
        health: 'healthy'
      }])
      .select('id')
      .single()

    if (vpsError) {
      console.error('Error creating VPS:', vpsError)
      throw vpsError
    }
    vps = newVps
  }

  // Get existing domains to track what's new vs updated
  const { data: existingDomains } = await supabase
    .from('domains')
    .select('hostname, tunnel_id')

  const existingHostnames = new Set(existingDomains?.map(d => d.hostname) || [])

  // Query database tunnels to get UUIDs for foreign key references
  const { data: dbTunnels } = await supabase
    .from('tunnels')
    .select('id, name, tunnel_id')
  
  // Create a map of tunnel names to their database UUIDs (not Cloudflare IDs)
  const tunnelMap = new Map<string, string>()
  dbTunnels?.forEach(tunnel => {
    tunnelMap.set(tunnel.name, tunnel.id) // Use database UUID, not Cloudflare tunnel_id
  })
  
  console.log(`Created tunnel mapping for ${tunnelMap.size} tunnels`)

  // Import domains - Map Cloudflare status to our domain_status enum
  const domainsToUpsert = zones.map(zone => {
    let domainStatus = 'pending'
    if (zone.status === 'active') {
      domainStatus = 'live'
    } else if (zone.status === 'pending') {
      domainStatus = 'pending' 
    } else if (zone.status === 'initializing') {
      domainStatus = 'propagating'
    } else {
      domainStatus = 'error'
    }

    // Try to find matching tunnel by domain name or similar naming pattern
    // Enhanced logic to better match domains like merlibre.shop and mercallbr.shop to vps-merlibre
    let tunnelId = null
    for (const [tunnelName, cfTunnelId] of tunnelMap) {
      const domainBase = zone.name.split('.')[0] // e.g., "merlibre" from "merlibre.shop"
      const tunnelBase = tunnelName.replace('vps-', '').replace('-', '') // e.g., "merlibre" from "vps-merlibre"
      
      // Check for exact matches, partial matches, and common prefixes
      if (tunnelName.includes(zone.name.replace('.', '-')) || 
          tunnelName.includes(domainBase) ||
          zone.name.includes(tunnelName) ||
          domainBase.includes(tunnelBase) ||
          tunnelBase.includes(domainBase) ||
          // Special case for similar domain names (mercallbr vs merlibre)
          (domainBase.length >= 6 && tunnelBase.length >= 6 && 
           domainBase.substring(0, 6) === tunnelBase.substring(0, 6))) {
        tunnelId = cfTunnelId
        console.log(`Domain ${zone.name} matched to tunnel ${tunnelName} (${cfTunnelId})`)
        break
      }
    }

    // Determine publish_strategy based on tunnel presence
    // CRITICAL: Respect the valid_publish_strategy constraint
    let publishStrategy: 'dns' | 'tunnel'
    let finalVpsId: string | null
    let finalTunnelId: string | null
    
    if (tunnelId) {
      // Domain uses tunnel → strategy = 'tunnel', vps_id = NULL
      publishStrategy = 'tunnel'
      finalVpsId = null
      finalTunnelId = tunnelId
      console.log(`Domain ${zone.name} assigned to tunnel ${tunnelId}`)
    } else {
      // Domain uses DNS → strategy = 'dns', tunnel_id = NULL
      publishStrategy = 'dns'
      finalVpsId = vps.id
      finalTunnelId = null
    }

    return {
      hostname: zone.name,
      fqdn: zone.name,
      tenant_id: tenant.id,
      publish_strategy: publishStrategy,
      vps_id: finalVpsId,
      tunnel_id: finalTunnelId,
      status: domainStatus,
      active: zone.status === 'active',
      created_at: zone.created_on,
      updated_at: zone.modified_on
    }
  })

  console.log(`Processing ${domainsToUpsert.length} domains from Cloudflare`)
  console.log(`Found ${existingHostnames.size} existing domains in database`)

  // Use upsert to handle both new and existing domains
  const { data: upsertedDomains, error: domainsError } = await supabase
    .from('domains')
    .upsert(domainsToUpsert, { 
      onConflict: 'hostname',
      ignoreDuplicates: false 
    })
    .select()

  if (domainsError) {
    console.error('Error upserting domains:', domainsError)
    throw domainsError
  }

  // Count new vs updated domains
  const newDomainsCount = domainsToUpsert.filter(d => !existingHostnames.has(d.hostname)).length
  const updatedDomainsCount = domainsToUpsert.filter(d => existingHostnames.has(d.hostname)).length
  const domainsWithTunnels = domainsToUpsert.filter(d => d.tunnel_id).length

  console.log(`Successfully processed ${upsertedDomains?.length || 0} domains`)
  console.log(`- New domains: ${newDomainsCount}`)
  console.log(`- Updated domains: ${updatedDomainsCount}`)
  console.log(`- Domains with tunnels: ${domainsWithTunnels}`)
  
  return {
    domains: upsertedDomains || [],
    newCount: newDomainsCount,
    updatedCount: updatedDomainsCount,
    totalCount: upsertedDomains?.length || 0,
    tunnelCount: domainsWithTunnels
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting Cloudflare import process...')
    
    // Fetch zones and tunnels from Cloudflare
    const [zones, tunnels] = await Promise.all([
      getCloudflareZones(),
      getCloudflareTunnels()
    ])
    
    // Import tunnels first
    await importTunnelsToDatabase(tunnels)
    
    // Import zones with tunnel associations
    const importedDomains = await importZonesToDatabase(zones, tunnels)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${importedDomains.totalCount} domains and ${tunnels.length} tunnels from Cloudflare (${importedDomains.newCount} new domains, ${importedDomains.updatedCount} updated, ${importedDomains.tunnelCount} with tunnels)`,
        domains: importedDomains.domains,
        tunnels: tunnels,
        statistics: {
          total: importedDomains.totalCount,
          new: importedDomains.newCount,
          updated: importedDomains.updatedCount,
          tunnels: tunnels.length,
          domainsWithTunnels: importedDomains.tunnelCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})