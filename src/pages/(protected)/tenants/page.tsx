import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Users, Globe, Server } from "lucide-react";
import { Api } from "@/services/api";
import type { Tenant } from "@/types";

const columns: ColumnDef<Tenant>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => {
      const tenant = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{tenant.name}</div>
            <div className="text-sm text-muted-foreground">ID: {tenant.id}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Criado em",
    cell: ({ getValue }) => {
      const date = new Date(getValue() as string);
      return date.toLocaleDateString('pt-BR');
    },
  },
  {
    id: "domains",
    header: "Domínios",
    cell: () => (
      <Badge variant="secondary">
        {Math.floor(Math.random() * 10) + 1}
      </Badge>
    ),
  },
  {
    id: "vps",
    header: "VPS",
    cell: () => (
      <Badge variant="outline">
        {Math.floor(Math.random() * 5) + 1}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/tenants/${row.original.id}`}>
            Ver detalhes
          </Link>
        </Button>
      </div>
    ),
  },
];

export default function TenantsPage() {
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => Api.listTenants(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Gerencie clientes e projetos
          </p>
        </div>
        <Button asChild>
          <Link to="/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Tenant
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 desde o mês passado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Domínios</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              +5 desde a semana passada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de VPS</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              +1 desde ontem
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Tenants</CardTitle>
          <CardDescription>
            Lista completa de clientes e projetos configurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={tenants}
            searchKey="name"
            searchPlaceholder="Buscar tenants..."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}