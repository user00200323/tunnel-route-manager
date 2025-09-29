import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Globe, Server, Activity, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HealthPill } from "@/components/HealthPill";
import type { Domain, VPS, DomainMove } from "@/models";

// Mock data fetchers
const fetchDashboardStats = async () => {
  // Mock data fetching
  const domains = await import("@/mocks/domains.json");
  const vpsList = await import("@/mocks/vps.json");
  const moves = await import("@/mocks/moves.json");

  return {
    domains: domains.default,
    vpsList: vpsList.default,
    moves: moves.default.slice(0, 5), // últimos 5
    stats: {
      activeDomains: domains.default.filter(d => d.active).length,
      totalDomains: domains.default.length,
      healthyVps: vpsList.default.filter(v => v.status === "healthy").length,
      degradedVps: vpsList.default.filter(v => v.status === "degraded").length,
      downVps: vpsList.default.filter(v => v.status === "down").length,
      totalVps: vpsList.default.length,
      recentMoves: moves.default.length,
    },
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });

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

  const { stats, vpsList, moves } = data!;

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
                    {vps.tunnelId}
                  </p>
                </div>
                <HealthPill status={vps.status as any} size="sm" />
              </div>
            ))}
            {vpsList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma VPS cadastrada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Moves */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Últimos Movimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {moves.map((move) => (
              <div key={move.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">
                    Domínio movido
                  </p>
                  <Badge variant={move.ok ? "success" : "destructive"} className="text-xs">
                    {move.ok ? "Sucesso" : "Falha"}
                  </Badge>
                </div>
                {move.reason && (
                  <p className="text-xs text-muted-foreground">
                    {move.reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(move.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            {moves.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum movimento recente
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}