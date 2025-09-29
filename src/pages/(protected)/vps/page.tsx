import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Server, Activity, RefreshCw } from "lucide-react";
import { HealthPill } from "@/components/HealthPill";
import { Copyable } from "@/components/Copyable";
import type { VPS, Domain } from "@/types";
import { Api } from "@/services/api";

export default function VpsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  
  const { data: allVps = [], isLoading: vpsLoading, refetch } = useQuery({
    queryKey: ["vps"],
    queryFn: () => Api.listVps(),
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => Api.listDomains(),
  });

  const isLoading = vpsLoading || domainsLoading;

  // Filter VPS based on query and add domain count
  const vpsList = allVps
    .filter(vps => {
      if (!query) return true;
      return vps.name.toLowerCase().includes(query.toLowerCase()) ||
             (vps.tunnel_id && vps.tunnel_id.toLowerCase().includes(query.toLowerCase()));
    })
    .map(vps => ({
      ...vps,
      domainCount: domains.filter(d => d.vps_id === vps.id).length
    }));

  const handleRefreshAll = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const healthyCount = vpsList?.filter(v => v.health === "healthy").length || 0;
  const degradedCount = vpsList?.filter(v => v.health === "degraded").length || 0;
  const downCount = vpsList?.filter(v => v.health === "down").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">VPS</h1>
          <p className="text-muted-foreground">
            Gerencie seus servidores e túneis Cloudflare
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reverificar Todos
          </Button>
          <Button onClick={() => navigate("/vps/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Nova VPS
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-sm font-medium">Saudáveis</span>
            </div>
            <p className="text-2xl font-bold mt-1">{healthyCount}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <span className="text-sm font-medium">Degradadas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{degradedCount}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span className="text-sm font-medium">Inativas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{downCount}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{vpsList?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou tunnel ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* VPS Grid */}
      {vpsList && vpsList.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="text-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma VPS encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando sua primeira VPS
            </p>
            <Button onClick={() => navigate("/vps/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar VPS
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vpsList?.map((vps) => (
            <Card 
              key={vps.id} 
              className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
              onClick={() => navigate(`/vps/${vps.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{vps.name}</CardTitle>
                  <HealthPill status={vps.health as any} size="sm" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Copyable 
                  text={vps.tunnel_id || 'N/A'} 
                  label="Tunnel ID"
                />
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Domínios:</span>
                  <Badge variant="outline">
                    {(vps as any).domainCount}
                  </Badge>
                </div>
                
                {vps.last_seen_at && (
                  <div className="text-xs text-muted-foreground">
                    Último heartbeat: {" "}
                    {new Date(vps.last_seen_at).toLocaleString("pt-BR")}
                  </div>
                )}
                
                {vps.notes && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {vps.notes}
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Health check action
                    }}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Check
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/vps/${vps.id}`);
                    }}
                  >
                    Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}