import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, Clock, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Api } from "@/services/api";
import { toast } from "sonner";
import { Deploy, DeployFilters } from "@/types";

interface DeploySectionProps {
  vpsId?: string;
  domainId?: string;
}

export function DeploySection({ vpsId, domainId }: DeploySectionProps) {
  const queryClient = useQueryClient();
  const [isDeploying, setIsDeploying] = useState(false);

  const { data: deploys = [], isLoading } = useQuery({
    queryKey: ['deploys', { vpsId, domainId }],
    queryFn: () => Api.listDeploys({ vpsId, limit: 10 }),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const triggerDeployMutation = useMutation({
    mutationFn: () => {
      setIsDeploying(true);
      return Api.triggerDeploy({
        vps_id: vpsId,
        domain_id: domainId,
        status: 'pending',
        tenant_id: null,
        logs: null,
        commit_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Deploy iniciado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['deploys'] });
      setIsDeploying(false);
    },
    onError: () => {
      toast.error("Erro ao iniciar deploy");
      setIsDeploying(false);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pending':
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'running':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const latestDeploy = deploys[0];
  const isCurrentlyDeploying = isDeploying || latestDeploy?.status === 'pending' || latestDeploy?.status === 'running';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deploys</CardTitle>
          <Button
            onClick={() => triggerDeployMutation.mutate()}
            disabled={isCurrentlyDeploying || triggerDeployMutation.isPending}
            size="sm"
          >
            <Play className={`h-4 w-4 mr-2 ${isCurrentlyDeploying ? 'animate-spin' : ''}`} />
            {isCurrentlyDeploying ? 'Deploying...' : 'Deploy'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isCurrentlyDeploying && (
          <Alert className="mb-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Deploy em andamento. O processo pode levar alguns minutos.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Carregando deploys...
            </div>
          ) : deploys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum deploy realizado ainda.
            </div>
          ) : (
            deploys.slice(0, 5).map((deploy) => (
              <div
                key={deploy.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(deploy.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(deploy.status)}>
                        {deploy.status}
                      </Badge>
                      {deploy.commit_hash && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {deploy.commit_hash.substring(0, 7)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(deploy.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {deploy.logs && deploy.status === 'failed' && (
                  <Button variant="ghost" size="sm">
                    Ver Logs
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {deploys.length > 5 && (
          <div className="text-center mt-4">
            <Button variant="outline" size="sm">
              Ver Todos os Deploys
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}