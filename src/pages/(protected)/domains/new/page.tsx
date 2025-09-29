import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { domainSchema } from "@/schemas";
import { HealthPill } from "@/components/HealthPill";
import { ArrowLeft, Globe } from "lucide-react";
import type { VPS } from "@/models";
import type { z } from "zod";

type DomainFormData = z.infer<typeof domainSchema>;

const fetchVpsList = async () => {
  const vpsList = await import("@/mocks/vps.json");
  return vpsList.default;
};

const createDomain = async (data: DomainFormData) => {
  // Mock API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: "new-domain", ...data };
};

export default function DomainsNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      hostname: "",
      active: true,
      currentVpsId: undefined,
    },
  });

  const { data: vpsList, isLoading: vpsLoading } = useQuery({
    queryKey: ["vps"],
    queryFn: fetchVpsList,
  });

  const createMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: (data) => {
      toast({
        title: "Domínio criado com sucesso!",
        description: `O domínio ${data.hostname} foi adicionado.`,
      });
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      navigate(`/domains/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar domínio",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DomainFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/domains")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Novo Domínio</h1>
          <p className="text-muted-foreground">
            Adicione um novo domínio ao sistema
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Informações do Domínio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="hostname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hostname</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="exemplo.com" 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          O hostname deve estar configurado nas rotas do túnel no destino desejado (Cloudflare Zero Trust)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentVpsId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VPS Inicial (Opcional)</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                          defaultValue={field.value || "none"}
                          disabled={vpsLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma VPS" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma VPS</SelectItem>
                            {vpsList?.map((vps: any) => (
                              <SelectItem key={vps.id} value={vps.id}>
                                <div className="flex items-center gap-2">
                                  <span>{vps.name}</span>
                                  <HealthPill status={vps.status as any} size="sm" />
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Você pode configurar a VPS depois na página de detalhes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Ativar domínio
                          </FormLabel>
                          <FormDescription>
                            Domínios ativos recebem tráfego de entrada
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate("/domains")}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Domínio"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Help */}
        <div>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Dicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Configuração do Hostname</h4>
                <p className="text-muted-foreground">
                  Certifique-se de que o hostname está configurado corretamente no Cloudflare Zero Trust como uma rota do túnel.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">VPS Inicial</h4>
                <p className="text-muted-foreground">
                  Você pode criar o domínio sem uma VPS e configurá-la depois usando a funcionalidade "Mover Domínio".
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Domínios Inativos</h4>
                <p className="text-muted-foreground">
                  Domínios inativos não recebem tráfego, mas permanecem no sistema para configuração futura.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}