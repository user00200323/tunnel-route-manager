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
  
  const tunnelsToUpsert = tunnels.map(tunnel => ({
    tunnel_id: tunnel.id,
    name: tunnel.name,
    provider: 'cloudflared',
    status: tunnel.conns && tunnel.conns.length > 0 ? 'connected' : 'disconnected',
    last_seen_at: new Date().toISOString(),
    created_at: tunnel.created_at,
    updated_at: new Date().toISOString()
  }))

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

  // Create a map of tunnel names to tunnel IDs for association
  const tunnelMap = new Map()
  tunnels.forEach(tunnel => {
    tunnelMap.set(tunnel.name, tunnel.id)
  })

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
    let tunnelId = null
    for (const [tunnelName, cfTunnelId] of tunnelMap) {
      if (tunnelName.includes(zone.name.replace('.', '-')) || 
          tunnelName.includes(zone.name.split('.')[0]) ||
          zone.name.includes(tunnelName)) {
        tunnelId = cfTunnelId
        break
      }
    }

    return {
      hostname: zone.name,
      fqdn: zone.name,
      tenant_id: tenant.id,
      vps_id: vps.id,
      tunnel_id: tunnelId,
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