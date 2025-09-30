import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, MoreVertical, Eye, RefreshCw, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Domain } from "@/types";
import { supabase } from "@/integrations/supabase/client";

interface DomainCardProps {
  domain: Domain;
}

export function DomainCard({ domain }: DomainCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStatusBadge = () => {
    if (!domain.active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    
    switch (domain.status) {
      case "live":
        return <Badge className="bg-emerald-500"><Circle className="h-3 w-3 mr-1 fill-current" /> Ativo</Badge>;
      case "error":
        return <Badge variant="destructive"><Circle className="h-3 w-3 mr-1 fill-current" /> Erro</Badge>;
      case "pending":
      default:
        return <Badge variant="outline"><Circle className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const refreshHealth = async () => {
    setIsRefreshing(true);
    try {
      await supabase.functions.invoke("domain-health", {
        body: { domainId: domain.id }
      });
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    } catch (error) {
      toast.error("Erro ao atualizar status");
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleActive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("domains")
        .update({ active: !domain.active })
        .eq("id", domain.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(domain.active ? "Domínio desativado" : "Domínio ativado");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: () => {
      toast.error("Erro ao alterar status");
    },
  });

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{domain.hostname}</h3>
                <p className="text-sm text-muted-foreground">
                  {(domain as any).tunnel?.name || "Tunnel não configurado"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/domains/${domain.id}`)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={refreshHealth} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Atualizar status
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleActive.mutate()}>
                    {domain.active ? 'Desativar' : 'Ativar'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Estratégia:</span>
              <p className="font-medium capitalize">{domain.publish_strategy}</p>
            </div>
            <div>
              <span className="text-muted-foreground">FQDN:</span>
              <p className="font-medium truncate">{domain.fqdn}</p>
            </div>
          </div>

          {/* Error Message */}
          {domain.error_message && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {domain.error_message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
