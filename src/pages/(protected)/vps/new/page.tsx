import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { vpsSchema } from "@/schemas";
import { Api } from "@/services/api";
import { ArrowLeft, Server, ExternalLink } from "lucide-react";
import type { z } from "zod";

type VpsFormData = z.infer<typeof vpsSchema>;


export default function VpsNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<VpsFormData>({
    resolver: zodResolver(vpsSchema),
    defaultValues: {
      name: "",
      tunnelId: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VpsFormData) => Api.createVps({
      name: data.name,
      tunnel_id: data.tunnelId,
      notes: data.notes,
      health: 'unknown' as const,
    }),
    onSuccess: (data) => {
      toast.success(`VPS ${data.name} criada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["vps"] });
      navigate(`/vps/${data.id}`);
    },
    onError: (error) => {
      toast.error("Erro ao criar VPS: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const onSubmit = (data: VpsFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/vps")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nova VPS</h1>
          <p className="text-muted-foreground">
            Adicione um novo servidor ao sistema
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Informações da VPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da VPS</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="SFO-A, AMS-B, etc." 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Um nome descritivo para identificar esta VPS (ex: localização-servidor)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tunnelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloudflare Tunnel ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="83134a8c-8fe7-4b06-8cd1-03c8d0469e1e" 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          O ID único do túnel Cloudflare configurado nesta VPS
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Notas sobre esta VPS, configurações especiais, etc."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Informações adicionais sobre esta VPS
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate("/vps")}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "Criando..." : "Criar VPS"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Help */}
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Como Configurar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">1. Cloudflare Tunnel</h4>
                <p className="text-muted-foreground mb-2">
                  Primeiro, configure um túnel no Cloudflare Zero Trust Dashboard.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href="https://one.dash.cloudflare.com/tunnels" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir CF Dashboard
                  </a>
                </Button>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Tunnel ID</h4>
                <p className="text-muted-foreground">
                  Copie o ID do túnel criado. É um UUID único que identifica o túnel.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">3. Configurar Rotas</h4>
                <p className="text-muted-foreground">
                  Configure as rotas no túnel para apontar para os serviços internos da VPS.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Exemplo de Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium">Nome:</h4>
                <code className="text-xs bg-muted px-2 py-1 rounded">SFO-1</code>
              </div>
              
              <div>
                <h4 className="font-medium">Tunnel ID:</h4>
                <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                  83134a8c-8fe7-4b06-8cd1-03c8d0469e1e
                </code>
              </div>
              
              <div>
                <h4 className="font-medium">Notas:</h4>
                <p className="text-muted-foreground">
                  "Servidor principal em San Francisco, rodando Caddy na porta 80"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}