import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Settings, RefreshCw } from "lucide-react";
import { Api } from "@/services/api";
import { toast } from "sonner";
import type { Domain, VPS } from "@/types";

interface ConfigurationStatusSectionProps {
  domain: Domain;
  connectedVps: VPS | null;
}

export function ConfigurationStatusSection({ domain, connectedVps }: ConfigurationStatusSectionProps) {
  const queryClient = useQueryClient();

  const autoConfigureMutation = useMutation({
    mutationFn: () => Api.autoConfigureDomain(domain.id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Domínio configurado automaticamente com sucesso!");
      } else {
        toast.error(`Falha na configuração: ${result.errors.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['domain', domain.id] });
    },
    onError: (error) => {
      toast.error("Erro ao configurar domínio automaticamente: " + error.message);
    },
  });

  const updateCaddyfileMutation = useMutation({
    mutationFn: () => Api.updateVpsCaddyfile(domain.vps_id!),
    onSuccess: () => {
      toast.success("Caddyfile atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['domain', domain.id] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar Caddyfile: " + error.message);
    },
  });

  // Configuration status checks
  const getConfigurationChecks = () => {
    const checks = [];

    // Check 1: VPS Configuration
    if (domain.publish_strategy === 'dns') {
      const hasVps = !!connectedVps;
      const hasIp = hasVps && !!connectedVps.ipv4;
      
      checks.push({
        id: 'vps',
        name: 'Servidor VPS',
        status: hasIp ? 'success' : hasVps ? 'warning' : 'error',
        message: hasIp 
          ? `VPS configurado (${connectedVps.ipv4})` 
          : hasVps 
            ? 'VPS sem endereço IP' 
            : 'Nenhum VPS conectado',
        canFix: false
      });
    }

    // Check 2: DNS Configuration
    const hasDnsConfigured = domain.status === 'live';
    checks.push({
      id: 'dns',
      name: 'Configuração DNS',
      status: hasDnsConfigured ? 'success' : 'error',
      message: hasDnsConfigured ? 'DNS configurado no Cloudflare' : 'DNS não configurado',
      canFix: true
    });

    // Check 3: Tunnel Configuration (for tunnel strategy)
    if (domain.publish_strategy === 'tunnel') {
      const hasTunnel = !!domain.tunnel_id;
      checks.push({
        id: 'tunnel',
        name: 'Cloudflare Tunnel',
        status: hasTunnel ? 'success' : 'error',
        message: hasTunnel ? 'Tunnel configurado' : 'Tunnel não configurado',
        canFix: false
      });
    }

    // Check 4: Caddyfile (for DNS strategy)
    if (domain.publish_strategy === 'dns' && connectedVps) {
      checks.push({
        id: 'caddyfile',
        name: 'Caddyfile VPS',
        status: domain.status === 'live' ? 'success' : 'warning',
        message: domain.status === 'live' ? 'Caddyfile atualizado' : 'Pode precisar atualizar Caddyfile',
        canFix: true
      });
    }

    return checks;
  };

  const checks = getConfigurationChecks();
  const allConfigured = checks.every(check => check.status === 'success');
  const hasErrors = checks.some(check => check.status === 'error');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20">✅ Sucesso</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/20">⚠️ Atenção</Badge>;
      case 'error':
        return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/20">❌ Erro</Badge>;
      default:
        return <Badge variant="outline">❓ Desconhecido</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allConfigured ? (
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          ) : hasErrors ? (
            <XCircle className="h-6 w-6 text-red-500" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          )}
          <div>
            <h3 className="font-medium">
              {allConfigured ? 'Domínio Totalmente Configurado' : 'Configuração Incompleta'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {allConfigured 
                ? 'Todos os componentes estão funcionando corretamente' 
                : 'Alguns componentes precisam ser configurados'
              }
            </p>
          </div>
        </div>
        
        {!allConfigured && (
          <Button
            onClick={() => autoConfigureMutation.mutate()}
            disabled={autoConfigureMutation.isPending}
            className="ml-4"
          >
            {autoConfigureMutation.isPending ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Configurando...
              </div>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Automaticamente
              </>
            )}
          </Button>
        )}
      </div>

      {/* Configuration Checks */}
      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <div>
                <p className="font-medium text-sm">{check.name}</p>
                <p className="text-xs text-muted-foreground">{check.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(check.status)}
              {check.canFix && check.status !== 'success' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (check.id === 'caddyfile') {
                      updateCaddyfileMutation.mutate();
                    } else {
                      autoConfigureMutation.mutate();
                    }
                  }}
                  disabled={autoConfigureMutation.isPending || updateCaddyfileMutation.isPending}
                  className="h-7 px-2 text-xs"
                >
                  {(autoConfigureMutation.isPending || updateCaddyfileMutation.isPending) ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    'Corrigir'
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}