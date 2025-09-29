import type {
  Tenant,
  VPS,
  Domain,
  Tunnel,
  Deploy,
  AuditLog,
  HealthCheck,
  User,
  ApiResponse,
  PaginatedResponse,
  DomainFilters,
  VpsFilters,
  DeployFilters,
} from '@/types';

// Mock data - will be replaced with real API calls
const mockTenants: Tenant[] = [
  {
    id: '1',
    name: 'Acme Corp',
    slug: 'acme',
    createdAt: '2024-01-01T00:00:00Z',
    ownerId: 'user1',
  },
];

const mockVPS: VPS[] = [
  {
    id: '1',
    name: 'SFO-1',
    tenantId: '1',
    provider: 'digitalocean',
    ipv4: '138.197.123.45',
    region: 'sfo3',
    health: 'healthy',
    lastSeenAt: '2024-01-15T10:30:00Z',
  },
];

const mockDomains: Domain[] = [
  {
    id: '1',
    fqdn: 'example.com',
    tenantId: '1',
    type: 'apex',
    publishStrategy: 'dns',
    vpsId: '1',
    status: 'live',
    createdAt: '2024-01-01T00:00:00Z',
    lastCheckAt: '2024-01-15T10:30:00Z',
  },
];

const mockTunnels: Tunnel[] = [
  {
    id: '1',
    name: 'tunnel-sfo-1',
    tenantId: '1',
    provider: 'cloudflared',
    status: 'connected',
    lastSeenAt: '2024-01-15T10:30:00Z',
  },
];

