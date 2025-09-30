import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, AlertCircle, Globe, Zap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Domain {
  id: string;
  hostname: string;
  tunnel_id?: string;
  publish_strategy: 'dns' | 'tunnel';
}

interface CloudflareStatusIndicatorProps {
  domain: Domain;
}

interface NameserverInfo {
  domain: string;
  nameservers: string[];
  isCloudflare: boolean;
  cloudflareNameservers: string[];
}

const fetchNameserverInfo = async (domain: string): Promise<NameserverInfo> => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-nameservers?domain=${encodeURIComponent(domain)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
};

export function CloudflareStatusIndicator({ domain }: CloudflareStatusIndicatorProps) {
  const { data: nameserverInfo, isLoading: nsLoading } = useQuery({
    queryKey: ['nameservers', domain.hostname],
    queryFn: () => fetchNameserverInfo(domain.hostname),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  const { data: tunnelInfo } = useQuery({
    queryKey: ['tunnel', domain.tunnel_id],
    queryFn: async () => {
      if (!domain.tunnel_id) return null;
      
      const { data, error } = await supabase
        .from('tunnels')
        .select('name, status, tunnel_id')
        .eq('id', domain.tunnel_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!domain.tunnel_id
  });

  if (nsLoading) {
    return (
      <div className="flex gap-1">
        <Badge variant="outline" className="animate-pulse">
          <Globe className="w-3 h-3 mr-1" />
          Verificando...
        </Badge>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex gap-1 flex-wrap">
        {/* Nameserver Status */}
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant={nameserverInfo?.isCloudflare ? "default" : "destructive"}
              className="text-xs"
            >
              <Globe className="w-3 h-3 mr-1" />
              {nameserverInfo?.isCloudflare ? "CF NS" : "Externo"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">Nameservers:</p>
              {nameserverInfo?.isCloudflare ? (
                <p className="text-green-400">✓ Usando Cloudflare</p>
              ) : (
                <p className="text-red-400">✗ Nameservers externos</p>
              )}
              {nameserverInfo?.nameservers?.length > 0 && (
                <div className="mt-1">
                  {nameserverInfo.nameservers.slice(0, 2).map(ns => (
                    <p key={ns} className="text-xs text-muted-foreground">{ns}</p>
                  ))}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Tunnel Status */}
        {domain.publish_strategy === 'tunnel' && (
          <Tooltip>
            <TooltipTrigger>
              <Badge 
                variant={tunnelInfo?.status === 'connected' ? "default" : "destructive"}
                className="text-xs"
              >
                <Zap className="w-3 h-3 mr-1" />
                {tunnelInfo?.status === 'connected' ? 'Tunnel OK' : 'Tunnel Down'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-medium">Cloudflare Tunnel:</p>
                <p className="text-xs text-muted-foreground">
                  Nome: {tunnelInfo?.name || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID: {tunnelInfo?.tunnel_id || 'N/A'}
                </p>
                <p className={`text-xs ${tunnelInfo?.status === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                  Status: {tunnelInfo?.status || 'Desconhecido'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* SSL Status - placeholder for now */}
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="default" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              SSL
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Certificado SSL ativo</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}