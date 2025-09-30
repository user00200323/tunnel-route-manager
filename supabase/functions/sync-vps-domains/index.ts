import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VpsCommandResponse {
  success: boolean;
  output?: string;
  error?: string;
}

interface Domain {
  id: string;
  hostname: string;
  vps_id: string | null;
  tunnel_id: string | null;
  status: string;
}

interface SyncReport {
  database_domains: string[];
  vps_domains: string[];
  missing_in_vps: string[];
  missing_in_db: string[];
  tunnel_id_fixes_needed: Domain[];
  orphaned_domains: Domain[];
  recommendations: string[];
}

async function executeVpsCommand(vps: any, command: string): Promise<VpsCommandResponse> {
  const agentUrl = `http://${vps.ipv4}:8888/exec-command`;
  
  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('VPS_AGENT_TOKEN')}`,
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to execute command on VPS: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
}

function parseCaddyfile(caddyfileContent: string): string[] {
  const domains: string[] = [];
  const lines = caddyfileContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Look for domain patterns (domains usually start lines and end with {)
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('}') && 
        trimmed.includes('.') && (trimmed.endsWith('{') || trimmed.includes('{'))) {
      
      // Extract domain from line like "domain.com {" or "domain.com, www.domain.com {"
      const domainMatch = trimmed.match(/^([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})+)/);
      if (domainMatch) {
        const domain = domainMatch[1];
        if (!domains.includes(domain)) {
          domains.push(domain);
        }
      }
    }
  }
  
  return domains;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, vpsId, autoFix } = await req.json();

    if (action !== 'sync') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get VPS details
    const { data: vps, error: vpsError } = await supabase
      .from('vps_servers')
      .select('*')
      .eq('id', vpsId)
      .single();

    if (vpsError || !vps) {
      throw new Error(`VPS not found: ${vpsError?.message || 'Unknown error'}`);
    }

    if (!vps.ipv4) {
      throw new Error('VPS IP address not configured');
    }

    console.log(`Syncing domains for VPS: ${vps.name} (${vps.ipv4})`);

    // Get domains from database
    const { data: dbDomains, error: domainsError } = await supabase
      .from('domains')
      .select('id, hostname, vps_id, tunnel_id, status')
      .or(`vps_id.eq.${vpsId},vps_id.is.null`);

    if (domainsError) {
      throw new Error(`Failed to fetch domains: ${domainsError.message}`);
    }

    // Get Caddyfile content from VPS
    const caddyResult = await executeVpsCommand(vps, 'sed -n \'1,120p\' /opt/app/Caddyfile');
    
    if (!caddyResult.success) {
      throw new Error(`Failed to read Caddyfile: ${caddyResult.error}`);
    }

    // Parse domains from Caddyfile
    const vpsDomains = parseCaddyfile(caddyResult.output || '');
    console.log(`Found ${vpsDomains.length} domains in Caddyfile:`, vpsDomains);

    // Analyze differences
    const dbDomainNames = dbDomains?.map(d => d.hostname) || [];
    const missingInVps = dbDomainNames.filter(d => !vpsDomains.includes(d));
    const missingInDb = vpsDomains.filter(d => !dbDomainNames.includes(d));
    
    // Find domains that need tunnel_id fixes
    const tunnelIdFixes = dbDomains?.filter(d => 
      d.vps_id === vpsId && !d.tunnel_id
    ) || [];

    // Find orphaned domains (no vps_id but should have one)
    const orphanedDomains = dbDomains?.filter(d => 
      !d.vps_id && vpsDomains.includes(d.hostname)
    ) || [];

    const syncReport: SyncReport = {
      database_domains: dbDomainNames,
      vps_domains: vpsDomains,
      missing_in_vps: missingInVps,
      missing_in_db: missingInDb,
      tunnel_id_fixes_needed: tunnelIdFixes,
      orphaned_domains: orphanedDomains,
      recommendations: []
    };

    // Generate recommendations
    if (missingInVps.length > 0) {
      syncReport.recommendations.push(`${missingInVps.length} domains in database but not in VPS Caddyfile`);
    }
    if (missingInDb.length > 0) {
      syncReport.recommendations.push(`${missingInDb.length} domains in VPS but not in database`);
    }
    if (tunnelIdFixes.length > 0) {
      syncReport.recommendations.push(`${tunnelIdFixes.length} domains need tunnel_id correction`);
    }
    if (orphanedDomains.length > 0) {
      syncReport.recommendations.push(`${orphanedDomains.length} orphaned domains need VPS association`);
    }

    // Apply fixes if autoFix is requested
    if (autoFix) {
      const fixes = [];

      // Fix tunnel_id for domains associated with this VPS
      if (tunnelIdFixes.length > 0) {
        const { error: tunnelFixError } = await supabase
          .from('domains')
          .update({ tunnel_id: vps.tunnel_id })
          .in('id', tunnelIdFixes.map(d => d.id));

        if (tunnelFixError) {
          console.error('Failed to fix tunnel_id:', tunnelFixError);
        } else {
          fixes.push(`Fixed tunnel_id for ${tunnelIdFixes.length} domains`);
        }
      }

      // Associate orphaned domains with this VPS
      if (orphanedDomains.length > 0) {
        const { error: orphanFixError } = await supabase
          .from('domains')
          .update({ 
            vps_id: vpsId,
            tunnel_id: vps.tunnel_id 
          })
          .in('id', orphanedDomains.map(d => d.id));

        if (orphanFixError) {
          console.error('Failed to fix orphaned domains:', orphanFixError);
        } else {
          fixes.push(`Associated ${orphanedDomains.length} orphaned domains with VPS`);
        }
      }

      syncReport.recommendations = fixes;
    }

    // Update VPS last_seen_at
    await supabase
      .from('vps_servers')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', vpsId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        report: syncReport,
        caddyfile_content: caddyResult.output
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});