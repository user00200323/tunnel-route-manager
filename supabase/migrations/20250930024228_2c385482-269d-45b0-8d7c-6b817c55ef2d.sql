-- Step 1: Fix the schema inconsistency by migrating data and restructuring columns

-- First, let's see what we have in the tables to understand the data structure
-- Copy existing tunnel_id values to cf_tunnel_id where it's null
UPDATE tunnels 
SET cf_tunnel_id = tunnel_id 
WHERE cf_tunnel_id IS NULL AND tunnel_id IS NOT NULL;

-- Drop the existing unique constraint on tunnel_id
ALTER TABLE tunnels DROP CONSTRAINT IF EXISTS tunnels_tunnel_id_key;

-- Rename tunnel_id to external_tunnel_id temporarily
ALTER TABLE tunnels RENAME COLUMN tunnel_id TO external_tunnel_id;

-- Rename cf_tunnel_id to tunnel_id (this will be the Cloudflare tunnel ID)
ALTER TABLE tunnels RENAME COLUMN cf_tunnel_id TO tunnel_id;

-- Make the new tunnel_id nullable and add unique constraint
ALTER TABLE tunnels ALTER COLUMN tunnel_id DROP NOT NULL;
ALTER TABLE tunnels ADD CONSTRAINT tunnels_tunnel_id_unique UNIQUE (tunnel_id);

-- Add a new cf_tunnel_id column for future compatibility (nullable)
ALTER TABLE tunnels ADD COLUMN cf_tunnel_id TEXT;

-- Since domains.tunnel_id might be text and we need to map to tunnels.id (UUID)
-- Let's update domains to reference the correct tunnel records
-- First, add a new column for the UUID reference
ALTER TABLE domains ADD COLUMN new_tunnel_id UUID;

-- Update domains to reference tunnels.id based on the external_tunnel_id match
UPDATE domains 
SET new_tunnel_id = t.id
FROM tunnels t 
WHERE t.external_tunnel_id = domains.tunnel_id::text;

-- Drop old tunnel_id column and rename new one
ALTER TABLE domains DROP COLUMN tunnel_id;
ALTER TABLE domains RENAME COLUMN new_tunnel_id TO tunnel_id;

-- Add foreign key constraint
ALTER TABLE domains ADD CONSTRAINT fk_domains_tunnel_id 
FOREIGN KEY (tunnel_id) REFERENCES tunnels(id);

-- Now we can drop the external_tunnel_id column as it's no longer needed
ALTER TABLE tunnels DROP COLUMN external_tunnel_id;