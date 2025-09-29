import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Globe, 
  Server, 
  Zap, 
  Plus, 
  Settings,
  ArrowLeft,
  Calendar,
  Activity
} from "lucide-react";
import { Api } from "@/services/api";
import { DataTable } from "@/components/ui/data-table";
import { DomainStatusBadge, HealthStatusBadge, TunnelStatusBadge } from "@/components/StatusBadge";
import { ColumnDef } from "@tanstack/react-table";
import type { Domain, VPS, Tunnel } from "@/types";

const domainColumns: ColumnDef<Domain>[] = [
  {
    accessorKey: "fqdn",
    header: "Domínio",
    cell: ({ row }) => {
      const domain = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{domain.fqdn}</div>
            <div className="text-sm text-muted-foreground">{domain.type}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => (
      <DomainStatusBadge status={getValue() as any} />
    ),
  },
  {
    accessorKey: "publishStrategy",
    header: "Estratégia",
    cell: ({ getValue }) => (
      <Badge variant="outline">
        {getValue() === 'dns' ? 'DNS Direto' : 'Tunnel'}
      </Badge>
    ),
  },
  {
    accessorKey: "lastCheckAt",
    header: "Último Check",
    cell: ({ getValue }) => {
      const date = getValue() as string;
      return date ? new Date(date).toLocaleString('pt-BR') : '-';
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="sm">
        <Link to={`/domains/${row.original.id}`}>
          Ver detalhes
        </Link>
      </Button>
    ),
  },
];

const vpsColumns: ColumnDef<VPS>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => {
      const vps = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{vps.name}</div>
            <div className="text-sm text-muted-foreground">{vps.provider}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "ipv4",
    header: "IP",
  },
  {
    accessorKey: "region",
    header: "Região",
  },
  {
    accessorKey: "health",
    header: "Saúde",
    cell: ({ getValue }) => (
      <HealthStatusBadge status={getValue() as any} />
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="sm">
        <Link to={`/vps/${row.original.id}`}>
          Ver detalhes
        </Link>
      </Button>
    ),
  },
];

const tunnelColumns: ColumnDef<Tunnel>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => {
      const tunnel = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{tunnel.name}</div>
            <div className="text-sm text-muted-foreground">{tunnel.provider}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => (
      <TunnelStatusBadge status={getValue() as any} />
    ),
  },
  {
    accessorKey: "lastSeenAt",
    header: "Última Atividade",
    cell: ({ getValue }) => {
      const date = getValue() as string;
      return date ? new Date(date).toLocaleString('pt-BR') : '-';
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="outline" size="sm" onClick={() => handleRestartTunnel(row.original.id)}>
        Reiniciar
      </Button>
    ),
  },
];

const handleRestartTunnel = async (tunnelId: string) => {
  try {
    await Api.restartTunnel(tunnelId);
    // Refresh data or show success toast
  } catch (error) {
    console.error('Error restarting tunnel:', error);
  }
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: tenantResponse, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => Api.getTenant(id!),
    enabled: !!id,
  });

  const { data: domainsResponse, isLoading: domainsLoading } = useQuery({
    queryKey: ['domains', { tenantId: id }],
    queryFn: () => Api.listDomains({ tenantId: id }),
    enabled: !!id,
  });

  const { data: vpsResponse, isLoading: vpsLoading } = useQuery({
    queryKey: ['vps', { tenantId: id }],
    queryFn: () => Api.listVps({ tenantId: id }),
    enabled: !!id,
  });

  const { data: tunnelsResponse, isLoading: tunnelsLoading } = useQuery({
    queryKey: ['tunnels', id],
    queryFn: () => Api.listTunnels(id),
    enabled: !!id,
  });

  const tenant = tenantResponse?.data;
  const domains = domainsResponse?.data.items || [];
  const vps = vpsResponse?.data.items || [];
  const tunnels = tunnelsResponse?.data || [];

  if (tenantLoading) {
    return <div>Carregando...</div>;
  }

  if (!tenant) {
    return <div>Tenant não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tenants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <p className="text-muted-foreground">/{tenant.slug}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Domínios</TabsTrigger>
          <TabsTrigger value="vps">VPS Routes</TabsTrigger>
          <TabsTrigger value="tunnels">Tunnels</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Domínios</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{domains.length}</div>
                <p className="text-xs text-muted-foreground">
                  {domains.filter(d => d.status === 'live').length} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">VPS</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vps.length}</div>
                <p className="text-xs text-muted-foreground">
                  {vps.filter(v => v.health === 'healthy').length} saudáveis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tunnels</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tunnels.length}</div>
                <p className="text-xs text-muted-foreground">
                  {tunnels.filter(t => t.status === 'connected').length} conectados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Criado em</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Há 2 horas</span>
                  <span>Domínio <code>example.com</code> verificado com sucesso</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Há 4 horas</span>
                  <span>Deploy executado em <code>SFO-1</code></span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">Ontem</span>
                  <span>VPS <code>NYC-1</code> reportou latência alta</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Domínios</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie domínios e configurações DNS
              </p>
            </div>
            <Button asChild>
              <Link to="/domains/new">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Domínio
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <DataTable
                columns={domainColumns}
                data={domains}
                searchKey="fqdn"
                searchPlaceholder="Buscar domínios..."
                isLoading={domainsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vps" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">VPS Routes</h3>
              <p className="text-sm text-muted-foreground">
                Mapeamentos de domínio para VPS
              </p>
            </div>
            <Button asChild>
              <Link to="/vps/new">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar VPS
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <DataTable
                columns={vpsColumns}
                data={vps}
                searchKey="name"
                searchPlaceholder="Buscar VPS..."
                isLoading={vpsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tunnels" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Cloudflare Tunnels</h3>
              <p className="text-sm text-muted-foreground">
                Status e logs dos túneis configurados
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Tunnel
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <DataTable
                columns={tunnelColumns}
                data={tunnels}
                searchKey="name"
                searchPlaceholder="Buscar tunnels..."
                isLoading={tunnelsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}