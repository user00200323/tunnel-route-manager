import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Api } from "@/services/api";
import { toast } from "sonner";

const domainEditSchema = z.object({
  hostname: z.string().min(1, "Hostname é obrigatório"),
  vps_id: z.string().optional(),
  status: z.enum(['pending', 'live', 'error', 'propagating']),
  active: z.boolean(),
  publish_strategy: z.enum(['dns', 'tunnel']),
  type: z.enum(['apex', 'www', 'custom']),
});

type DomainEditFormData = z.infer<typeof domainEditSchema>;

export default function DomainEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<DomainEditFormData>({
    resolver: zodResolver(domainEditSchema),
    defaultValues: {
      hostname: "",
      status: "pending",
      active: true,
      publish_strategy: "dns",
      type: "apex",
    },
  });

  const { data: domain, isLoading: domainLoading } = useQuery({
    queryKey: ['domain', id],
    queryFn: () => Api.getDomain(id!),
    enabled: !!id
  });

  const { data: vpsServers = [] } = useQuery({
    queryKey: ['vps'],
    queryFn: () => Api.listVps()
  });

  // Reset form when domain data is loaded
  React.useEffect(() => {
    if (domain) {
      form.reset({
        hostname: domain.hostname,
        vps_id: domain.vps_id || undefined,
        status: domain.status,
        active: domain.active,
        publish_strategy: domain.publish_strategy,
        type: domain.type,
      });
    }
  }, [domain, form]);

  const updateDomainMutation = useMutation({
    mutationFn: (data: Partial<DomainEditFormData>) => Api.updateDomain(id!, data),
    onSuccess: () => {
      toast.success("Domínio atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['domain', id] });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      navigate(`/domains/${id}`);
    },
    onError: (error) => {
      console.error('Error updating domain:', error);
      toast.error("Erro ao atualizar domínio");
    }
  });

  const onSubmit = (values: DomainEditFormData) => {
    updateDomainMutation.mutate(values);
  };

  if (domainLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!domain) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Domínio não encontrado</h3>
          <p className="text-muted-foreground">
            O domínio solicitado não existe ou foi removido.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Editar Domínio</h2>
          <p className="text-muted-foreground">{domain.hostname}</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Domínio</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="hostname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hostname</FormLabel>
                      <FormControl>
                        <Input placeholder="exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vps_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor VPS</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um servidor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum servidor</SelectItem>
                          {vpsServers.map((vps) => (
                            <SelectItem key={vps.id} value={vps.id}>
                              {vps.name} ({vps.provider})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="live">Ativo</SelectItem>
                          <SelectItem value="error">Erro</SelectItem>
                          <SelectItem value="propagating">Propagando</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="apex">Apex (raiz)</SelectItem>
                          <SelectItem value="www">WWW</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publish_strategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estratégia de Publicação</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dns">DNS Direto</SelectItem>
                          <SelectItem value="tunnel">Cloudflare Tunnel</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Domínio Ativo</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Controla se o domínio está ativo no sistema
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateDomainMutation.isPending}
                >
                  {updateDomainMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}