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

interface NameserverInfo {
  domain: string;
  nameservers: string[];
  isCloudflare: boolean;
  cloudflareNameservers: string[];
}

async function checkDomainNameservers(domain: string): Promise<NameserverInfo> {
  // Get zone info from Cloudflare to check nameservers
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch zone info for ${domain}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success || !data.result?.length) {
    throw new Error(`Zone not found in Cloudflare: ${domain}`);
  }

  const zone = data.result[0];
  const cloudflareNameservers = zone.name_servers || [];
  
  // Get current nameservers via DNS lookup (this is a simple check)
  // In a real implementation, you might want to use a more robust DNS checking service
  let actualNameservers: string[] = [];
  let isCloudflare = false;
  
  try {
    // For now, we'll assume if zone exists in CF and status is active, it's using CF nameservers
    isCloudflare = zone.status === 'active';
    actualNameservers = cloudflareNameservers;
  } catch (error) {
    console.warn(`Could not resolve nameservers for ${domain}:`, error);
    // Fallback: check if zone is active in Cloudflare
    isCloudflare = zone.status === 'active';
    actualNameservers = cloudflareNameservers;
  }

  return {
    domain,
    nameservers: actualNameservers,
    isCloudflare,
    cloudflareNameservers
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
      throw new Error('Domain parameter is required');
    }

    console.log(`Checking nameservers for domain: ${domain}`);
    
    const nameserverInfo = await checkDomainNameservers(domain);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: nameserverInfo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Nameserver check error:', error);
    
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