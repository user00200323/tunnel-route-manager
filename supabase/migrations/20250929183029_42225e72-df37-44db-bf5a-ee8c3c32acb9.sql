-- Create enums for various status types
CREATE TYPE health_status AS ENUM ('healthy', 'degraded', 'down', 'unknown');
CREATE TYPE domain_status AS ENUM ('pending', 'propagating', 'live', 'error');
CREATE TYPE deploy_status AS ENUM ('pending', 'running', 'success', 'failed');
CREATE TYPE tunnel_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE publish_strategy AS ENUM ('dns', 'tunnel');
CREATE TYPE domain_type AS ENUM ('apex', 'www', 'custom');
CREATE TYPE vps_provider AS ENUM ('digitalocean', 'aws', 'linode', 'vultr', 'other');

-- Create tenants table
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create VPS servers table
CREATE TABLE public.vps_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider vps_provider DEFAULT 'other',
    tunnel_id TEXT,
    ipv4 INET,
    ipv6 INET,
    region TEXT,
    health health_status DEFAULT 'unknown',
    last_seen_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tunnels table
CREATE TABLE public.tunnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    provider TEXT DEFAULT 'cloudflared',
    status tunnel_status DEFAULT 'disconnected',
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create domains table
CREATE TABLE public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    type domain_type DEFAULT 'apex',
    publish_strategy publish_strategy DEFAULT 'dns',
    vps_id UUID REFERENCES public.vps_servers(id) ON DELETE SET NULL,
    tunnel_id UUID REFERENCES public.tunnels(id) ON DELETE SET NULL,
    status domain_status DEFAULT 'pending',
    active BOOLEAN DEFAULT true,
    last_check_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT unique_hostname UNIQUE (hostname),
    CONSTRAINT valid_publish_strategy CHECK (
        (publish_strategy = 'dns' AND vps_id IS NOT NULL AND tunnel_id IS NULL) OR
        (publish_strategy = 'tunnel' AND tunnel_id IS NOT NULL AND vps_id IS NULL)
    )
);

-- Create deploys table
CREATE TABLE public.deploys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    vps_id UUID REFERENCES public.vps_servers(id) ON DELETE SET NULL,
    commit_hash TEXT,
    status deploy_status DEFAULT 'pending',
    logs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create health checks table
CREATE TABLE public.health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vps_id UUID REFERENCES public.vps_servers(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_health_checks_vps_id ON public.health_checks (vps_id);
CREATE INDEX idx_health_checks_domain_id ON public.health_checks (domain_id);
CREATE INDEX idx_health_checks_checked_at ON public.health_checks (checked_at);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at);

-- Enable Row Level Security on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vps_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tunnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deploys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin-only access
CREATE POLICY "Admin access to tenants" ON public.tenants FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to vps_servers" ON public.vps_servers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to tunnels" ON public.tunnels FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to domains" ON public.domains FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to deploys" ON public.deploys FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to health_checks" ON public.health_checks FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin access to audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vps_servers_updated_at BEFORE UPDATE ON public.vps_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tunnels_updated_at BEFORE UPDATE ON public.tunnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON public.domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deploys_updated_at BEFORE UPDATE ON public.deploys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log audit trail
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();
CREATE TRIGGER audit_vps_servers AFTER INSERT OR UPDATE OR DELETE ON public.vps_servers FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();
CREATE TRIGGER audit_tunnels AFTER INSERT OR UPDATE OR DELETE ON public.tunnels FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();
CREATE TRIGGER audit_domains AFTER INSERT OR UPDATE OR DELETE ON public.domains FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();
CREATE TRIGGER audit_deploys AFTER INSERT OR UPDATE OR DELETE ON public.deploys FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Insert some sample data
INSERT INTO public.tenants (name) VALUES 
    ('Projeto Alpha'),
    ('Projeto Beta'),
    ('Projeto Gamma');

INSERT INTO public.vps_servers (name, provider, tunnel_id, ipv4, region, health) VALUES
    ('SFO-1 / VPS A', 'digitalocean', 'tunnel-abc123', '159.89.123.45', 'San Francisco', 'healthy'),
    ('NYC-1 / VPS B', 'aws', 'tunnel-def456', '54.196.78.90', 'New York', 'degraded'),
    ('LON-1 / VPS C', 'linode', 'tunnel-ghi789', '139.162.45.67', 'London', 'down');

INSERT INTO public.tunnels (tunnel_id, name, status) VALUES
    ('tunnel-abc123', 'SFO Tunnel', 'connected'),
    ('tunnel-def456', 'NYC Tunnel', 'connected'),
    ('tunnel-ghi789', 'LON Tunnel', 'disconnected');

-- Insert domains with correct reference structure
INSERT INTO public.domains (hostname, tenant_id, publish_strategy, vps_id, status, active) VALUES
    ('example.com', (SELECT id FROM public.tenants WHERE name = 'Projeto Alpha'), 'dns', (SELECT id FROM public.vps_servers WHERE name = 'SFO-1 / VPS A'), 'live', true),
    ('test.com', (SELECT id FROM public.tenants WHERE name = 'Projeto Beta'), 'dns', (SELECT id FROM public.vps_servers WHERE name = 'NYC-1 / VPS B'), 'propagating', true);

INSERT INTO public.domains (hostname, tenant_id, publish_strategy, tunnel_id, status, active) VALUES
    ('demo.org', (SELECT id FROM public.tenants WHERE name = 'Projeto Gamma'), 'tunnel', (SELECT id FROM public.tunnels WHERE tunnel_id = 'tunnel-ghi789'), 'error', false);