// API request/response types
export type Page<T> = { 
  items: T[]; 
  total: number; 
};

export type MoveDomainRequest = {
  toVpsId: string;
  reason?: string;
  checkFirst?: boolean;
};

export type HealthCheckRequest = {
  vpsId: string;
  hostname?: string;
};

export type DomainFilters = {
  query?: string;
  vpsId?: string;
  domainId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
};

export type DeployFilters = {
  vpsId?: string;
  domainId?: string;
  status?: 'pending' | 'running' | 'success' | 'failed';
  page?: number;
  pageSize?: number;
};

export type AutoConfigurationResult = {
  domain: string;
  strategy: string;
  steps: Array<{ step: string; status: string; error?: string }>;
  success: boolean;
  errors: string[];
};