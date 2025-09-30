import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Link, Unlink, RefreshCw } from 'lucide-react';
import { Api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { Domain, VPS } from '@/types';

interface DomainTunnelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DomainTunnelManager({ open, onOpenChange }: DomainTunnelManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAssociations, setSelectedAssociations] = useState<Record<string, string>>({});

  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => Api.listDomains(),
  });

  const { data: vpsServers } = useQuery({
    queryKey: ['vps'],
    queryFn: () => Api.listVps(),
  });

  const { data: tunnels } = useQuery({
    queryKey: ['tunnels'],
    queryFn: () => Api.listTunnels(),
  });

  const updateDomainMutation = useMutation({
    mutationFn: ({ domainId, updates }: { domainId: string; updates: Partial<Domain> }) =>
      Api.updateDomain(domainId, updates),
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Associação atualizada com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar associação',
        variant: 'destructive',
      });
    },
  });

  const runImportMutation = useMutation({
    mutationFn: Api.importCloudflareDomainsSync,
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Importação do Cloudflare executada com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['tunnels'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Falha na importação do Cloudflare',
        variant: 'destructive',
      });
    },
  });

  const handleAssociateDomain = async (domainId: string, tunnelId: string | null, vpsId: string | null) => {
    const updates: Partial<Domain> = {
      publish_strategy: tunnelId ? 'tunnel' : 'dns',
      tunnel_id: tunnelId,
      vps_id: tunnelId ? vpsId : vpsId, // For tunnel strategy, vps_id can still be set
    };

    updateDomainMutation.mutate({ domainId, updates });
  };

  const handleVpsAssociation = (domainId: string, vpsId: string) => {
    setSelectedAssociations(prev => ({
      ...prev,
      [domainId]: vpsId
    }));
  };

  const getDomainStatus = (domain: Domain) => {
    if (domain.publish_strategy === 'tunnel' && domain.tunnel_id) {
      return { status: 'Tunnel', variant: 'default' as const };
    }
    return { status: 'DNS', variant: 'secondary' as const };
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gerenciar Associações Domínio-Tunnel</h2>
            <p className="text-sm text-muted-foreground">
              Configure quais domínios usam tunnels e associe VPS
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runImportMutation.mutate()}
              disabled={runImportMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reimportar Cloudflare
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>

        <Separator />

        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {domains?.map((domain) => {
            const tunnel = tunnels?.find(t => t.id === domain.tunnel_id);
            const vps = vpsServers?.find(v => v.id === domain.vps_id);
            const statusInfo = getDomainStatus(domain);

            return (
              <Card key={domain.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{domain.hostname}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant={statusInfo.variant}>{statusInfo.status}</Badge>
                        {tunnel && (
                          <Badge variant="outline">Tunnel: {tunnel.name}</Badge>
                        )}
                        {vps && (
                          <Badge variant="outline">VPS: {vps.name}</Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tunnel Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tunnel</label>
                      <Select
                        value={domain.tunnel_id || ''}
                        onValueChange={(value) => {
                          const tunnelId = value === 'none' ? null : value;
                          const currentVpsId = selectedAssociations[domain.id] || domain.vps_id;
                          handleAssociateDomain(domain.id, tunnelId, currentVpsId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tunnel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center">
                              <Unlink className="h-4 w-4 mr-2" />
                              Sem Tunnel (DNS)
                            </div>
                          </SelectItem>
                          {tunnels?.map((tunnel) => (
                            <SelectItem key={tunnel.id} value={tunnel.id}>
                              <div className="flex items-center">
                                <Link className="h-4 w-4 mr-2" />
                                {tunnel.name}
                                <Badge 
                                  variant={tunnel.status === 'connected' ? 'default' : 'destructive'} 
                                  className="ml-2 text-xs"
                                >
                                  {tunnel.status}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* VPS Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">VPS</label>
                      <Select
                        value={selectedAssociations[domain.id] || domain.vps_id || ''}
                        onValueChange={(value) => {
                          const vpsId = value === 'none' ? null : value;
                          handleVpsAssociation(domain.id, vpsId!);
                          handleAssociateDomain(domain.id, domain.tunnel_id, vpsId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um VPS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem VPS</SelectItem>
                          {vpsServers?.map((vps) => (
                            <SelectItem key={vps.id} value={vps.id}>
                              <div className="flex items-center">
                                <Settings className="h-4 w-4 mr-2" />
                                {vps.name}
                                <Badge 
                                  variant={vps.health === 'healthy' ? 'default' : 'destructive'} 
                                  className="ml-2 text-xs"
                                >
                                  {vps.health}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Current Configuration */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Configuração</label>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Estratégia: {domain.publish_strategy}</div>
                        <div>Status: {domain.status}</div>
                        {domain.error_message && (
                          <div className="text-destructive text-xs">
                            Erro: {domain.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}