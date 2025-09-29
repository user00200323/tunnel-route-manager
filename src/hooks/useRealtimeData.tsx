import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRealtimeData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Domains realtime subscription
    const domainsChannel = supabase
      .channel('domains-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'domains'
        },
        (payload) => {
          console.log('Domain update:', payload);
          
          // Invalidate domains queries
          queryClient.invalidateQueries({ queryKey: ["domains"] });
          
          if (payload.eventType === 'UPDATE') {
            const domain = payload.new as any;
            queryClient.invalidateQueries({ queryKey: ["domain", domain.id] });
            
            // Show toast for VPS changes
            if (payload.old && (payload.old as any).vps_id !== domain.vps_id) {
              toast.info(`Domínio ${domain.hostname} foi transferido para nova VPS`);
            }
          } else if (payload.eventType === 'INSERT') {
            const domain = payload.new as any;
            toast.success(`Novo domínio ${domain.hostname} adicionado`);
          }
        }
      )
      .subscribe();

    // VPS realtime subscription
    const vpsChannel = supabase
      .channel('vps-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vps_servers'
        },
        (payload) => {
          console.log('VPS update:', payload);
          
          // Invalidate VPS queries
          queryClient.invalidateQueries({ queryKey: ["vps"] });
          
          if (payload.eventType === 'UPDATE') {
            const vps = payload.new as any;
            queryClient.invalidateQueries({ queryKey: ["vps", vps.id] });
            
            // Show toast for health changes
            if (payload.old && (payload.old as any).health !== vps.health) {
              const healthStatusMap = {
                healthy: 'saudável',
                degraded: 'degradada',
                down: 'inativa',
                unknown: 'desconhecido'
              };
              
              const statusText = healthStatusMap[vps.health as keyof typeof healthStatusMap] || vps.health;
              
              if (vps.health === 'down') {
                toast.error(`VPS ${vps.name} está inativa`);
              } else if (vps.health === 'healthy' && (payload.old as any).health !== 'healthy') {
                toast.success(`VPS ${vps.name} voltou ao normal`);
              } else {
                toast.info(`VPS ${vps.name} agora está ${statusText}`);
              }
            }
          } else if (payload.eventType === 'INSERT') {
            const vps = payload.new as any;
            toast.success(`Nova VPS ${vps.name} adicionada`);
          }
        }
      )
      .subscribe();

    // Health checks realtime subscription
    const healthChannel = supabase
      .channel('health-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_checks'
        },
        (payload) => {
          console.log('Health check update:', payload);
          
          // Invalidate health check queries
          queryClient.invalidateQueries({ queryKey: ["health-checks"] });
          
          const healthCheck = payload.new as any;
          if (healthCheck.status_code && healthCheck.status_code >= 400) {
            // Don't spam with too many error notifications
            // Only show if it's a significant error (500s)
            if (healthCheck.status_code >= 500) {
              toast.warning(`Health check falhou para VPS (${healthCheck.status_code})`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(domainsChannel);
      supabase.removeChannel(vpsChannel);
      supabase.removeChannel(healthChannel);
    };
  }, [queryClient]);
}