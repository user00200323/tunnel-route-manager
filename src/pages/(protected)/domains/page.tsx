import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Search, 
  Globe, 
  Download, 
  Radio, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Activity,
  Shield,
  Filter,
  LayoutGrid,
  List
} from "lucide-react";
import { DomainCard } from "@/components/DomainCard";
import { VpsSyncComponent } from "@/components/VpsSyncComponent";
import { SwitchVpsDialog } from "@/components/SwitchVpsDialog";
import type { Domain, VPS } from "@/types";
import { Api } from "@/services/api";
import { toast } from "sonner";

export default function DomainsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    query: "",
    vpsId: "",
    active: undefined as boolean | undefined,
    onlyTunnels: false,
  });
  const [switchDialog, setSwitchDialog] = useState<{
    open: boolean;
    domain?: Domain;
    currentVps?: VPS;
  }>({ open: false });

  // Enable realtime updates
  useRealtimeData();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      queryClient.invalidateQueries({ queryKey: ["vps"] });
      queryClient.invalidateQueries({ queryKey: ["health-checks"] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

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

  // Get the default VPS (first VPS or the one with domains)
  const defaultVps = vpsList?.[0];

  const { data: healthChecks = [] } = useQuery({
    queryKey: ["health-checks"],
    queryFn: async () => {
      // Simulated health check data - replace with actual API call
      return domains.map((domain: Domain) => ({
        domainId: domain.id,
        status: domain.active ? "live" : "error",
        lastCheck: new Date().toISOString(),
        latency: Math.floor(Math.random() * 200) + 50
      }));
    },
    enabled: domains.length > 0,
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
    if (filters.onlyTunnels && !domain.tunnel_id) {
      return false;
    }
    return true;
  });

  const getVpsForDomain = (vpsId: string | null) => {
    if (!vpsId || !vpsList) return null;
    return vpsList.find((v: any) => v.id === vpsId);
  };

  const getDomainStatus = (domain: Domain) => {
    const vps = getVpsForDomain(domain.vps_id || null);
    const hasCloudflareSetup = domain.publish_strategy === 'tunnel' || domain.tunnel_id;
    
    if (!domain.active) return "error";
    if (!hasCloudflareSetup && domain.status === 'error') return "error";
    if (domain.status === 'error') return "error";
    if (vps && vps.health === 'down') return "error";
    if (vps && vps.health === 'degraded') return "propagating";
    if (domain.status === 'live') return "live";
    return "pending";
  };

  const getCloudflareStatus = (domain: Domain) => {
    if (domain.publish_strategy === 'tunnel' && domain.tunnel_id) {
      return { status: 'tunnel', label: 'Tunnel Ativo', connected: true };
    }
    if (domain.publish_strategy === 'dns') {
      return { 
        status: 'dns', 
        label: domain.status === 'live' ? 'DNS Configurado' : 'DNS Pendente', 
        connected: domain.status === 'live' 
      };
    }
    return { status: 'none', label: 'Não Configurado', connected: false };
  };

  // Calculate metrics
  const metrics = {
    total: filteredDomains.length,
    active: filteredDomains.filter(d => getDomainStatus(d) === 'live').length,
    withProblems: filteredDomains.filter(d => getDomainStatus(d) === 'error').length,
    viaCloudflare: filteredDomains.filter(d => getCloudflareStatus(d).connected).length,
    viaTunnel: filteredDomains.filter(d => d.publish_strategy === 'tunnel').length,
  };

  const healthPercentage = metrics.total > 0 ? Math.round((metrics.active / metrics.total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* Health Overview Skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Domain Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="space-y-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8" />
                  </div>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* VPS Sync Section */}
      {defaultVps && (
        <VpsSyncComponent 
          vpsId={defaultVps.id} 
          vpsName={defaultVps.name}
          onSyncComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["domains"] });
            queryClient.invalidateQueries({ queryKey: ["vps"] });
          }}
        />
      )}
      {/* Smart Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Domínios
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus domínios de forma simples e eficiente
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="hover-scale"
          >
            <Download className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importando..." : "Importar Cloudflare"}
          </Button>
          <Button 
            onClick={() => navigate("/domains/new")}
            className="hover-scale bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Domínio
          </Button>
        </div>
      </div>

      {/* Health Overview Dashboard */}
      <Card className="shadow-card border-primary/10">
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Status Geral dos Domínios</h3>
              <Badge variant={healthPercentage >= 80 ? "default" : healthPercentage >= 60 ? "secondary" : "destructive"}>
                {healthPercentage}% saudáveis
              </Badge>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/40">
                <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Ativos</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {metrics.active}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/40">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Problemas</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {metrics.withProblems}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/40">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Cloudflare</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {metrics.viaCloudflare}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/40">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Tunnels</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {metrics.viaTunnel}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-gray-100 rounded-lg dark:bg-gray-800">
                <Globe className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.total}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Smart Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por hostname..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="pl-10"
              />
            </div>
            
            {/* VPS Filter */}
            <Select 
              value={filters.vpsId || "all"} 
              onValueChange={(value) => setFilters({ 
                ...filters, 
                vpsId: value === "all" ? "" : value 
              })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por VPS" />
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

            {/* Status Filter */}
            <Select 
              value={filters.active?.toString() || "all"} 
              onValueChange={(value) => setFilters({ 
                ...filters, 
                active: value === "all" ? undefined : value === "true" 
              })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {/* Tunnel Filter */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="onlyTunnels"
                checked={filters.onlyTunnels}
                onCheckedChange={(checked) => 
                  setFilters({ ...filters, onlyTunnels: !!checked })
                }
              />
              <label 
                htmlFor="onlyTunnels" 
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Só tunnels
              </label>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-3"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {filteredDomains.length} domínio{filteredDomains.length !== 1 ? "s" : ""} encontrado{filteredDomains.length !== 1 ? "s" : ""}
          </h3>
          {filters.query || filters.vpsId || filters.active !== undefined || filters.onlyTunnels ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ query: "", vpsId: "", active: undefined, onlyTunnels: false })}
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {filteredDomains.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum domínio encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {filters.query || filters.vpsId || filters.active !== undefined || filters.onlyTunnels
                  ? "Tente ajustar os filtros ou adicionar um novo domínio"
                  : "Comece adicionando seu primeiro domínio"
                }
              </p>
              <Button onClick={() => navigate("/domains/new")} className="hover-scale">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Domínio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" 
            : "space-y-4"
          }>
            {filteredDomains.map((domain: Domain) => {
              const vps = getVpsForDomain(domain.vps_id || null);
              
              return (
                <DomainCard
                  key={domain.id}
                  domain={domain}
                  vps={vps}
                  onSwitchVps={(domain, vps) => setSwitchDialog({ 
                    open: true, 
                    domain, 
                    currentVps: vps 
                  })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Switch VPS Dialog */}
      <SwitchVpsDialog
        open={switchDialog.open}
        onOpenChange={(open) => setSwitchDialog({ open, domain: undefined, currentVps: undefined })}
        domain={switchDialog.domain}
        currentVps={switchDialog.currentVps}
      />
    </div>
  );
}