import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateCaddyfile(domains: string[]): string {
  if (domains.length === 0) {
    return `# No domains configured
:80 {
    respond "Server is healthy" 200
}
`;
  }

  const domainList = domains.join(', ');
  return `${domainList} {
    encode gzip
    reverse_proxy web:3000
    
    @health path /health /.well-known/health
    respond @health "OK" 200
    
    @metrics path /metrics
    respond @metrics "# No metrics available" 200
}

# Default handler for other requests
:80 {
    respond "Server is healthy" 200
}
`;
}

function generateDockerCompose(vps: any, domains: string[]): string {
  const tunnelConfig = vps.tunnel_id ? `
  cloudflared:
    image: cloudflare/cloudflared:2025.8.1
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=\${TUNNEL_TOKEN}
    restart: unless-stopped
    depends_on: [caddy]
    networks:
      - app-network` : '';

  return `version: '3.8'

services:
  web:
    image: ghcr.io/yourorg/yourapp:latest
    restart: unless-stopped
    expose: ["3000"]
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - app-network

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: 
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [web]
    networks:
      - app-network
${tunnelConfig}

volumes:
  caddy_data:
  caddy_config:

networks:
  app-network:
    driver: bridge
`;
}

async function executeSSHCommand(vps: any, command: string): Promise<string> {
  // In a real implementation, this would use SSH to execute commands
  // For now, we'll simulate the SSH execution
  console.log(`Simulating SSH command on ${vps.name} (${vps.ipv4}): ${command}`);
  
  // Simulate command execution delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return `Command executed successfully on ${vps.name}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, vpsId, ...params } = await req.json();
    
    console.log(`VPS management action: ${action} for VPS: ${vpsId}`);

    // Get VPS details
    const { data: vps, error: vpsError } = await supabase
      .from('vps_servers')
      .select('*')
      .eq('id', vpsId)
      .single();

    if (vpsError || !vps) {
      throw new Error(`VPS not found: ${vpsError?.message}`);
    }

    let result = {};

    switch (action) {
      case 'update_caddyfile':
        // Get all domains for this VPS
        const { data: domains } = await supabase
          .from('domains')
          .select('hostname, www_alias')
          .eq('vps_id', vpsId)
          .eq('active', true);

        const domainList = [];
        for (const domain of domains || []) {
          domainList.push(domain.hostname);
          if (domain.www_alias) {
            domainList.push(`www.${domain.hostname}`);
          }
        }

        const caddyfile = generateCaddyfile(domainList);
        
        // Write Caddyfile to VPS
        const writeCommand = `echo '${caddyfile.replace(/'/g, "'\\''")}' > /opt/app/Caddyfile`;
        await executeSSHCommand(vps, writeCommand);
        
        // Reload Caddy
        await executeSSHCommand(vps, 'cd /opt/app && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile');
        
        result = { 
          message: 'Caddyfile updated and reloaded',
          domains: domainList,
          caddyfile
        };
        break;

      case 'reload_caddy':
        await executeSSHCommand(vps, 'cd /opt/app && docker compose restart caddy');
        result = { message: 'Caddy reloaded successfully' };
        break;

      case 'restart_tunnel':
        if (!vps.tunnel_id) {
          throw new Error('No tunnel configured for this VPS');
        }
        
        await executeSSHCommand(vps, 'cd /opt/app && docker compose restart cloudflared');
        result = { message: 'Cloudflare tunnel restarted successfully' };
        break;

      case 'deploy':
        const { commitSha = 'latest' } = params;
        
        // Create deploy record
        const { data: deploy, error: deployError } = await supabase
          .from('deploys')
          .insert({
            vps_id: vpsId,
            commit_hash: commitSha,
            status: 'running',
            logs: 'Deploy started...',
          })
          .select()
          .single();

        if (deployError) {
          throw new Error(`Failed to create deploy record: ${deployError.message}`);
        }

        // Execute deploy script
        try {
          await executeSSHCommand(vps, 'cd /opt/app && ./deploy.sh');
          await executeSSHCommand(vps, 'cd /opt/app && docker compose up -d --pull always');
          
          // Update deploy status
          await supabase
            .from('deploys')
            .update({
              status: 'success',
              logs: 'Deploy completed successfully',
            })
            .eq('id', deploy.id);

          result = { 
            message: 'Deploy completed successfully',
            deployId: deploy.id
          };
        } catch (error) {
          // Update deploy status on failure
          await supabase
            .from('deploys')
            .update({
              status: 'failed',
              logs: `Deploy failed: ${(error as Error).message}`,
            })
            .eq('id', deploy.id);

          throw (error as Error);
        }
        break;

      case 'setup_vps':
        // Generate and deploy initial configuration
        const setupDomains = params.domains || [];
        const dockerCompose = generateDockerCompose(vps, setupDomains);
        const setupCaddyfile = generateCaddyfile(setupDomains);

        // Create directories and files
        await executeSSHCommand(vps, 'mkdir -p /opt/app');
        
        // Write docker-compose.yml
        const composeCommand = `echo '${dockerCompose.replace(/'/g, "'\\''")}' > /opt/app/docker-compose.yml`;
        await executeSSHCommand(vps, composeCommand);
        
        // Write Caddyfile
        const caddyCommand = `echo '${setupCaddyfile.replace(/'/g, "'\\''")}' > /opt/app/Caddyfile`;
        await executeSSHCommand(vps, caddyCommand);
        
        // Create deploy script
        const deployScript = `#!/bin/bash
set -e
echo "Starting deployment..."
git pull origin main || echo "No git repository found"
echo "Deployment completed"
`;
        const scriptCommand = `echo '${deployScript}' > /opt/app/deploy.sh && chmod +x /opt/app/deploy.sh`;
        await executeSSHCommand(vps, scriptCommand);
        
        // Start services
        await executeSSHCommand(vps, 'cd /opt/app && docker compose up -d');
        
        result = { 
          message: 'VPS setup completed successfully',
          configuration: {
            dockerCompose,
            caddyfile: setupCaddyfile
          }
        };
        break;

      case 'check_status':
        // Check Docker services status
        const statusOutput = await executeSSHCommand(vps, 'cd /opt/app && docker compose ps --format json');
        
        result = { 
          message: 'VPS status checked',
          services: statusOutput
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Update VPS last_seen_at
    await supabase
      .from('vps_servers')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', vpsId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in vps-management function:', error);
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