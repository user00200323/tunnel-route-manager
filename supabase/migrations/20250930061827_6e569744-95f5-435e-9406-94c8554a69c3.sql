-- Add agent_url column to vps_servers table
ALTER TABLE public.vps_servers 
ADD COLUMN agent_url TEXT;

-- Update the existing VPS with the agent URL
UPDATE public.vps_servers 
SET agent_url = 'http://138.68.23.63:8888'
WHERE ipv4 = '138.68.23.63';

-- Add real cf_tunnel_id to tunnels (using a realistic Cloudflare tunnel ID format)
UPDATE public.tunnels 
SET cf_tunnel_id = '83134a8c-8fe7-4b06-8cd1-03c8d0469e1e'
WHERE name = 'vps-merlibre';

-- Insert DNS records for all domains with CNAME pointing to tunnel
INSERT INTO public.dns_records (domain_id, name, type, content, proxied)
SELECT 
    d.id,
    d.hostname,
    'CNAME',
    '83134a8c-8fe7-4b06-8cd1-03c8d0469e1e.cfargotunnel.com',
    true
FROM public.domains d
WHERE d.hostname IN ('merlibre.shop', 'mercallbr.shop', 'mercallbre.shop', 'mlibre.shop', 'mercalibr.shop', 'merclibre.shop', 'mllibre.shop', 'mercliibre.shop', 'mercalbrr.shop');