const mockDeploys: Deploy[] = [
  {
    id: '1',
    tenantId: '1',
    vpsId: '1',
    triggeredBy: 'user1',
    status: 'success',
    startedAt: '2024-01-15T10:00:00Z',
    finishedAt: '2024-01-15T10:02:30Z',
    duration: 150,
  },
];

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const Api = {
  // Tenants
  listTenants: async (): Promise<ApiResponse<Tenant[]>> => {
    await delay(500);
    return { data: mockTenants, success: true };
  },

  getTenant: async (id: string): Promise<ApiResponse<Tenant>> => {
    await delay(300);
    const tenant = mockTenants.find(t => t.id === id);
    if (!tenant) throw new Error('Tenant not found');
    return { data: tenant, success: true };
  },

  createTenant: async (payload: Partial<Tenant>): Promise<ApiResponse<Tenant>> => {
    await delay(800);
    const newTenant: Tenant = {
      id: Math.random().toString(36).substr(2, 9),
      name: payload.name || '',
      slug: payload.slug || '',
      createdAt: new Date().toISOString(),
      ownerId: payload.ownerId || '',
      ...payload,
    };
    mockTenants.push(newTenant);
    return { data: newTenant, success: true };
  },

  // Domains
  listDomains: async (filters?: DomainFilters): Promise<PaginatedResponse<Domain>> => {
    await delay(600);
    let filtered = [...mockDomains];
    
    if (filters?.tenantId) {
      filtered = filtered.filter(d => d.tenantId === filters.tenantId);
    }
    if (filters?.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }
    if (filters?.search) {
      filtered = filtered.filter(d => 
        d.fqdn.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      data: {
        items,
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      },
      success: true,
    };
  },

  getDomain: async (id: string): Promise<ApiResponse<Domain>> => {
    await delay(300);
    const domain = mockDomains.find(d => d.id === id);
    if (!domain) throw new Error('Domain not found');
    return { data: domain, success: true };
  },

  createDomain: async (payload: Partial<Domain>): Promise<ApiResponse<Domain>> => {
    await delay(1000);
    const newDomain: Domain = {
      id: Math.random().toString(36).substr(2, 9),
      fqdn: payload.fqdn || '',
      tenantId: payload.tenantId || '',
      type: payload.type || 'apex',
      publishStrategy: payload.publishStrategy || 'dns',
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...payload,
    };
    mockDomains.push(newDomain);
    return { data: newDomain, success: true };
  },

  updateDomain: async (id: string, payload: Partial<Domain>): Promise<ApiResponse<Domain>> => {
    await delay(800);
    const index = mockDomains.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Domain not found');
    
    mockDomains[index] = { ...mockDomains[index], ...payload };
    return { data: mockDomains[index], success: true };
  },

  deleteDomain: async (id: string): Promise<ApiResponse<void>> => {
    await delay(500);
    const index = mockDomains.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Domain not found');
    
    mockDomains.splice(index, 1);
    return { data: undefined, success: true };
  },

  checkDns: async (domainId: string): Promise<ApiResponse<{ ok: boolean; details: any }>> => {
    await delay(2000);
    return {
      data: {
        ok: Math.random() > 0.3,
        details: {
          aRecord: '138.197.123.45',
          aaaa: null,
          cname: null,
          mx: [],
          txt: [],
        },
      },
      success: true,
    };
  },

  // VPS
  listVps: async (filters?: VpsFilters): Promise<PaginatedResponse<VPS>> => {
    await delay(500);
    let filtered = [...mockVPS];
    
    if (filters?.tenantId) {
      filtered = filtered.filter(v => v.tenantId === filters.tenantId);
    }
    if (filters?.health) {
      filtered = filtered.filter(v => v.health === filters.health);
    }
    if (filters?.search) {
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      data: {
        items,
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      },
      success: true,
    };
  },

  getVps: async (id: string): Promise<ApiResponse<VPS>> => {
    await delay(300);
    const vps = mockVPS.find(v => v.id === id);
    if (!vps) throw new Error('VPS not found');
    return { data: vps, success: true };
  },

  createVps: async (payload: Partial<VPS>): Promise<ApiResponse<VPS>> => {
    await delay(1200);
    const newVps: VPS = {
      id: Math.random().toString(36).substr(2, 9),
      name: payload.name || '',
      tenantId: payload.tenantId || '',
      provider: payload.provider || 'other',
      ipv4: payload.ipv4 || '',
      health: 'unknown',
      ...payload,
    };
    mockVPS.push(newVps);
    return { data: newVps, success: true };
  },

  assignRoute: async (domainId: string, vpsId: string): Promise<ApiResponse<void>> => {
    await delay(1000);
    const domainIndex = mockDomains.findIndex(d => d.id === domainId);
    if (domainIndex === -1) throw new Error('Domain not found');
    
    mockDomains[domainIndex].vpsId = vpsId;
    mockDomains[domainIndex].status = 'propagating';
    
    return { data: undefined, success: true };
  },

  // Tunnels
  listTunnels: async (tenantId?: string): Promise<ApiResponse<Tunnel[]>> => {
    await delay(400);
    let filtered = [...mockTunnels];
    if (tenantId) {
      filtered = filtered.filter(t => t.tenantId === tenantId);
    }
    return { data: filtered, success: true };
  },

  restartTunnel: async (tunnelId: string): Promise<ApiResponse<void>> => {
    await delay(3000);
    const tunnel = mockTunnels.find(t => t.id === tunnelId);
    if (!tunnel) throw new Error('Tunnel not found');
    
    tunnel.status = 'connected';
    tunnel.lastSeenAt = new Date().toISOString();
    
    return { data: undefined, success: true };
  },

  // Deploys
  listDeploys: async (filters?: DeployFilters): Promise<PaginatedResponse<Deploy>> => {
    await delay(600);
    let filtered = [...mockDeploys];
    
    if (filters?.tenantId) {
      filtered = filtered.filter(d => d.tenantId === filters.tenantId);
    }
    if (filters?.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      data: {
        items,
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      },
      success: true,
    };
  },

  triggerDeploy: async (vpsId: string, options?: { commit?: string }): Promise<ApiResponse<Deploy>> => {
    await delay(800);
    const newDeploy: Deploy = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: '1', // Would come from context
      vpsId,
      triggeredBy: 'current-user', // Would come from auth
      status: 'pending',
      commit: options?.commit,
      startedAt: new Date().toISOString(),
    };
    mockDeploys.push(newDeploy);
    return { data: newDeploy, success: true };
  },

  // Health checks
  runHealthCheck: async (vpsId: string): Promise<ApiResponse<HealthCheck[]>> => {
    await delay(2000);
    const checks: HealthCheck[] = [
      {
        id: '1',
        vpsId,
        url: 'http://localhost:80/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        status: Math.random() > 0.2 ? 'healthy' : 'down',
        responseTime: Math.floor(Math.random() * 1000) + 50,
        lastCheckAt: new Date().toISOString(),
      },
    ];
    return { data: checks, success: true };
  },

  // Audit logs
  getAuditLogs: async (tenantId?: string): Promise<ApiResponse<AuditLog[]>> => {
    await delay(500);
    const logs: AuditLog[] = [
      {
        id: '1',
        tenantId: tenantId || '1',
        userId: 'user1',
        action: 'domain.created',
        resource: 'domain',
        resourceId: '1',
        newValue: { fqdn: 'example.com' },
        timestamp: new Date().toISOString(),
      },
    ];
    return { data: logs, success: true };
  },
};