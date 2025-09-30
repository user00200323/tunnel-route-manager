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

  if (!response.ok) {
    throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Cloudflare accounts response:', JSON.stringify(data, null, 2));
  
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  
  if (!data.result || data.result.length === 0) {
    throw new Error('No Cloudflare accounts found - check API token permissions');
  }

  return data.result[0].id;
}

async function getZoneIdForDomain(hostname: string, accountId: string): Promise<string | null> {
  const domain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  
  console.log(`Looking for Cloudflare zone for domain: ${domain}`);
  
  // Try different API approaches
  const urls = [
    `https://api.cloudflare.com/v4/zones?name=${domain}`,
    `https://api.cloudflare.com/v4/zones?name=${domain}&account.id=${accountId}`,
    `https://api.cloudflare.com/v4/zones`
  ];
  
  for (const url of urls) {
    console.log(`Trying API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`API call failed: ${response.status} ${response.statusText}`);
      continue;
    }

    const data = await response.json();
    console.log(`API response for ${url}:`, JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.log(`API returned error: ${JSON.stringify(data.errors)}`);
      continue;
    }
    
    // Look for exact domain match
    const zone = data.result.find((z: any) => z.name === domain);
    if (zone) {
      console.log(`Found zone for ${domain}: ${zone.id}`);
      return zone.id;
    }
  }
  
  console.log(`Zone not found for domain: ${domain}`);
  return null;
}

async function removeDnsRecords(hostname: string, zoneId: string): Promise<void> {
  console.log(`Removing DNS records for: ${hostname}`);

  // Get existing records
  const response = await fetch(`https://api.cloudflare.com/v4/zones/${zoneId}/dns_records?name=${hostname}`, {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to fetch DNS records: ${JSON.stringify(data.errors)}`);
  }

  // Delete each record
  for (const record of data.result) {
    const deleteResponse = await fetch(`https://api.cloudflare.com/v4/zones/${zoneId}/dns_records/${record.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
      },
    });

    const deleteData = await deleteResponse.json();
    
    if (!deleteData.success) {
      console.warn(`Failed to delete DNS record ${record.id}: ${JSON.stringify(deleteData.errors)}`);
    } else {
      console.log(`Deleted DNS record: ${record.name} (${record.type})`);
    }
  }
}

async function createCnameRecord(hostname: string, tunnelId: string, zoneId: string): Promise<void> {
  console.log(`Creating CNAME record for: ${hostname} -> ${tunnelId}.cfargotunnel.com`);

  const response = await fetch(`https://api.cloudflare.com/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'CNAME',
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
      ttl: 1, // Auto
      proxied: true,
    }),
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to create CNAME record: ${JSON.stringify(data.errors)}`);
  }

  console.log(`Created CNAME record successfully`);
}

async function updateTunnelConfiguration(tunnelId: string, domains: string[]): Promise<void> {
  console.log(`Updating tunnel configuration for: ${tunnelId}`);

  // Call tunnel-management function to update configuration
  const { data, error } = await supabase.functions.invoke('tunnel-management', {
    body: { 
      action: 'update_config',
      tunnelId,
      domains
    }
  });

  if (error) {
    throw new Error(`Failed to update tunnel configuration: ${error.message}`);
  }

  console.log(`Tunnel configuration updated successfully`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domainId, tunnelId, serviceUrl = 'http://caddy:80' } = await req.json();
    
    console.log(`Configuring domain ${domainId} with tunnel ${tunnelId}`);

    if (!domainId || !tunnelId) {
      throw new Error('Domain ID and Tunnel ID are required');
    }

    const accountId = await getCloudflareAccountId();
    
    // Get domain details
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (domainError || !domain) {
      throw new Error(`Domain not found: ${domainError?.message}`);
    }

    // Get tunnel details
    const { data: tunnel, error: tunnelError } = await supabase
      .from('tunnels')
      .select('*')
      .eq('tunnel_id', tunnelId)
      .single();

    if (tunnelError || !tunnel) {
      throw new Error(`Tunnel not found: ${tunnelError?.message}`);
    }

    const hostname = domain.hostname;
    let steps = [];

    try {
      // Step 1: Get zone ID
      const zoneId = await getZoneIdForDomain(hostname, accountId);
      if (!zoneId) {
        throw new Error(`Cloudflare zone not found for domain: ${hostname}`);
      }
      steps.push('Zone found');

      // Step 2: Remove existing DNS records
      await removeDnsRecords(hostname, zoneId);
      steps.push('DNS records removed');

      // Step 3: Update domain in database
      const { error: updateError } = await supabase
        .from('domains')
        .update({
          publish_strategy: 'tunnel',
          tunnel_id: tunnelId,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', domainId);

      if (updateError) {
        throw new Error(`Failed to update domain: ${updateError.message}`);
      }
      steps.push('Domain updated');

      // Step 4: Get all domains for this tunnel
      const { data: tunnelDomains, error: domainsError } = await supabase
        .from('domains')
        .select('hostname')
        .eq('tunnel_id', tunnelId)
        .eq('publish_strategy', 'tunnel');

      if (domainsError) {
        throw new Error(`Failed to get tunnel domains: ${domainsError.message}`);
      }

      const allDomains = tunnelDomains.map(d => d.hostname);
      
      // Step 5: Update tunnel configuration
      await updateTunnelConfiguration(tunnelId, allDomains);
      steps.push('Tunnel configuration updated');

      // Step 6: Create CNAME record
      await createCnameRecord(hostname, tunnelId, zoneId);
      steps.push('CNAME record created');

      // Step 7: Update domain status
      const { error: statusError } = await supabase
        .from('domains')
        .update({
          status: 'live',
          last_check_at: new Date().toISOString()
        })
        .eq('id', domainId);

      if (statusError) {
        throw new Error(`Failed to update domain status: ${statusError.message}`);
      }
      steps.push('Domain status updated');

      console.log(`Domain ${hostname} successfully configured with tunnel ${tunnel.name}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Domain configured with tunnel successfully',
          domain: hostname,
          tunnel: tunnel.name,
          steps
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (configError) {
      // Rollback: Try to restore original state if possible
      console.error(`Configuration failed at step: ${steps.join(' -> ')}`);
      console.error('Attempting rollback...');

      try {
        await supabase
          .from('domains')
          .update({
            publish_strategy: 'dns',
            tunnel_id: null,
            status: 'error',
            error_message: (configError as Error).message
          })
          .eq('id', domainId);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      throw configError;
    }

  } catch (error) {
    console.error('Error in configure-domain-tunnel function:', error);
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