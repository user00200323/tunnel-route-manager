export type AppRole = 'admin' | 'operator' | 'viewer';

export type User = {
  id: string;
  email: string;
  name?: string;
  role: AppRole;
  tenantId?: string;
  createdAt: string;
  lastSeenAt?: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerId: string;
  settings?: {
    allowMultipleVps?: boolean;
    autoFailover?: boolean;
  };
};

export type VPS = {
  id: string;
  name: string;
  tenantId: string;
  provider: 'digitalocean' | 'aws' | 'gcp' | 'azure' | 'other';
  ipv4: string;
  ipv6?: string;
  region?: string;
  lastSeenAt?: string;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  metadata?: {
    instanceType?: string;
    cost?: number;
    tags?: string[];
  };
};

export type Domain = {
  id: string;
  fqdn: string;
  tenantId: string;
  type: 'apex' | 'www' | 'subdomain';
  publishStrategy: 'dns' | 'tunnel';
  vpsId?: string;
  tunnelId?: string;
  status: 'pending' | 'propagating' | 'live' | 'error';
  lastCheckAt?: string;
  errorMessage?: string;
  dnsProvider?: 'cloudflare' | 'route53' | 'other';
  createdAt: string;
  metadata?: {
    ssl?: boolean;
    wwwRedirect?: boolean;
  };
};

export type Tunnel = {
  id: string;
  name: string;
  tenantId: string;
  provider: 'cloudflared';
  tunnelToken?: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSeenAt?: string;
  connectorId?: string;
  metadata?: {
    version?: string;
    location?: string;
  };
};

export type Deploy = {
  id: string;
  tenantId: string;
  domainId?: string;
  vpsId: string;
  triggeredBy: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  commit?: string;
  logs?: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
};

export type AuditLog = {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: 'domain' | 'vps' | 'tunnel' | 'user' | 'tenant';
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
};

export type HealthCheck = {
  id: string;
  vpsId: string;
  domainId?: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastCheckAt: string;
  errorMessage?: string;
};

// API Response types
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

// Filter types
export type DomainFilters = {
  tenantId?: string;
  status?: Domain['status'];
  publishStrategy?: Domain['publishStrategy'];
  search?: string;
  page?: number;
  limit?: number;
};

export type VpsFilters = {
  tenantId?: string;
  provider?: VPS['provider'];
  health?: VPS['health'];
  search?: string;
  page?: number;
  limit?: number;
};

export type DeployFilters = {
  tenantId?: string;
  status?: Deploy['status'];
  triggeredBy?: string;
  page?: number;
  limit?: number;
};