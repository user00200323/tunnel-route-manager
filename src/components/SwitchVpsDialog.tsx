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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HealthPill } from "@/components/HealthPill";
import { toast } from "sonner";
import { Api } from "@/services/api";
import { ArrowRightLeft, Server } from "lucide-react";
import type { Domain, VPS } from "@/types";

interface SwitchVpsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: Domain;
  currentVps?: VPS;
}

export function SwitchVpsDialog({ open, onOpenChange, domain, currentVps }: SwitchVpsDialogProps) {
  const [selectedVpsId, setSelectedVpsId] = useState<string>("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: vpsList = [] } = useQuery({
    queryKey: ["vps"],
    queryFn: () => Api.listVps(),
    enabled: open,
  });

  const switchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVpsId) throw new Error("Selecione uma VPS");
      
      // Update domain VPS assignment
      await Api.updateDomain(domain.id, {
        vps_id: selectedVpsId,
      });

      // Trigger Cloudflare update via edge function
      const response = await fetch(`https://dblnjqfkfgwtlsscncml.supabase.co/functions/v1/vps-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'switch_domain_vps',
          domainId: domain.id,
          newVpsId: selectedVpsId,
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao atualizar Cloudflare: ${error}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success(`Domínio ${domain.hostname} transferido com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      queryClient.invalidateQueries({ queryKey: ["domain", domain.id] });
      onOpenChange(false);
      setSelectedVpsId("");
      setReason("");
    },
    onError: (error) => {
      toast.error("Erro ao trocar VPS: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const availableVps = vpsList.filter(vps => vps.id !== domain.vps_id);
  const selectedVps = vpsList.find(vps => vps.id === selectedVpsId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Trocar VPS do Domínio
          </DialogTitle>
          <DialogDescription>
            Transfira o domínio <strong>{domain.hostname}</strong> para uma nova VPS.
            Isso atualizará automaticamente a configuração da Cloudflare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current VPS */}
          {currentVps && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">VPS Atual</Label>
              <div className="flex items-center gap-2 mt-1">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{currentVps.name}</span>
                <HealthPill status={currentVps.health as any} size="sm" />
              </div>
            </div>
          )}

          {/* New VPS Selection */}
          <div className="space-y-2">
            <Label htmlFor="vps-select">Nova VPS</Label>
            <Select value={selectedVpsId} onValueChange={setSelectedVpsId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma VPS de destino" />
              </SelectTrigger>
              <SelectContent>
                {availableVps.map((vps) => (
                  <SelectItem key={vps.id} value={vps.id}>
                    <div className="flex items-center gap-2">
                      <span>{vps.name}</span>
                      <HealthPill status={vps.health as any} size="sm" />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableVps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma VPS alternativa disponível
              </p>
            )}
          </div>

          {/* Selected VPS Info */}
          {selectedVps && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Label className="text-sm font-medium">VPS de Destino</Label>
              <div className="flex items-center gap-2 mt-1">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedVps.name}</span>
                <HealthPill status={selectedVps.health as any} size="sm" />
              </div>
              {selectedVps.tunnel_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tunnel: {selectedVps.tunnel_id}
                </p>
              )}
            </div>
          )}

          {/* Reason (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (Opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: VPS atual com problemas de performance..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => switchMutation.mutate()}
            disabled={!selectedVpsId || switchMutation.isPending}
          >
            {switchMutation.isPending ? "Transferindo..." : "Confirmar Troca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}