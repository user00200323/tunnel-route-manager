import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Globe, 
  Activity, 
  Settings, 
  History,
  ArrowRight
} from "lucide-react";
import { HealthPill } from "@/components/HealthPill";
import { Copyable } from "@/components/Copyable";
import type { Domain, VPS, DomainMove, HealthCheck } from "@/models";

const fetchDomainDetails = async (id: string) => {
  // Mock implementation
  const domains = await import("@/mocks/domains.json");
  const vpsList = await import("@/mocks/vps.json");
  const moves = await import("@/mocks/moves.json");
  const checks = await import("@/mocks/checks.json");
  
  const domain = domains.default.find(d => d.id === id);
  if (!domain) throw new Error("Domínio não encontrado");
  
  const domainMoves = moves.default.filter(m => m.domainId === id);
  const domainChecks = checks.default.filter(c => c.hostname === domain.hostname);
  
  return {
    domain,
    vpsList: vpsList.default,
    moves: domainMoves,
    checks: domainChecks,
  };
};

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["domain", id],
    queryFn: () => fetchDomainDetails(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Domínio não encontrado</h3>
        <Button onClick={() => navigate("/domains")}>
          Voltar para Domínios
        </Button>
      </div>
    );
  }

  const { domain, vpsList, moves, checks } = data;
  const currentVps = domain.currentVpsId 
    ? vpsList.find(v => v.id === domain.currentVpsId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/domains")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold">{domain.hostname}</h1>
                    <Badge variant={domain.active ? "default" : "outline"}>
                      {domain.active ? "Ativo" : "Inativo"}
                    </Badge>
                    {currentVps && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">em</span>
                        <Badge variant="outline">{currentVps.name}</Badge>
                        <HealthPill status={currentVps.status as any} size="sm" />
                      </div>
                    )}
          </div>
          <p className="text-muted-foreground">
            Criado em {new Date(domain.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Button>
          <ArrowRight className="h-4 w-4 mr-2" />
          Mover Domínio
        </Button>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current VPS */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    VPS Atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentVps ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{currentVps.name}</h3>
                          <Copyable 
                            text={currentVps.tunnelId} 
                            label="Tunnel ID"
                            className="mt-2"
                          />
                        </div>
                        <HealthPill status={currentVps.status as any} />
                      </div>
                      
                      {currentVps.lastSeenAt && (
                        <p className="text-sm text-muted-foreground">
                          Último heartbeat: {" "}
                          {new Date(currentVps.lastSeenAt).toLocaleString("pt-BR")}
                        </p>
                      )}

                      {currentVps.notes && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <h4 className="text-sm font-medium mb-1">Notas</h4>
                          <p className="text-sm text-muted-foreground">
                            {currentVps.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhuma VPS configurada</p>
                      <Button className="mt-3" size="sm">
                        Configurar VPS
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Health Checks */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Últimos Health Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checks.length > 0 ? (
                    <div className="space-y-3">
                      {checks.slice(0, 5).map((check, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">
                              Status {check.status}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(check.checkedAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={check.status === 200 ? "success" : "destructive"}>
                              {check.latencyMs}ms
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum health check realizado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Mover Domínio
                  </Button>
                  
                  <Button className="w-full" variant="outline">
                    <Activity className="h-4 w-4 mr-2" />
                    Rodar Health Check
                  </Button>
                  
                  <Button className="w-full" variant="outline">
                    Purgar Cache CF
                  </Button>
                  
                  <Button 
                    className="w-full" 
                    variant={domain.active ? "destructive" : "default"}
                  >
                    {domain.active ? "Desativar" : "Ativar"} Domínio
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Moves */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {moves.length > 0 ? (
                    <div className="space-y-3">
                      {moves.slice(0, 3).map((move) => (
                        <div key={move.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Movimento</span>
                            <Badge variant={move.ok ? "success" : "destructive"} className="text-xs">
                              {move.ok ? "Sucesso" : "Falha"}
                            </Badge>
                          </div>
                          {move.reason && (
                            <p className="text-muted-foreground mt-1">
                              {move.reason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(move.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum movimento registrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações do Domínio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Status</h4>
                <div className="flex items-center gap-4">
                  <Badge variant={domain.active ? "success" : "outline"}>
                    {domain.active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button variant="outline" size="sm">
                    {domain.active ? "Desativar" : "Ativar"} Domínio
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Cache Cloudflare</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Limpe o cache do Cloudflare para este domínio
                </p>
                <Button variant="outline" size="sm">
                  Purgar Cache
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Zona de Perigo</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Remover este domínio permanentemente do sistema
                </p>
                <Button variant="destructive" size="sm">
                  Deletar Domínio
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}