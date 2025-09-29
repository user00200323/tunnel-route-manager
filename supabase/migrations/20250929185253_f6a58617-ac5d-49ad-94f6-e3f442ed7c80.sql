-- Adicionar campos faltantes na tabela vps_servers
ALTER TABLE public.vps_servers 
ADD COLUMN ssh_host inet,
ADD COLUMN ssh_user text;

-- Adicionar campos faltantes na tabela domains
ALTER TABLE public.domains 
ADD COLUMN www_alias boolean DEFAULT false,
ADD COLUMN fqdn text;

-- Atualizar fqdn baseado no hostname existente
UPDATE public.domains SET fqdn = hostname WHERE fqdn IS NULL;

-- Criar tabela dns_records para espelhar registros da Cloudflare
CREATE TABLE public.dns_records (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    content text NOT NULL,
    proxied boolean DEFAULT false,
    ttl integer,
    provider_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on dns_records
ALTER TABLE public.dns_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for dns_records
CREATE POLICY "Admin access to dns_records" 
ON public.dns_records 
FOR ALL 
USING (true);

-- Add trigger for updated_at on dns_records
CREATE TRIGGER update_dns_records_updated_at
    BEFORE UPDATE ON public.dns_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit trigger for dns_records
CREATE TRIGGER dns_records_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.dns_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_trail();

-- Update domains table to make fqdn required after data migration
ALTER TABLE public.domains 
ALTER COLUMN fqdn SET NOT NULL;