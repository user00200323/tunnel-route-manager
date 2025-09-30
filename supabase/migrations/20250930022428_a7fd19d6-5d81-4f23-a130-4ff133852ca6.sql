-- Manually update domains that should be associated with tunnels based on similarity to merlibre
-- All these domains appear to be variations of "merlibre" and should use the same tunnel

UPDATE domains 
SET 
    publish_strategy = 'tunnel',
    tunnel_id = '4126ee0c-df6b-41af-afb1-0b59310f1a24',
    vps_id = 'c527460b-91f5-4322-b1a8-17a78536053e'
WHERE hostname IN (
    'mercalbrr.shop',
    'mercalibr.shop', 
    'mercallbr.shop',
    'mercallbre.shop',
    'merclibre.shop',
    'mercliibre.shop',
    'mlibre.shop',
    'mllibre.shop'
) AND tunnel_id IS NULL;