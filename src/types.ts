// User and Role types
export type AppRole = 'admin';

export type User = {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
};

// Core Entity Types
export type Tenant = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type VPS = {
  id: string;
  name: string;
  provider: 'digitalocean' | 'aws' | 'linode' | 'vultr' | 'other';
  tunnel_id?: string;
  ipv4?: string;
  ipv6?: string;
  region?: string;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  last_seen_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Domain = {
  id: string;
  hostname: string;
  fqdn?: string;
  tenant_id: string;
  type: 'apex' | 'www' | 'custom';
  publish_strategy: 'dns' | 'tunnel';
  vps_id?: string;
  tunnel_id?: string;
  status: 'pending' | 'propagating' | 'live' | 'error';
  active: boolean;
  created_at: string;
  updated_at: string;
  last_check_at?: string;
  error_message?: string;
};

export type Tunnel = {
  id: string;
  tunnel_id: string;
  name: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
};

export type Deploy = {
  id: string;
  tenant_id: string;
  domain_id?: string;
  vps_id?: string;
  commit_hash?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  logs?: string;
  created_at: string;
  updated_at: string;
};

export type HealthCheck = {
  id: string;
  vps_id: string;
  domain_id?: string;
  url: string;
  status_code?: number;
  latency_ms?: number;
  checked_at: string;
};

export type AuditLog = {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

// API Response Types
export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
};

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

// Filter Types for API queries
export type DomainFilters = {
  tenantId?: string;
  status?: Domain['status'];
  search?: string;
  page?: number;
  limit?: number;
};

export type VpsFilters = {
  tenantId?: string;
  health?: VPS['health'];
  provider?: VPS['provider'];
  search?: string;
  page?: number;
  limit?: number;
};

export type DeployFilters = {
  tenantId?: string;
  vpsId?: string;
  status?: Deploy['status'];
  page?: number;
  limit?: number;
};