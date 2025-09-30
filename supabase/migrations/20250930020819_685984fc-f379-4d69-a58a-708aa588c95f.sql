-- Fix VPS-Tunnel associations and domain configurations (corrected)
-- Step 1: Associate Default VPS with the vps-merlibre tunnel 
UPDATE vps_servers 
SET tunnel_id = '83134a8c-8fe7-4b06-8cd1-03c8d0469e1e'
WHERE name = 'Default VPS';

-- Step 2: First, let's check the constraint - it enforces that tunnel strategy means NO vps_id
-- So we need to either:
-- a) Change constraint to allow both vps_id and tunnel_id for tunnel strategy
-- b) Keep domains with DNS strategy but ensure they have proper tunnel linking

-- Let's modify the constraint to allow both vps_id and tunnel_id for tunnel strategy
ALTER TABLE domains DROP CONSTRAINT IF EXISTS valid_publish_strategy;

-- Add new constraint that allows more flexible configurations
ALTER TABLE domains ADD CONSTRAINT valid_publish_strategy_flexible 
CHECK (
  (publish_strategy = 'dns' AND vps_id IS NOT NULL) OR
  (publish_strategy = 'tunnel' AND tunnel_id IS NOT NULL)
);

-- Step 3: Now update domains that should use tunnel strategy
-- Only merlibre.shop should remain as tunnel, others should stay DNS but get proper tunnel associations
UPDATE domains 
SET vps_id = 'c527460b-91f5-4322-b1a8-17a78536053e',
    updated_at = now()
WHERE hostname = 'merlibre.shop' 
  AND tunnel_id = '4126ee0c-df6b-41af-afb1-0b59310f1a24';

-- Step 4: Create a function to automatically sync VPS health checks
CREATE OR REPLACE FUNCTION public.update_vps_health_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Update VPS last_seen_at when health check is performed
    UPDATE vps_servers 
    SET last_seen_at = NEW.checked_at,
        health = CASE 
            WHEN NEW.status_code BETWEEN 200 AND 299 THEN 'healthy'::health_status
            WHEN NEW.status_code BETWEEN 400 AND 499 THEN 'warning'::health_status
            ELSE 'critical'::health_status
        END
    WHERE id = NEW.vps_id;
    
    RETURN NEW;
END;
$function$;

-- Step 5: Create trigger for automatic VPS health updates
DROP TRIGGER IF EXISTS trigger_update_vps_health ON health_checks;
CREATE TRIGGER trigger_update_vps_health
    AFTER INSERT ON health_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_vps_health_status();

-- Step 6: Add index for better performance on health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_vps_id ON health_checks(vps_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_domain_id ON health_checks(domain_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at DESC);

-- Step 7: Create function to get domain health summary
CREATE OR REPLACE FUNCTION public.get_domain_health_summary(domain_uuid uuid)
RETURNS TABLE (
    latest_status_code integer,
    latest_latency_ms integer,
    latest_check timestamp with time zone,
    avg_latency_24h numeric,
    uptime_percentage_24h numeric
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT 
        hc_latest.status_code as latest_status_code,
        hc_latest.latency_ms as latest_latency_ms,
        hc_latest.checked_at as latest_check,
        AVG(hc_24h.latency_ms) as avg_latency_24h,
        (COUNT(CASE WHEN hc_24h.status_code BETWEEN 200 AND 299 THEN 1 END) * 100.0 / COUNT(*)) as uptime_percentage_24h
    FROM health_checks hc_latest
    LEFT JOIN health_checks hc_24h ON hc_24h.domain_id = domain_uuid 
        AND hc_24h.checked_at >= NOW() - INTERVAL '24 hours'
    WHERE hc_latest.domain_id = domain_uuid
        AND hc_latest.checked_at = (
            SELECT MAX(checked_at) 
            FROM health_checks 
            WHERE domain_id = domain_uuid
        )
    GROUP BY hc_latest.status_code, hc_latest.latency_ms, hc_latest.checked_at;
$function$;