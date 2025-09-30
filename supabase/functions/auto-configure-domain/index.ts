import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { domainId } = await req.json();

    if (!domainId) {
      return new Response(
        JSON.stringify({ error: 'domainId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Auto-configuring domain: ${domainId}`);

    // Fetch domain details
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('*, vps_servers(ipv4)')
      .eq('id', domainId)
      .single();

    if (domainError || !domain) {
      console.error('Domain not found:', domainError);
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!domain.active) {
      return new Response(
        JSON.stringify({ error: 'Domain is not active' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const results = {
      domain: domain.hostname,
      strategy: domain.publish_strategy,
      steps: [] as Array<{ step: string; status: string; error?: string }>,
      success: true,
      errors: [] as string[]
    };

    try {
      // Step 1: Configure Cloudflare DNS
      console.log(`Configuring Cloudflare DNS for ${domain.hostname}...`);
      results.steps.push({ step: 'cloudflare_dns', status: 'started' });

      const dnsResponse = await supabase.functions.invoke('cloudflare-dns', {
        body: {
          domainId: domain.id,
          action: 'create'
        }
      });

      if (dnsResponse.error) {
        console.error('DNS configuration failed:', dnsResponse.error);
        results.steps.push({ step: 'cloudflare_dns', status: 'failed', error: dnsResponse.error.message });
        results.errors.push('Failed to configure Cloudflare DNS');
        results.success = false;
      } else {
        console.log('DNS configuration successful');
        results.steps.push({ step: 'cloudflare_dns', status: 'completed' });
      }

      // Step 2: Update VPS Caddyfile (only for DNS strategy)
      if (domain.publish_strategy === 'dns' && domain.vps_id && results.success) {
        console.log(`Updating VPS Caddyfile for ${domain.hostname}...`);
        results.steps.push({ step: 'vps_caddyfile', status: 'started' });

        const vpsResponse = await supabase.functions.invoke('vps-management', {
          body: {
            action: 'update_caddyfile',
            vpsId: domain.vps_id
          }
        });

        if (vpsResponse.error) {
          console.error('VPS Caddyfile update failed:', vpsResponse.error);
          results.steps.push({ step: 'vps_caddyfile', status: 'failed', error: vpsResponse.error.message });
          results.errors.push('Failed to update VPS Caddyfile');
          results.success = false;
        } else {
          console.log('VPS Caddyfile update successful');
          results.steps.push({ step: 'vps_caddyfile', status: 'completed' });
        }
      }

      // Step 3: Update domain status
      if (results.success) {
        console.log(`Updating domain status to 'configured'...`);
        const { error: updateError } = await supabase
          .from('domains')
          .update({ 
            status: 'live',
            last_check_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', domainId);

        if (updateError) {
          console.error('Failed to update domain status:', updateError);
          results.errors.push('Failed to update domain status');
          results.success = false;
        } else {
          console.log('Domain status updated successfully');
          results.steps.push({ step: 'domain_status', status: 'completed' });
        }
      } else {
        // Update domain with error status
        await supabase
          .from('domains')
          .update({ 
            status: 'error',
            error_message: results.errors.join('; '),
            last_check_at: new Date().toISOString()
          })
          .eq('id', domainId);
      }

    } catch (error) {
      console.error('Configuration error:', error);
      results.success = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`Configuration failed: ${errorMessage}`);
      
      // Update domain with error status
      await supabase
        .from('domains')
        .update({ 
          status: 'error',
          error_message: errorMessage,
          last_check_at: new Date().toISOString()
        })
        .eq('id', domainId);
    }

    console.log('Auto-configuration completed:', results);

    return new Response(
      JSON.stringify(results),
      { 
        status: results.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Auto-configuration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Auto-configuration failed', 
        message: errorMessage,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});