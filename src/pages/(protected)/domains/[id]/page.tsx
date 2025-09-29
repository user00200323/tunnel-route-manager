import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, Server, Activity, RefreshCw, AlertTriangle, CheckCircle, Edit, Trash2, Route } from "lucide-react";
import { DeploySection } from "@/components/DeploySection";
import { DnsRecordsManager } from "@/components/DnsRecordsManager";
import { ConfigurationStatusSection } from "@/components/ConfigurationStatusSection";
import { Api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DomainStatusBadge, HealthStatusBadge } from "@/components/StatusBadge";
import { Copyable } from "@/components/Copyable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const { data: domain, isLoading: domainLoading } = useQuery({
    queryKey: ['domain', id],
    queryFn: () => Api.getDomain(id!),
    enabled: !!id
  });

  const { data: vpsData = [] } = useQuery({
    queryKey: ['vps'],
    queryFn: () => Api.listVps()
  });

  const checkDnsMutation = useMutation({
    mutationFn: () => Api.checkDns(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['domain', id] });
      if (result.ok) {
        toast.success("DNS check passou com sucesso!");
      } else {
        toast.error("DNS check falhou. Verifique as configurações.");
      }
    },
    onError: () => {
      toast.error("Erro ao realizar DNS check");
    }
  });

  const deleteDomainMutation = useMutation({
    mutationFn: () => Api.deleteDomain(id!),
    onSuccess: () => {
      toast.success("Domínio removido com sucesso!");
      window.history.back();
    },
    onError: () => {
      toast.error("Erro ao remover domínio");
    }
  });

  if (domainLoading) {
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

  if (!domain) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Domínio não encontrado</h3>
          <p className="text-muted-foreground">
            O domínio solicitado não existe ou foi removido.
          </p>
        </CardContent>
      </Card>
    );
  }

  const connectedVps = domain.vps_id ? vpsData.find(v => v.id === domain.vps_id) : null;

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
          <h2 className="text-3xl font-bold tracking-tight">{domain.hostname}</h2>
          <div className="flex items-center gap-2 mt-1">
            <DomainStatusBadge status={domain.status} />
            <Badge variant="outline">
              {domain.publish_strategy === 'dns' ? 'DNS' : 'Tunnel'}
            </Badge>
            <Badge variant="outline">
              {domain.type}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => checkDnsMutation.mutate()}
            disabled={checkDnsMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checkDnsMutation.isPending ? 'animate-spin' : ''}`} />
            Verificar DNS
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = `/domains/${id}/edit`}
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remover
          </Button>
        </div>
      </div>

      {/* Status Alert */}
      {domain.status === 'error' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {domain.error_message || 'Este domínio está com problemas. Verifique as configurações DNS.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Status"
          value={domain.status}
          icon={Globe}
          status={<DomainStatusBadge status={domain.status} />}
        />
        <StatCard
          title="Estratégia"
          value={domain.publish_strategy === 'dns' ? 'DNS' : 'Tunnel'}
          icon={Route}
        />
        <StatCard
          title="Tipo"
          value={domain.type}
          icon={Activity}
        />
        <StatCard
          title="Ativo"
          value={domain.active ? 'Sim' : 'Não'}
          icon={domain.active ? CheckCircle : AlertTriangle}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dns">Configuração DNS</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Configuration Status Section */}
          <Card>
            <CardHeader>
              <CardTitle>Status da Configuração</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigurationStatusSection domain={domain} connectedVps={connectedVps} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Domínio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Hostname</label>
                    <p className="text-sm text-muted-foreground font-mono">{domain.hostname}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">ID</label>
                    <p className="text-sm text-muted-foreground font-mono">{domain.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <p className="text-sm text-muted-foreground">{domain.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Estratégia</label>
                    <p className="text-sm text-muted-foreground">
                      {domain.publish_strategy === 'dns' ? 'DNS Direto' : 'Cloudflare Tunnel'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Criado em</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(domain.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Última verificação</label>
                    <p className="text-sm text-muted-foreground">
                      {domain.last_check_at 
                        ? new Date(domain.last_check_at).toLocaleString() 
                        : 'Nunca'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Servidor Conectado</CardTitle>
              </CardHeader>
              <CardContent>
                {connectedVps ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Server className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{connectedVps.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {connectedVps.provider} · {connectedVps.region || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <HealthStatusBadge status={connectedVps.health} />
                    </div>
                    {connectedVps.ipv4 && (
                      <div>
                        <label className="text-sm font-medium">IP Address</label>
                        <Copyable text={connectedVps.ipv4} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum servidor conectado.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <DeploySection domainId={id} vpsId={domain.vps_id} />
          </div>
        </TabsContent>

        <TabsContent value="dns" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuração DNS Recomendada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <label className="text-sm font-medium">Registro A</label>
                      <div className="text-sm text-muted-foreground">
                        {connectedVps?.ipv4 ? (
                          <Copyable text={`${domain.hostname} A ${connectedVps.ipv4}`} />
                        ) : (
                          'Nenhum IP configurado'
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Registro CNAME (www)</label>
                      <div className="text-sm text-muted-foreground">
                        <Copyable text={`www.${domain.hostname} CNAME ${domain.hostname}`} />
                      </div>
                    </div>

                    {domain.publish_strategy === 'tunnel' && (
                      <div>
                        <label className="text-sm font-medium">Túnel Cloudflare</label>
                        <div className="text-sm text-muted-foreground">
                          Configurado via Cloudflare Tunnel
                        </div>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={() => checkDnsMutation.mutate()}
                    disabled={checkDnsMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${checkDnsMutation.isPending ? 'animate-spin' : ''}`} />
                    Verificar Configuração DNS
                  </Button>
                </div>
              </CardContent>
            </Card>

            <DnsRecordsManager domainId={id!} hostname={domain.hostname} />
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Health checks não implementados ainda.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Atividade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log de atividade disponível.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Remover Domínio"
        description={`Tem certeza que deseja remover o domínio "${domain.hostname}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => deleteDomainMutation.mutate()}
        confirmText="Remover"
        variant="destructive"
      />
    </div>
  );
}