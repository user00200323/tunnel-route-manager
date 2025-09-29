import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, X, Globe, Server, Info } from "lucide-react";
import { toast } from "sonner";
import { Api } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { domainSchema } from "@/schemas";
import type { z } from "zod";

type DomainFormData = z.infer<typeof domainSchema>;

export default function DomainsNewPage() {
  const navigate = useNavigate();
  const [publishStrategy, setPublishStrategy] = useState<'dns' | 'tunnel'>('dns');

  // Fetch VPS list for the select dropdown
  const { data: vpsData = [] } = useQuery({
    queryKey: ['vps'],
    queryFn: () => Api.listVps()
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => Api.listTenants()
  });

  const form = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      hostname: "",
      type: "apex",
      active: true,
    },
  });

  const createDomainMutation = useMutation({
    mutationFn: async (data: DomainFormData) => {
      // Map form data to API format
      const apiData = {
        hostname: data.hostname,
        tenant_id: tenants[0]?.id || '', // Use first tenant or handle properly
        type: data.type,
        publish_strategy: publishStrategy,
        vps_id: publishStrategy === 'dns' ? data.vpsId : undefined,
        tunnel_id: publishStrategy === 'tunnel' ? data.tunnelId : undefined,
        active: data.active,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Create the domain
      const domain = await Api.createDomain(apiData);
      
      // If DNS strategy, configure Cloudflare DNS and update VPS Caddyfile
      if (publishStrategy === 'dns' && data.vpsId) {
        try {
          // Call cloudflare-dns function to setup DNS records
          await supabase.functions.invoke('cloudflare-dns', {
            body: {
              action: 'create_records',
              domain: data.hostname,
              vpsId: data.vpsId
            }
          });
          
          // Update VPS Caddyfile to include the new domain
          await Api.updateVpsCaddyfile(data.vpsId);
          
          toast.success("DNS configurado e Caddy atualizado!");
        } catch (error) {
          console.error('Error configuring DNS/VPS:', error);
          toast.warning("Domínio criado, mas houve erro na configuração automática");
        }
      }
      
      return domain;
    },
    onSuccess: (domain) => {
      toast.success("Domínio criado e configurado com sucesso!");
      navigate(`/domains/${domain.id}`);
    },
    onError: (error) => {
      toast.error("Erro ao criar domínio: " + error.message);
    },
  });

  const onSubmit = (data: DomainFormData) => {
    createDomainMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/domains")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Novo Domínio</h2>
          <p className="text-muted-foreground">
            Configure um novo domínio para seu projeto
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Domínio</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="hostname">Domínio</Label>
                  <Input
                    id="hostname"
                    placeholder="exemplo.com"
                    {...form.register("hostname")}
                  />
                  {form.formState.errors.hostname && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.hostname.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value: any) => form.setValue("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apex">Apex (exemplo.com)</SelectItem>
                      <SelectItem value="www">WWW (www.exemplo.com)</SelectItem>
                      <SelectItem value="custom">Subdomínio personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Estratégia de Publicação</Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card 
                      className={`cursor-pointer transition-colors ${
                        publishStrategy === 'dns' ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setPublishStrategy('dns')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${publishStrategy === 'dns' ? 'bg-primary' : 'bg-muted'}`} />
                          <div>
                            <h4 className="font-medium">DNS Direto</h4>
                            <p className="text-sm text-muted-foreground">
                              Aponta diretamente para o IP do servidor
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-colors ${
                        publishStrategy === 'tunnel' ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setPublishStrategy('tunnel')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${publishStrategy === 'tunnel' ? 'bg-primary' : 'bg-muted'}`} />
                          <div>
                            <h4 className="font-medium">Cloudflare Tunnel</h4>
                            <p className="text-sm text-muted-foreground">
                              Usa túnel do Cloudflare
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {publishStrategy === 'dns' && (
                  <div className="space-y-2">
                    <Label htmlFor="vpsId">Servidor VPS</Label>
                    <Select
                      value={form.watch("vpsId") || ""}
                      onValueChange={(value) => form.setValue("vpsId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um servidor VPS" />
                      </SelectTrigger>
                      <SelectContent>
                        {vpsData.map((vps) => (
                          <SelectItem key={vps.id} value={vps.id}>
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              {vps.name} ({vps.ipv4})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {vpsData.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma VPS disponível. Crie uma VPS primeiro.
                      </p>
                    )}
                  </div>
                )}

                {publishStrategy === 'tunnel' && (
                  <div className="space-y-2">
                    <Label htmlFor="tunnelId">Túnel Cloudflare</Label>
                    <Input
                      id="tunnelId"
                      placeholder="ID do túnel Cloudflare"
                      value={form.watch("tunnelId") || ""}
                      onChange={(e) => form.setValue("tunnelId", e.target.value)}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={form.watch("active")}
                    onCheckedChange={(checked) => form.setValue("active", checked)}
                  />
                  <Label htmlFor="active">Domínio ativo</Label>
                </div>

                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/domains")}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDomainMutation.isPending}
                  >
                    {createDomainMutation.isPending ? "Criando..." : "Criar Domínio"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Help Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Ajuda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">DNS Direto</h4>
                <p className="text-sm text-muted-foreground">
                  Aponta o domínio diretamente para o IP do servidor VPS. 
                  Mais simples mas requer configuração manual do DNS.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Cloudflare Tunnel</h4>
                <p className="text-sm text-muted-foreground">
                  Usa túneis do Cloudflare para rotear tráfego. 
                  Mais seguro e não expõe o IP do servidor.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exemplo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm">exemplo.com</code>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {publishStrategy === 'dns' ? 'DNS → VPS' : 'DNS → Túnel → VPS'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}