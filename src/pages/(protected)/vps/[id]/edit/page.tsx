import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { vpsSchema } from "@/schemas";
import { Api } from "@/services/api";
import { ArrowLeft, Server, Save } from "lucide-react";
import type { z } from "zod";

type VpsFormData = z.infer<typeof vpsSchema>;

export default function VpsEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: vps, isLoading } = useQuery({
    queryKey: ["vps", id],
    queryFn: () => Api.getVps(id!),
    enabled: !!id,
  });

  const form = useForm<VpsFormData>({
    resolver: zodResolver(vpsSchema),
    defaultValues: {
      name: "",
      tunnelId: "",
      notes: "",
    },
  });

  // Update form when VPS data loads
  React.useEffect(() => {
    if (vps) {
      form.reset({
        name: vps.name,
        tunnelId: vps.tunnel_id || "",
        notes: vps.notes || "",
      });
    }
  }, [vps, form]);

  const updateMutation = useMutation({
    mutationFn: (data: VpsFormData) => Api.updateVps(id!, {
      name: data.name,
      tunnel_id: data.tunnelId,
      notes: data.notes,
    }),
    onSuccess: (data) => {
      toast.success(`VPS ${data.name} atualizada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["vps"] });
      queryClient.invalidateQueries({ queryKey: ["vps", id] });
      navigate(`/vps/${id}`);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar VPS: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const onSubmit = (values: VpsFormData) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vps) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/vps")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">VPS não encontrada</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(`/vps/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar VPS</h1>
          <p className="text-muted-foreground">
            Atualize as configurações da VPS {vps.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configurações da VPS
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
                      <Input placeholder="Ex: VPS Principal - NYC" {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome identificador para esta VPS
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
                      <Input placeholder="12345678-1234-5678-9012-123456789abc" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID do túnel Cloudflare configurado nesta VPS
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
                        placeholder="Observações sobre esta VPS..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Informações adicionais sobre configuração, localização, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(`/vps/${id}`)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}