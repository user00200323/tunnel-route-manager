export type VPS = {
  id: string;                 // uuid
  name: string;               // "SFO-1 / VPS A"
  tunnelId: string;           // Cloudflare Tunnel ID
  status: "healthy" | "degraded" | "down";
  lastSeenAt?: string;        // ISO
  notes?: string;
};

export type Domain = {
  id: string;                 // uuid
  hostname: string;           // "mercallbr.shop"
  active: boolean;
  currentVpsId?: string;
  createdAt: string;          // ISO
};

export type DomainMove = {
  id: string;
  domainId: string;
  fromVpsId?: string;
  toVpsId: string;
  reason?: string;
  ok: boolean;
  createdAt: string;
};

export type HealthCheck = {
  vpsId: string;
  hostname?: string;          // opcional para check por domínio
  url: string;                // normalmente "http://caddy:80/health" (lado origem)
  status: number;             // 200 ok
  latencyMs: number;
  checkedAt: string;
};