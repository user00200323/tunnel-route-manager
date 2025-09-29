import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Globe, ArrowUpDown, Download, ArrowRightLeft } from "lucide-react";
import { HealthPill } from "@/components/HealthPill";
import { SwitchVpsDialog } from "@/components/SwitchVpsDialog";
import type { Domain, VPS } from "@/types";
import { Api } from "@/services/api";
import { toast } from "sonner";

export default function DomainsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    query: "",
    vpsId: "",
    active: undefined as boolean | undefined,
  });
  const [switchDialog, setSwitchDialog] = useState<{
    open: boolean;
    domain?: Domain;
    currentVps?: VPS;
  }>({ open: false });

  // Enable realtime updates
  useRealtimeData();

  const importMutation = useMutation({
    mutationFn: () => Api.importCloudflareDomainsSync(),
    onSuccess: () => {
      toast.success("Domínios importados com sucesso da Cloudflare!");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error) => {
      toast.error("Erro ao importar domínios: " + error.message);
    },
  });
  
  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => Api.listDomains(),
  });

  const { data: vpsList = [], isLoading: vpsLoading } = useQuery({
    queryKey: ["vps"],
    queryFn: () => Api.listVps(),
  });

  const isLoading = domainsLoading || vpsLoading;

  // Apply filters client-side
  const filteredDomains = domains.filter(domain => {
    if (filters.query && !domain.hostname.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }
    if (filters.vpsId && domain.vps_id !== filters.vpsId) {
      return false;
    }
    if (filters.active !== undefined && domain.active !== filters.active) {
      return false;
    }
    return true;
  });

  const getVpsForDomain = (vpsId: string | null) => {
    if (!vpsId || !vpsList) return null;
    return vpsList.find((v: any) => v.id === vpsId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = filteredDomains.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Domínios</h1>
          <p className="text-muted-foreground">
            Gerencie os domínios e suas rotas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importando..." : "Importar da Cloudflare"}
          </Button>
          <Button onClick={() => navigate("/domains/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Domínio
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hostname..."
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">VPS</label>
              <Select 
                value={filters.vpsId || "all"} 
                onValueChange={(value) => setFilters({ 
                  ...filters, 
                  vpsId: value === "all" ? "" : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as VPS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as VPS</SelectItem>
                  {vpsList.map((vps: any) => (
                    <SelectItem key={vps.id} value={vps.id}>
                      {vps.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={filters.active?.toString() || "all"} 
                onValueChange={(value) => setFilters({ 
                  ...filters, 
                  active: value === "all" ? undefined : value === "true" 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {total} domínio{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDomains.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum domínio encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando seu primeiro domínio
              </p>
              <Button onClick={() => navigate("/domains/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Domínio
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" className="h-auto p-0 font-medium">
                      Hostname
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>VPS Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain: Domain) => {
                  const vps = getVpsForDomain(domain.vps_id || null);
                  
                  return (
                    <TableRow 
                      key={domain.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/domains/${domain.id}`)}
                    >
                      <TableCell className="font-medium">
                        {domain.hostname}
                      </TableCell>
                      <TableCell>
                        {vps ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{vps.name}</span>
                            <HealthPill status={vps.health as any} size="sm" />
                          </div>
                        ) : (
                          <Badge variant="outline">Sem VPS</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={domain.active ? "success" : "outline"}>
                          {domain.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(domain.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {vps && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSwitchDialog({
                                  open: true,
                                  domain,
                                  currentVps: vps
                                });
                              }}
                            >
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Trocar VPS
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/domains/${domain.id}`);
                            }}
                          >
                            Ver Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Switch VPS Dialog */}
      <SwitchVpsDialog
        open={switchDialog.open}
        onOpenChange={(open) => setSwitchDialog({ open })}
        domain={switchDialog.domain!}
        currentVps={switchDialog.currentVps}
      />
    </div>
  );
}