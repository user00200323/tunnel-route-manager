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

interface SyncRequest {
  hosts: string[];
  include_www?: boolean;
  vpsId?: string;
  autoFix?: boolean;
}

interface SyncReport {
  database_domains: string[];
  vps_domains: string[];
  missing_in_vps: string[];
  missing_in_db: string[];
  cname_checks: { [key: string]: boolean };
  agent_status: 'online' | 'offline' | 'error';
  fixes_applied: string[];
  recommendations: string[];
}

async function executeVpsCommand(agentUrl: string, command: string): Promise<VpsCommandResponse> {
  try {
    const response = await fetch(`${agentUrl}/exec-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 3db4fe2fb1d43942ae895f927efef38d2bbc19aec275c2138cb1765a692c3cd5',
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
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('}') && 
        trimmed.includes('.') && (trimmed.endsWith('{') || trimmed.includes('{'))) {
      
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

async function checkCNAME(hostname: string, expectedCname: string): Promise<boolean> {
  try {
    // Simple DNS check - in production, use proper DNS lookup
    const response = await fetch(`https://dns.google/resolve?name=${hostname}&type=CNAME`);
    const data = await response.json();
    
    if (data.Answer) {
      return data.Answer.some((answer: any) => 
        answer.data && answer.data.includes(expectedCname)
      );
    }
    return false;
  } catch (error) {
    console.error(`CNAME check failed for ${hostname}:`, error);
    return false;
  }
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

    const { hosts, include_www = false, vpsId, autoFix = false }: SyncRequest = await req.json();

    if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'hosts array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Syncing ${hosts.length} hosts:`, hosts);

    // Get VPS (use provided vpsId or default VPS)
    const { data: vps, error: vpsError } = vpsId 
      ? await supabase.from('vps_servers').select('*').eq('id', vpsId).single()
      : await supabase.from('vps_servers').select('*').limit(1).single();

    if (vpsError || !vps) {
      throw new Error(`VPS not found: ${vpsError?.message || 'Unknown error'}`);
    }

    const agentUrl = vps.agent_url || `http://${vps.ipv4}:8888`;
    console.log(`Using agent URL: ${agentUrl}`);

    // Get domains from database for the specified hosts
    const { data: dbDomains, error: domainsError } = await supabase
      .from('domains')
      .select('id, hostname, vps_id, tunnel_id, status')
      .in('hostname', hosts);

    if (domainsError) {
      throw new Error(`Failed to fetch domains: ${domainsError.message}`);
    }

    // Get tunnel for CNAME checks
    const { data: tunnel } = await supabase
      .from('tunnels')
      .select('cf_tunnel_id')
      .eq('name', 'vps-merlibre')
      .single();

    const expectedCname = tunnel?.cf_tunnel_id ? `${tunnel.cf_tunnel_id}.cfargotunnel.com` : null;

    // Test VPS agent connection
    const agentTestResult = await executeVpsCommand(agentUrl, 'echo "test"');
    const agentStatus: 'online' | 'offline' | 'error' = agentTestResult.success ? 'online' : 'offline';

    let vpsDomains: string[] = [];
    let caddyResult: VpsCommandResponse = { success: false, error: 'Agent offline' };

    if (agentStatus === 'online') {
      // Get Caddyfile content from VPS
      caddyResult = await executeVpsCommand(agentUrl, 'sed -n \'1,120p\' /opt/app/Caddyfile');
      if (caddyResult.success) {
        vpsDomains = parseCaddyfile(caddyResult.output || '');
      }
    }

    // Check CNAMEs for all hosts
    const cnameChecks: { [key: string]: boolean } = {};
    if (expectedCname) {
      for (const host of hosts) {
        cnameChecks[host] = await checkCNAME(host, expectedCname);
      }
    }

    // Analyze differences
    const dbDomainNames = dbDomains?.map(d => d.hostname) || [];
    const missingInVps = dbDomainNames.filter(d => !vpsDomains.includes(d));
    const missingInDb = vpsDomains.filter(d => !dbDomainNames.includes(d));

    const syncReport: SyncReport = {
      database_domains: dbDomainNames,
      vps_domains: vpsDomains,
      missing_in_vps: missingInVps,
      missing_in_db: missingInDb,
      cname_checks: cnameChecks,
      agent_status: agentStatus,
      fixes_applied: [],
      recommendations: []
    };

    // Generate recommendations
    if (agentStatus === 'offline') {
      syncReport.recommendations.push('VPS Agent is offline - check agent service on VPS');
    }
    if (missingInVps.length > 0) {
      syncReport.recommendations.push(`${missingInVps.length} domains in database but not in VPS Caddyfile`);
    }
    if (missingInDb.length > 0) {
      syncReport.recommendations.push(`${missingInDb.length} domains in VPS but not in database`);
    }
    
    // Check CNAME issues
    const cnameIssues = Object.entries(cnameChecks).filter(([_, valid]) => !valid).map(([domain]) => domain);
    if (cnameIssues.length > 0) {
      syncReport.recommendations.push(`${cnameIssues.length} domains have incorrect CNAME records: ${cnameIssues.join(', ')}`);
    }

    // Apply fixes if requested and agent is online
    if (autoFix && agentStatus === 'online' && dbDomains) {
      const fixes = [];

      // Fix missing domains in database (associate with VPS if found in Caddyfile)
      const orphanedHosts = hosts.filter(h => 
        vpsDomains.includes(h) && !dbDomainNames.includes(h)
      );

      if (orphanedHosts.length > 0) {
        // This would require creating domains, which is more complex
        fixes.push(`Found ${orphanedHosts.length} domains in VPS that need to be added to database`);
      }

      // Fix VPS associations
      const unassociatedDomains = dbDomains.filter(d => 
        !d.vps_id && vpsDomains.includes(d.hostname)
      );

      if (unassociatedDomains.length > 0) {
        const { error: associationError } = await supabase
          .from('domains')
          .update({ vps_id: vps.id, tunnel_id: tunnel?.cf_tunnel_id })
          .in('id', unassociatedDomains.map(d => d.id));

        if (!associationError) {
          fixes.push(`Associated ${unassociatedDomains.length} domains with VPS`);
        }
      }

      syncReport.fixes_applied = fixes;
    }

    // Update VPS last_seen_at
    await supabase
      .from('vps_servers')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', vps.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        report: syncReport,
        caddyfile_content: caddyResult.output,
        agent_url: agentUrl
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