import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Network, Globe, Server, ArrowRight } from "lucide-react";
import { Api } from "@/services/api";
import { toast } from "sonner";
import type { Domain, Tunnel } from "@/types";

interface ConfigureTunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: Domain | null;
}

export function ConfigureTunnelDialog({
  open,
  onOpenChange,
  domain,
}: ConfigureTunnelDialogProps) {
  const queryClient = useQueryClient();
  const [selectedTunnelId, setSelectedTunnelId] = useState<string>("");
  const [serviceUrl, setServiceUrl] = useState("http://caddy:80");

  const { data: tunnels = [], isLoading: tunnelsLoading } = useQuery({
    queryKey: ["tunnels"],
    queryFn: () => Api.listTunnels(),
    enabled: open,
  });

  const configureMutation = useMutation({
    mutationFn: async () => {
      if (!domain || !selectedTunnelId) {
        throw new Error("Domínio e tunnel são obrigatórios");
      }
      
      return Api.configureDomainWithTunnel(domain.id, selectedTunnelId, serviceUrl);
    },
    onSuccess: () => {
      toast.success("Domínio configurado com tunnel com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      queryClient.invalidateQueries({ queryKey: ["tunnels"] });
      onOpenChange(false);
      setSelectedTunnelId("");
      setServiceUrl("http://caddy:80");
    },
    onError: (error) => {
      toast.error("Erro ao configurar domínio: " + error.message);
    },
  });

  const selectedTunnel = tunnels.find(t => t.tunnel_id === selectedTunnelId);

  const handleConfirm = () => {
    configureMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Configurar com Tunnel
          </DialogTitle>
          <DialogDescription>
            Configure o domínio para usar um tunnel do Cloudflare. Isso removerá as configurações DNS atuais e criará um CNAME apontando para o tunnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Domínio */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{domain?.hostname}</p>
                  <p className="text-sm text-muted-foreground">
                    Estratégia atual: {domain?.publish_strategy === 'tunnel' ? 'Tunnel' : 'DNS'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção do Tunnel */}
          <div className="space-y-3">
            <Label htmlFor="tunnel-select">Tunnel de Destino</Label>
            <Select
              value={selectedTunnelId}
              onValueChange={setSelectedTunnelId}
              disabled={tunnelsLoading}
            >
              <SelectTrigger id="tunnel-select">
                <SelectValue placeholder="Selecione um tunnel..." />
              </SelectTrigger>
              <SelectContent>
                {tunnels.map((tunnel) => (
                  <SelectItem key={tunnel.id} value={tunnel.tunnel_id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{tunnel.name}</span>
                      <Badge 
                        variant={tunnel.status === 'connected' ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {tunnel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tunnels.length === 0 && !tunnelsLoading && (
              <p className="text-sm text-muted-foreground">
                Nenhum tunnel encontrado. Crie um tunnel primeiro.
              </p>
            )}
          </div>

          {/* URL do Serviço */}
          <div className="space-y-3">
            <Label htmlFor="service-url">URL do Serviço</Label>
            <Input
              id="service-url"
              value={serviceUrl}
              onChange={(e) => setServiceUrl(e.target.value)}
              placeholder="http://caddy:80"
            />
            <p className="text-sm text-muted-foreground">
              URL do serviço interno para onde o tunnel direcionará o tráfego
            </p>
          </div>

          {/* Preview das Mudanças */}
          {selectedTunnel && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Mudanças que serão realizadas:
                </h4>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2 text-amber-600">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Remover registros DNS existentes
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    Atualizar estratégia para "tunnel"
                  </div>
                  <div className="flex items-center gap-2 text-purple-600">
                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    Associar tunnel: {selectedTunnel.name}
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    Criar CNAME no Cloudflare
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    Configurar rota: {domain?.hostname} → {serviceUrl}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={configureMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTunnelId || configureMutation.isPending}
          >
            {configureMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Configurar com Tunnel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}