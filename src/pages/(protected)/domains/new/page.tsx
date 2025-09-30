import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  hostname: z.string().min(3, "Hostname deve ter pelo menos 3 caracteres"),
  tunnel_id: z.string().min(1, "Selecione um tunnel"),
  service_url: z.string().url("URL inválida").or(z.string().regex(/^http:\/\/localhost:\d+$/, "URL inválida")),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function DomainsNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hostname: "",
      tunnel_id: "",
      service_url: "http://localhost:3000",
      active: true,
    },
  });

  const { data: tunnels = [] } = useQuery({
    queryKey: ["tunnels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tunnels")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createDomainMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await supabase
        .from("domains")
        .insert({
          hostname: values.hostname,
          fqdn: values.hostname,
          tunnel_id: values.tunnel_id,
          publish_strategy: "tunnel",
          status: "pending",
          active: values.active,
        })
        .select()
        .single();

      if (error) throw error;

      // Call configure-domain-tunnel
      const { error: configError } = await supabase.functions.invoke("configure-domain-tunnel", {
        body: {
          domainId: data.id,
          tunnelId: values.tunnel_id,
          serviceUrl: values.service_url,
        },
      });

      if (configError) throw configError;

      return data;
    },
    onSuccess: () => {
      toast.success("Domínio criado! Configure o CNAME para ativá-lo.");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      navigate("/domains");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar domínio");
    },
  });

  const onSubmit = (values: FormValues) => {
    createDomainMutation.mutate(values);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/domains")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Novo Domínio</h1>
          <p className="text-muted-foreground">
            Adicione um domínio via Cloudflare Tunnel
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Domínio</CardTitle>
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
                      <Input placeholder="exemplo.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Domínio completo (ex: app.seusite.com)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tunnel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tunnel</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tunnel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tunnels.map((tunnel: any) => (
                          <SelectItem key={tunnel.id} value={tunnel.id}>
                            {tunnel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Tunnel Cloudflare para rotear o tráfego
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Serviço</FormLabel>
                    <FormControl>
                      <Input placeholder="http://localhost:3000" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL interna para onde o tunnel vai rotear
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativo</FormLabel>
                      <FormDescription>
                        Domínio estará ativo após configuração
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/domains")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createDomainMutation.isPending}
                  className="flex-1"
                >
                  {createDomainMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Criar Domínio
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Próximos passos:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Criar o domínio aqui</li>
            <li>Configurar CNAME no DNS apontando para o tunnel</li>
            <li>Aguardar propagação (verificação automática)</li>
            <li>Domínio ficará ativo automaticamente</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
