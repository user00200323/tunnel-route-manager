import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, Server, Activity, RefreshCw, AlertTriangle, CheckCircle, Edit, Play, Pause } from "lucide-react";
import { Api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthStatusBadge } from "@/components/StatusBadge";
import { Copyable } from "@/components/Copyable";
import { toast } from "sonner";

export default function VpsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
  const { data: vps, isLoading: vpsLoading } = useQuery({
    queryKey: ['vps', id],
    queryFn: () => Api.getVps(id!),
    enabled: !!id
  });

  const { data: domains = [] } = useQuery({
    queryKey: ['domains', { vpsId: id }],
    queryFn: () => Api.listDomains({ search: id })
  });

  const runHealthCheckMutation = useMutation({
    mutationFn: () => Api.runHealthCheck(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vps', id] });
      toast.success("Health check executado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao executar health check");
    }
  });

  if (vpsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!vps) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">VPS não encontrada</h3>
          <p className="text-muted-foreground">
            A VPS solicitada não existe ou foi removida.
          </p>
        </CardContent>
      </Card>
    );
  }

  const connectedDomains = domains.filter(d => d.vps_id === vps.id);

  const StatCard = ({ title, value, icon: Icon, status }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        {status && (
          <div className="mt-2">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{vps.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <HealthStatusBadge status={vps.health} />
            <Badge variant="outline">{vps.provider}</Badge>
            {vps.region && (
              <Badge variant="outline">{vps.region}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => runHealthCheckMutation.mutate()}
            disabled={runHealthCheckMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${runHealthCheckMutation.isPending ? 'animate-spin' : ''}`} />
            Health Check
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Status Alert */}
      {vps.health === 'down' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este servidor está fora do ar. Verifique a conectividade e as configurações.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Status"
          value={vps.health}
          icon={Activity}
          status={<HealthStatusBadge status={vps.health} />}
        />
        <StatCard
          title="Provedor"
          value={vps.provider}
          icon={Server}
        />
        <StatCard
          title="Domínios"
          value={connectedDomains.length}
          icon={Globe}
        />
        <StatCard
          title="Uptime"
          value="99.5%"
          icon={CheckCircle}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Domínios</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Servidor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Nome</label>
                    <p className="text-sm text-muted-foreground">{vps.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">ID</label>
                    <Copyable value={vps.id} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Provedor</label>
                    <p className="text-sm text-muted-foreground">{vps.provider}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Região</label>
                    <p className="text-sm text-muted-foreground">{vps.region || 'N/A'}</p>
                  </div>
                  {vps.ipv4 && (
                    <div>
                      <label className="text-sm font-medium">IPv4</label>
                      <Copyable value={vps.ipv4} />
                    </div>
                  )}
                  {vps.ipv6 && (
                    <div>
                      <label className="text-sm font-medium">IPv6</label>
                      <Copyable value={vps.ipv6} />
                    </div>
                  )}
                  {vps.tunnel_id && (
                    <div>
                      <label className="text-sm font-medium">Tunnel ID</label>
                      <Copyable value={vps.tunnel_id} />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Criado em</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(vps.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Última atividade</label>
                    <p className="text-sm text-muted-foreground">
                      {vps.last_seen_at 
                        ? new Date(vps.last_seen_at).toLocaleString() 
                        : 'Nunca'
                      }
                    </p>
                  </div>
                </div>
                
                {vps.notes && (
                  <div>
                    <label className="text-sm font-medium">Notas</label>
                    <p className="text-sm text-muted-foreground">{vps.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full justify-start"
                  onClick={() => runHealthCheckMutation.mutate()}
                  disabled={runHealthCheckMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${runHealthCheckMutation.isPending ? 'animate-spin' : ''}`} />
                  Executar Health Check
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Play className="h-4 w-4 mr-2" />
                  Reiniciar Serviços
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar Monitoramento
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Activity className="h-4 w-4 mr-2" />
                  Ver Métricas
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domínios Conectados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {connectedDomains.map((domain) => (
                  <div key={domain.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Globe className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{domain.hostname}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{domain.status}</Badge>
                          <Badge variant="outline">{domain.type}</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Ver Detalhes
                    </Button>
                  </div>
                ))}
                {connectedDomains.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum domínio conectado a esta VPS.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Métricas de monitoramento não implementadas ainda.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log disponível.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}