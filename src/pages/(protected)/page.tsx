import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Globe, Server, Activity, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HealthPill } from "@/components/HealthPill";
import type { Domain, VPS } from "@/types";
import { Api } from "@/services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  
  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => Api.listDomains(),
  });

  const { data: vpsList = [], isLoading: vpsLoading } = useQuery({
    queryKey: ["vps"],
    queryFn: () => Api.listVps(),
  });

  const isLoading = domainsLoading || vpsLoading;

  const stats = {
    activeDomains: domains.filter(d => d.active).length,
    totalDomains: domains.length,
    healthyVps: vpsList.filter(v => v.health === "healthy").length,
    degradedVps: vpsList.filter(v => v.health === "degraded").length,
    downVps: vpsList.filter(v => v.health === "down").length,
    totalVps: vpsList.length,
    recentMoves: 0, // TODO: implement moves
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domínios Ativos</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {stats.activeDomains}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalDomains} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VPS Saudáveis</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {stats.healthyVps}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalVps} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status VPS</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {stats.degradedVps > 0 && (
                <Badge variant="warning" className="text-xs">
                  {stats.degradedVps} Degradado
                </Badge>
              )}
              {stats.downVps > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.downVps} Inativo
                </Badge>
              )}
              {stats.degradedVps === 0 && stats.downVps === 0 && (
                <Badge variant="success" className="text-xs">
                  Todas OK
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimentos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recentMoves}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 7 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button onClick={() => navigate("/domains/new")} className="flex-1 max-w-xs">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Domínio
        </Button>
        <Button 
          onClick={() => navigate("/vps/new")} 
          variant="outline"
          className="flex-1 max-w-xs"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar VPS
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* VPS Status */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Status das VPS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vpsList.map((vps) => (
              <div key={vps.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{vps.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {vps.tunnel_id}
                  </p>
                </div>
                <HealthPill status={vps.health as any} size="sm" />
              </div>
            ))}
            {vpsList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma VPS cadastrada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atividade recente
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}