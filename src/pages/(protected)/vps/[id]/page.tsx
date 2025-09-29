import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Server, 
  Activity, 
  Globe,
  Play,
  Trash2,
  Save
} from "lucide-react";
import { HealthPill } from "@/components/HealthPill";
import { Copyable } from "@/components/Copyable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { VPS, Domain, HealthCheck } from "@/models";

const fetchVpsDetails = async (id: string) => {
  // Mock implementation
  const vpsList = await import("@/mocks/vps.json");
  const domains = await import("@/mocks/domains.json");
  const checks = await import("@/mocks/checks.json");
  
  const vps = vpsList.default.find(v => v.id === id);
  if (!vps) throw new Error("VPS não encontrada");
  
  const vpsDomains = domains.default.filter(d => d.currentVpsId === id);
  const vpsChecks = checks.default.filter(c => c.vpsId === id);
  
  return {
    vps,
    domains: vpsDomains,
    checks: vpsChecks.slice(0, 10), // últimos 10
  };
};

export default function VpsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vps", id],
    queryFn: () => fetchVpsDetails(id!),
    enabled: !!id,
  });

  // Update notes when data loads
  React.useEffect(() => {
    if (data?.vps.notes) {
      setNotes(data.vps.notes);
    }
  }, [data?.vps.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesChanged(value !== (data?.vps?.notes || ""));
  };

  const handleSaveNotes = () => {
    // Mock save
    setNotesChanged(false);
    // toast success
  };

  const handleRunHealthCheck = () => {
    // Mock health check
    console.log("Running health check for VPS:", id);
  };

  const handleDeleteVps = () => {
    // Mock delete
    console.log("Deleting VPS:", id);
    navigate("/vps");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">VPS não encontrada</h3>
        <Button onClick={() => navigate("/vps")}>
          Voltar para VPS
        </Button>
      </div>
    );
  }

  const { vps, domains, checks } = data!;

  return (
    <>
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
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">{vps.name}</h1>
              <HealthPill status={vps.status as any} />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <Copyable 
                text={vps.tunnelId} 
                label="Tunnel ID"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRunHealthCheck}>
              <Play className="h-4 w-4 mr-2" />
              Health Check
            </Button>
            {domains.length === 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Health Status */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Status de Saúde
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Status Atual</h4>
                    <HealthPill status={vps.status as any} />
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Último Heartbeat</h4>
                    <p className="text-sm text-muted-foreground">
                      {vps.lastSeenAt 
                        ? new Date(vps.lastSeenAt).toLocaleString("pt-BR")
                        : "Nunca"
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Últimos Health Checks</h4>
                    <Button size="sm" variant="outline" onClick={handleRunHealthCheck}>
                      <Play className="h-3 w-3 mr-1" />
                      Executar Check
                    </Button>
                  </div>
                  
                  {checks.length > 0 ? (
                    <div className="space-y-2">
                      {checks.map((check, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">
                              {check.hostname || "Sistema"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(check.checkedAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={check.status === 200 ? "success" : "destructive"}>
                              {check.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {check.latencyMs}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum health check realizado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Domains */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Domínios na VPS ({domains.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {domains.length > 0 ? (
                  <div className="space-y-3">
                    {domains.map((domain: Domain) => (
                      <div 
                        key={domain.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/domains/${domain.id}`)}
                      >
                        <div>
                          <p className="font-medium">{domain.hostname}</p>
                          <p className="text-sm text-muted-foreground">
                            Criado em {new Date(domain.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant={domain.active ? "default" : "outline"}>
                          {domain.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum domínio configurado para esta VPS
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline" onClick={handleRunHealthCheck}>
                  <Activity className="h-4 w-4 mr-2" />
                  Rodar Health Check
                </Button>
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={vps.status !== "down"}
                >
                  Reativar VPS
                </Button>
                
                {domains.length === 0 && (
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar VPS
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Notas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Adicione notas sobre esta VPS..."
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  className="min-h-[120px]"
                />
                
                {notesChanged && (
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes}
                    className="w-full"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Salvar Notas
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium">Tunnel ID</h4>
                  <Copyable text={vps.tunnelId} />
                </div>
                
                <div>
                  <h4 className="font-medium">Status</h4>
                  <HealthPill status={vps.status as any} size="sm" />
                </div>
                
                <div>
                  <h4 className="font-medium">Domínios</h4>
                  <p className="text-muted-foreground">{domains.length} configurados</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Deletar VPS"
        description={`Tem certeza que deseja deletar a VPS "${vps.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Deletar"
        variant="destructive"
        onConfirm={handleDeleteVps}
      />
    </>
  );
}