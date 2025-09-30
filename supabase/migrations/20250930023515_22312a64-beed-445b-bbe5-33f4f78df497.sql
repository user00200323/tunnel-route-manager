-- Add cf_tunnel_id column to tunnels table and create proper constraints
ALTER TABLE tunnels ADD COLUMN IF NOT EXISTS cf_tunnel_id TEXT;

-- Create unique index for cf_tunnel_id
CREATE UNIQUE INDEX IF NOT EXISTS ux_tunnels_cf_tunnel_id ON tunnels(cf_tunnel_id);

-- Update domains FK to reference tunnels.id (UUID local) properly
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_tunnel_id_fkey;
ALTER TABLE domains
  ADD CONSTRAINT domains_tunnel_id_fkey
  FOREIGN KEY (tunnel_id) REFERENCES tunnels(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Add coherency constraint between strategy and tunnel_id
ALTER TABLE domains DROP CONSTRAINT IF EXISTS ck_domains_strategy_tunnel;
ALTER TABLE domains ADD CONSTRAINT ck_domains_strategy_tunnel
CHECK (
  (publish_strategy = 'dns' AND tunnel_id IS NULL)
  OR
  (publish_strategy = 'tunnel' AND tunnel_id IS NOT NULL)
);

-- Ensure domains with tunnel_id have correct strategy
UPDATE domains SET publish_strategy = 'tunnel'
WHERE tunnel_id IS NOT NULL AND publish_strategy != 'tunnel';