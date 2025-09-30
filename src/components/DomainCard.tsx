import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Globe, 
  MoreVertical, 
  Settings, 
  ArrowRightLeft, 
  Network,
  Eye,
  RefreshCw,
  Circle,
  Clock,
  Shield,
  Server,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Api } from "@/services/api";
import { ConfigureTunnelDialog } from "./ConfigureTunnelDialog";
import { SwitchVpsDialog } from "./SwitchVpsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "sonner";
import type { Domain, VPS } from "@/types";
import { useDomainHealth } from "@/hooks/useDomainHealth";
import { useErrorLogger } from "@/hooks/useErrorLogger";
import { CloudflareStatusIndicator } from "./CloudflareStatusIndicator";
import { DomainErrorDisplay } from "./DomainErrorDisplay";

interface DomainHealth {
  dnsOk: boolean;
  tunnelOk?: boolean;
  agentOk?: boolean;
  details?: Record<string, any>;
}

interface DomainCardProps {
  domain: Domain;
  vps?: VPS | null;
  onSwitchVps?: (domain: Domain, vps?: VPS) => void;
}

export function DomainCard({ domain, vps, onSwitchVps }: DomainCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logAndToast, logError } = useErrorLogger();
  const [showTunnelDialog, setShowTunnelDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Use optimized health check hook
  const { health, isLoading: healthLoading, error: healthError, refreshHealth } = useDomainHealth(domain.id, domain.status);

  // Log health check errors
  if (healthError) {
    logError(healthError, { 
      component: 'DomainCard', 
      action: 'health-check',
      domainId: domain.id 
    });
  }

  const autoConfigureMutation = useMutation({
    mutationFn: (domainId: string) => Api.autoConfigureDomain(domainId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Domínio configurado automaticamente!");
      } else {
        logAndToast(
          `Falha na configuração: ${result.errors.join(', ')}`,
          { 
            component: 'DomainCard', 
            action: 'auto-configure',
            domainId: domain.id,
            metadata: { result }
          },
          {
            title: 'Erro na Auto-Configuração',
            description: `Domínio: ${domain.hostname}`,
            action: {
              label: 'Tentar Novamente',
              onClick: () => autoConfigureMutation.mutate(domain.id)
            }
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error) => {
      logAndToast(
        error,
        { 
          component: 'DomainCard', 
          action: 'auto-configure',
          domainId: domain.id 
        },
        {
          title: 'Erro ao Configurar Domínio',
          description: `Falha na configuração de ${domain.hostname}`,
          action: {
            label: 'Tentar Novamente',
            onClick: () => autoConfigureMutation.mutate(domain.id)
          }
        }
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return Api.updateDomain(domain.id, {
        publish_strategy: 'dns',
        tunnel_id: null,
        status: 'pending'
      });
    },
    onSuccess: () => {
      toast.success("Domínio resetado para configuração DNS!");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error) => {
      logAndToast(
        error,
        { 
          component: 'DomainCard', 
          action: 'reset-domain',
          domainId: domain.id 
        },
        {
          title: 'Erro ao Resetar Domínio',
          description: `Falha ao resetar ${domain.hostname}`,
        }
      );
    },
  });

  const getDomainStatus = () => {
    if (!domain.active) return { status: "error", label: "Inativo", color: "text-red-500" };
    
    // Only show "live" if we have positive health checks
    if (health?.dnsOk && (domain.publish_strategy !== 'tunnel' || health?.tunnelOk)) {
      return { status: "success", label: "Ativo", color: "text-emerald-500" };
    }
    
    if (domain.status === 'error') return { status: "error", label: "Erro", color: "text-red-500" };
    if (vps && vps.health === 'down') return { status: "error", label: "VPS Offline", color: "text-red-500" };
    if (vps && vps.health === 'degraded') return { status: "warning", label: "Degradado", color: "text-amber-500" };
    
    return { status: "pending", label: "Pendente", color: "text-gray-500" };
  };

  const getCloudflareStatus = () => {
    if (domain.publish_strategy === 'tunnel' && domain.tunnel_id && health?.tunnelOk) {
      return { connected: true, label: 'Tunnel Ativo', variant: 'default' as const };
    }
    if (domain.publish_strategy === 'dns' && health?.dnsOk) {
      return { connected: true, label: 'DNS Configurado', variant: 'secondary' as const };
    }
    return { connected: false, label: 'Não Configurado', variant: 'outline' as const };
  };

  const getConfigurationStatus = useMemo(() => {
    if (healthLoading) return { 
      status: "loading", 
      label: "Verificando...", 
      color: "text-blue-600",
      details: "Executando verificação de saúde..."
    };
    
    if (!health) return { 
      status: "idle", 
      label: "Sem dados", 
      color: "text-gray-600",
      details: "Nenhuma verificação de saúde disponível"
    };

    // Show specific error details
    let details = "";
    const healthDetails = health.details || {};
    
    if (domain.publish_strategy === "tunnel") {
      if (!domain.tunnel_id) return { 
        status: "error", 
        label: "Túnel não configurado", 
        color: "text-red-600",
        details: "Domínio configurado para tunnel mas sem tunnel_id associado"
      };
      
      if (!health.dnsOk) {
        details = healthDetails.cnameFound ? 
          `CNAME incorreto: ${healthDetails.cnameFound}` : 
          "CNAME não encontrado";
        return { 
          status: "error", 
          label: "DNS pendente", 
          color: "text-amber-600",
          details
        };
      }
      
      if (health.tunnelOk === false) {
        details = `Túnel sem conexões ativas (${healthDetails.tunnelConnections || 0} conexões)`;
        return { 
          status: "error", 
          label: "Túnel offline", 
          color: "text-red-600",
          details
        };
      }
      
      if (health.agentOk === false) {
        details = healthDetails.agentRequestError || 
                 healthDetails.agentError || 
                 `Agent status: ${healthDetails.agentStatus}`;
        return { 
          status: "warning", 
          label: "VPS indisponível", 
          color: "text-amber-600",
          details: `Agent: ${details}`
        };
      }
      
      return { 
        status: "success", 
        label: "Totalmente configurado", 
        color: "text-emerald-600",
        details: "DNS, túnel e VPS operando normalmente"
      };
    }

    if (domain.publish_strategy === "dns") {
      if (!health.dnsOk) {
        return { 
          status: "error", 
          label: "DNS não configurado", 
          color: "text-red-600",
          details: "DNS não foi detectado ou configurado"
        };
      }
      
      if (health.agentOk === false) {
        details = healthDetails.agentRequestError || 
                 healthDetails.agentError || 
                 `Agent status: ${healthDetails.agentStatus}`;
        return { 
          status: "warning", 
          label: "VPS com problemas", 
          color: "text-amber-600",
          details: `Agent: ${details}`
        };
      }
      
      return { 
        status: "success", 
        label: "Configurado", 
        color: "text-emerald-600",
        details: "DNS configurado e VPS operando"
      };
    }

    return { 
      status: "idle", 
      label: "Estratégia desconhecida", 
      color: "text-gray-600",
      details: `Estratégia: ${domain.publish_strategy}`
    };
  }, [domain, health, healthLoading]);

  const domainStatus = getDomainStatus();
  const cloudflareStatus = getCloudflareStatus();
  const configStatus = getConfigurationStatus;
  const isLoading = autoConfigureMutation.isPending || resetMutation.isPending;

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200 border hover:border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 
                  className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                  onClick={() => navigate(`/domains/${domain.id}`)}
                >
                  {domain.hostname}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Circle className={`h-2 w-2 fill-current ${domainStatus.color}`} />
                  <span className={`text-sm ${domainStatus.color}`}>
                    {domainStatus.label}
                  </span>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/domains/${domain.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/domains/${domain.id}/edit`)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowTunnelDialog(true)}>
                  <Network className="mr-2 h-4 w-4" />
                  Configurar com Tunnel
                </DropdownMenuItem>
                {onSwitchVps && (
                  <DropdownMenuItem onClick={() => onSwitchVps(domain, vps || undefined)}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Trocar VPS
                  </DropdownMenuItem>
                )}
                  <DropdownMenuItem 
                    onClick={() => autoConfigureMutation.mutate(domain.id)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Auto-configurar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => refreshHealth()}
                    disabled={healthLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar Saúde
                  </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowResetDialog(true)}
                  className="text-amber-600"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resetar para DNS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-3">
            {/* VPS Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">VPS:</span>
              </div>
              <div className="text-sm font-medium">
                {vps ? vps.name : 'Nenhuma'}
              </div>
            </div>

            {/* Tunnel Info */}
            {domain.publish_strategy === 'tunnel' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tunnel:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {(domain as any).tunnel?.name || 'Configurado'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setShowTunnelDialog(true)}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Cloudflare Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cloudflare:</span>
              </div>
              <CloudflareStatusIndicator domain={domain} health={health} />
            </div>

            {/* Configuration Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Config:</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${configStatus.color}`}>
                  {configStatus.label}
                </span>
                {configStatus.details && (
                  <div className="text-xs text-muted-foreground mt-1" title={configStatus.details}>
                    {configStatus.details.length > 30 ? 
                      `${configStatus.details.substring(0, 30)}...` : 
                      configStatus.details}
                  </div>
                )}
              </div>
            </div>

            {/* Last Check */}
            {domain.last_check_at && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Última verificação:</span>
                </div>
                <span className="text-sm">
                  {new Date(domain.last_check_at).toLocaleString('pt-BR')}
                </span>
              </div>
            )}

            {/* Error Display */}
            {(configStatus.status === 'error' || configStatus.status === 'warning') && (
              <div className="mt-4 pt-4 border-t">
                <DomainErrorDisplay
                  domain={domain}
                  health={health}
                  onRetry={() => refreshHealth()}
                  onConfigure={() => autoConfigureMutation.mutate(domain.id)}
                  onViewDetails={() => navigate(`/domains/${domain.id}`)}
                  size="sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfigureTunnelDialog
        open={showTunnelDialog}
        onOpenChange={setShowTunnelDialog}
        domain={domain}
      />

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Resetar Domínio para DNS"
        description={`Tem certeza que deseja resetar ${domain.hostname} para configuração DNS? Isso removerá a associação com tunnels e redefinirá o status.`}
        confirmText="Resetar"
        variant="destructive"
        onConfirm={() => {
          resetMutation.mutate();
          setShowResetDialog(false);
        }}
      />
    </>
  );
}