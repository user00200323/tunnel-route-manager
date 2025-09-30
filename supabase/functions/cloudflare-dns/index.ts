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

interface CloudflareZone {
  id: string;
  name: string;
}

interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

async function getZoneId(domain: string): Promise<string> {
  console.log(`Getting zone ID for domain: ${domain}`);
  
  // Extract root domain (e.g., merlibre.shop from www.merlibre.shop)
  const parts = domain.split('.');
  const rootDomain = parts.slice(-2).join('.');
  
  console.log(`Extracted root domain: ${rootDomain} from original domain: ${domain}`);
  console.log(`Domain parts: ${JSON.stringify(parts)}`);
  
  const apiUrl = `https://api.cloudflare.com/v4/zones?name=${rootDomain}`;
  console.log(`Making API request to: ${apiUrl}`);
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`Cloudflare API response status: ${response.status} ${response.statusText}`);
  
  const data = await response.json();
  console.log(`Cloudflare API response data:`, JSON.stringify(data, null, 2));
  
  if (!response.ok) {
    console.error(`Cloudflare API error: ${response.status} ${response.statusText}`);
    console.error(`Error details:`, JSON.stringify(data, null, 2));
    throw new Error(`Cloudflare API request failed: ${response.status} ${response.statusText}`);
  }
  
  if (!data.success) {
    console.error(`Cloudflare API returned success=false:`, JSON.stringify(data.errors, null, 2));
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  
  if (data.result.length === 0) {
    console.error(`No zones found for domain: ${rootDomain}`);
    console.log(`Available zones in account:`, JSON.stringify(data.result, null, 2));
    throw new Error(`Zone not found for domain: ${rootDomain}. No zones match this domain in your Cloudflare account.`);
  }

  console.log(`Found zone: ${data.result[0].name} with ID: ${data.result[0].id}`);
  return data.result[0].id;
}

async function createOrUpdateDNSRecord(
  zoneId: string,
  type: string,
  name: string,
  content: string,
  proxied: boolean = true,
  ttl: number = 1
): Promise<CloudflareDNSRecord> {
  console.log(`Creating/updating DNS record: ${type} ${name} -> ${content}`);

  // First, try to find existing record
  const listResponse = await fetch(
    `https://api.cloudflare.com/v4/zones/${zoneId}/dns_records?type=${type}&name=${name}`,
    {
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const listData = await listResponse.json();
  
  if (listData.success && listData.result.length > 0) {
    // Update existing record
    const recordId = listData.result[0].id;
    const updateResponse = await fetch(
      `https://api.cloudflare.com/v4/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          name,
          content,
          proxied,
          ttl,
        }),
      }
    );

    const updateData = await updateResponse.json();
    if (!updateData.success) {
      throw new Error(`Failed to update DNS record: ${JSON.stringify(updateData.errors)}`);
    }
    
    return updateData.result;
  } else {
    // Create new record
    const createResponse = await fetch(
      `https://api.cloudflare.com/v4/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          name,
          content,
          proxied,
          ttl,
        }),
      }
    );

    const createData = await createResponse.json();
    if (!createData.success) {
      throw new Error(`Failed to create DNS record: ${JSON.stringify(createData.errors)}`);
    }
    
    return createData.result;
  }
}

async function saveDNSRecord(domainId: string, record: CloudflareDNSRecord) {
  const { error } = await supabase
    .from('dns_records')
    .upsert({
      domain_id: domainId,
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied,
      ttl: record.ttl,
      provider_ref: record.id,
    });

  if (error) {
    console.error('Error saving DNS record to database:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domainId, action, recordType = 'A' } = await req.json();
    
    console.log(`Processing DNS ${action} for domain ID: ${domainId}`);

    // Get domain details
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select(`
        *,
        vps_servers!vps_id (*)
      `)
      .eq('id', domainId)
      .single();

    if (domainError || !domain) {
      throw new Error(`Domain not found: ${domainError?.message}`);
    }

    const zoneId = await getZoneId(domain.hostname);
    const records = [];

    if (action === 'create' || action === 'update') {
      if (domain.publish_strategy === 'dns' && domain.vps_servers) {
        const vps = domain.vps_servers;
        
        // Create A record for apex domain
        if (vps.ipv4) {
          const aRecord = await createOrUpdateDNSRecord(
            zoneId,
            'A',
            domain.hostname,
            vps.ipv4,
            true
          );
          records.push(aRecord);
          await saveDNSRecord(domainId, aRecord);
        }

        // Create AAAA record if IPv6 available
        if (vps.ipv6) {
          const aaaaRecord = await createOrUpdateDNSRecord(
            zoneId,
            'AAAA',
            domain.hostname,
            vps.ipv6,
            true
          );
          records.push(aaaaRecord);
          await saveDNSRecord(domainId, aaaaRecord);
        }

        // Create www CNAME if www_alias is enabled
        if (domain.www_alias) {
          const cnameRecord = await createOrUpdateDNSRecord(
            zoneId,
            'CNAME',
            `www.${domain.hostname}`,
            domain.hostname,
            true
          );
          records.push(cnameRecord);
          await saveDNSRecord(domainId, cnameRecord);
        }
      } else if (domain.publish_strategy === 'tunnel' && domain.tunnel_id) {
        // For tunnel strategy, create CNAME to tunnel hostname
        const tunnelHostname = `${domain.tunnel_id}.cfargotunnel.com`;
        
        const cnameRecord = await createOrUpdateDNSRecord(
          zoneId,
          'CNAME',
          domain.hostname,
          tunnelHostname,
          true
        );
        records.push(cnameRecord);
        await saveDNSRecord(domainId, cnameRecord);

        // Create www CNAME if www_alias is enabled
        if (domain.www_alias) {
          const wwwCnameRecord = await createOrUpdateDNSRecord(
            zoneId,
            'CNAME',
            `www.${domain.hostname}`,
            domain.hostname,
            true
          );
          records.push(wwwCnameRecord);
          await saveDNSRecord(domainId, wwwCnameRecord);
        }
      }

      // Update domain status
      await supabase
        .from('domains')
        .update({ 
          status: 'propagating',
          last_check_at: new Date().toISOString()
        })
        .eq('id', domainId);
        
    } else if (action === 'delete') {
      // Get all DNS records for this domain
      const { data: dnsRecords } = await supabase
        .from('dns_records')
        .select('*')
        .eq('domain_id', domainId);

      // Delete from Cloudflare
      for (const record of dnsRecords || []) {
        if (record.provider_ref) {
          await fetch(
            `https://api.cloudflare.com/v4/zones/${zoneId}/dns_records/${record.provider_ref}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${cloudflareToken}`,
              },
            }
          );
        }
      }

      // Delete from database
      await supabase
        .from('dns_records')
        .delete()
        .eq('domain_id', domainId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        records,
        message: `DNS ${action} completed successfully`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in cloudflare-dns function:', error);
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