import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const dnsRecordSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV']),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  ttl: z.number().min(1).max(86400).default(3600),
  proxied: z.boolean().default(false),
});

type DnsRecordFormData = z.infer<typeof dnsRecordSchema>;

interface DnsRecordsManagerProps {
  domainId: string;
  hostname: string;
}

export function DnsRecordsManager({ domainId, hostname }: DnsRecordsManagerProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<DnsRecordFormData>({
    resolver: zodResolver(dnsRecordSchema),
    defaultValues: {
      name: "",
      type: "A",
      content: "",
      ttl: 3600,
      proxied: false,
    },
  });

  // Mock DNS records for demonstration
  const mockDnsRecords = [
    {
      id: '1',
      name: hostname,
      type: 'A',
      content: '185.158.133.1',
      ttl: 3600,
      proxied: false,
      status: 'active'
    },
    {
      id: '2',
      name: `www.${hostname}`,
      type: 'CNAME',
      content: hostname,
      ttl: 3600,
      proxied: false,
      status: 'active'
    }
  ];

  const createRecordMutation = useMutation({
    mutationFn: async (data: DnsRecordFormData) => {
      // This would call a real API to create DNS records
      console.log('Creating DNS record:', data);
      return Promise.resolve({ id: Date.now().toString(), ...data });
    },
    onSuccess: () => {
      toast.success("Registro DNS criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['dns-records', domainId] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast.error("Erro ao criar registro DNS");
    }
  });

  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      // This would call a real API to delete DNS records
      console.log('Deleting DNS record:', recordId);
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success("Registro DNS removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['dns-records', domainId] });
    },
    onError: () => {
      toast.error("Erro ao remover registro DNS");
    }
  });

  const onSubmit = (values: DnsRecordFormData) => {
    createRecordMutation.mutate(values);
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'A':
        return 'bg-blue-100 text-blue-800';
      case 'CNAME':
        return 'bg-green-100 text-green-800';
      case 'MX':
        return 'bg-purple-100 text-purple-800';
      case 'TXT':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Registros DNS</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Registro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Registro DNS</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="@, www, mail" {...field} />
                          </FormControl>
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
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="AAAA">AAAA</SelectItem>
                              <SelectItem value="CNAME">CNAME</SelectItem>
                              <SelectItem value="MX">MX</SelectItem>
                              <SelectItem value="TXT">TXT</SelectItem>
                              <SelectItem value="SRV">SRV</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conteúdo</FormLabel>
                        <FormControl>
                          <Input placeholder="IP ou valor do registro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ttl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TTL (segundos)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="3600"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createRecordMutation.isPending}
                    >
                      {createRecordMutation.isPending ? "Criando..." : "Criar Registro"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockDnsRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Badge className={getRecordTypeColor(record.type)}>
                  {record.type}
                </Badge>
                <div className="flex-1">
                  <div className="font-medium font-mono text-sm">
                    {record.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {record.content}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  TTL: {record.ttl}s
                </div>
              </div>
              <div className="flex items-center gap-2">
                {record.proxied && (
                  <Badge variant="outline">Proxied</Badge>
                )}
                <Badge variant={record.status === 'active' ? 'default' : 'secondary'}>
                  {record.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRecordMutation.mutate(record.id)}
                  disabled={deleteRecordMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Propagação DNS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}