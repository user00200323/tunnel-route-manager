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
  active?: boolean;
  page?: number;
  pageSize?: number;
};