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
import { CloudflareStatusIndicator } from "./CloudflareStatusIndicator";

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
  const [showTunnelDialog, setShowTunnelDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Use optimized health check hook
  const { health, isLoading: healthLoading, error: healthError } = useDomainHealth(domain.id, domain.status);

  const autoConfigureMutation = useMutation({
    mutationFn: (domainId: string) => Api.autoConfigureDomain(domainId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Domínio configurado automaticamente!");
      } else {
        toast.error(`Falha na configuração: ${result.errors.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error) => {
      toast.error("Erro ao configurar domínio: " + error.message);
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
      toast.error("Erro ao resetar domínio: " + error.message);
    },
  });

  const getDomainStatus = () => {
    if (!domain.active) return { status: "error", label: "Inativo", color: "text-red-500" };
    if (domain.status === 'error') return { status: "error", label: "Erro", color: "text-red-500" };
    if (vps && vps.health === 'down') return { status: "error", label: "VPS Offline", color: "text-red-500" };
    if (vps && vps.health === 'degraded') return { status: "warning", label: "Degradado", color: "text-amber-500" };
    if (domain.status === 'live') return { status: "success", label: "Ativo", color: "text-emerald-500" };
    return { status: "pending", label: "Pendente", color: "text-gray-500" };
  };

  const getCloudflareStatus = () => {
    if (domain.publish_strategy === 'tunnel' && domain.tunnel_id) {
      return { connected: true, label: 'Tunnel', variant: 'default' as const };
    }
    if (domain.publish_strategy === 'dns' && domain.status === 'live') {
      return { connected: true, label: 'DNS', variant: 'secondary' as const };
    }
    return { connected: false, label: 'Não Config.', variant: 'outline' as const };
  };

  const getConfigurationStatus = useMemo(() => {
    if (healthLoading) return { status: "loading", label: "Verificando...", color: "text-blue-600" };
    if (!health) return { status: "idle", label: "Sem dados", color: "text-gray-600" };

    if (domain.publish_strategy === "tunnel") {
      if (!domain.tunnel_id) return { status: "warn", label: "Incompleto (sem túnel)", color: "text-red-600" };
      if (!health.dnsOk) return { status: "warn", label: "DNS pendente", color: "text-amber-600" };
      if (health.tunnelOk === false) return { status: "warn", label: "Túnel offline", color: "text-red-600" };
      if (health.agentOk === false) return { status: "warn", label: "VPS indisponível", color: "text-amber-600" };
      return { status: "configured", label: "Configurado", color: "text-emerald-600" };
    }

    if (domain.publish_strategy === "dns") {
      return health.dnsOk ? { status: "configured", label: "Configurado", color: "text-emerald-600" }
                          : { status: "warn", label: "DNS pendente", color: "text-amber-600" };
    }

    return { status: "idle", label: "Desconhecido", color: "text-gray-600" };
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

            {/* Cloudflare Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cloudflare:</span>
              </div>
              <CloudflareStatusIndicator domain={domain} />
            </div>

            {/* Configuration Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Config:</span>
              </div>
              <span className={`text-sm font-medium ${configStatus.color}`}>
                {configStatus.label}
              </span>
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