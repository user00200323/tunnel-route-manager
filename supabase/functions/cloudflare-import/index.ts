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

async function getCloudflareZones(): Promise<CloudflareZone[]> {
  console.log('Fetching zones from Cloudflare...')
  
  const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Cloudflare API error:', response.status, errorText)
    throw new Error(`Cloudflare API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log(`Found ${data.result.length} zones`)
  return data.result
}

async function importZonesToDatabase(zones: CloudflareZone[]) {
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

  // Import domains
  const domainsToInsert = zones.map(zone => ({
    hostname: zone.name,
    fqdn: zone.name,
    tenant_id: tenant.id,
    vps_id: vps.id,
    status: zone.status === 'active' ? 'active' : 'pending',
    active: zone.status === 'active',
    created_at: zone.created_on,
    updated_at: zone.modified_on
  }))

  const { data: insertedDomains, error: domainsError } = await supabase
    .from('domains')
    .insert(domainsToInsert)
    .select()

  if (domainsError) {
    console.error('Error inserting domains:', domainsError)
    throw domainsError
  }

  console.log(`Successfully imported ${insertedDomains.length} domains`)
  return insertedDomains
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting Cloudflare import process...')
    
    // Fetch zones from Cloudflare
    const zones = await getCloudflareZones()
    
    // Import to database
    const importedDomains = await importZonesToDatabase(zones)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${importedDomains.length} domains from Cloudflare`,
        domains: importedDomains
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