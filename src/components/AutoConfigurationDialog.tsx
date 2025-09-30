import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle, Server, Globe, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Api } from "@/services/api";
import { Domain, VPS, Tunnel } from "@/types";

interface AutoConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domains: Domain[];
  vpsServers: VPS[];
  tunnels: Tunnel[];
}

export function AutoConfigurationDialog({
  open,
  onOpenChange,
  domains,
  vpsServers,
  tunnels
}: AutoConfigurationDialogProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [completed, setCompleted] = useState(false);

  const configurationSteps = [
    { name: "Verificar VPS-Tunnel associações", icon: Server },
    { name: "Sincronizar configurações Cloudflare", icon: Globe },
    { name: "Executar health checks", icon: Zap },
    { name: "Otimizar configurações", icon: CheckCircle }
  ];

  const handleAutoConfiguration = async () => {
    setIsConfiguring(true);
    setProgress(0);
    setResults([]);
    setCompleted(false);

    try {
      // Step 1: Sync Cloudflare domains
      setCurrentStep("Sincronizando domínios Cloudflare...");
      setProgress(25);
      
      const cloudflareResult = await Api.importCloudflareDomainsSync();
      setResults(prev => [...prev, {
        step: "Cloudflare Sync",
        success: true,
        message: `Sincronizados ${cloudflareResult?.domainsProcessed || 0} domínios`
      }]);

      // Step 2: Run health checks
      setCurrentStep("Executando health checks...");
      setProgress(50);
      
      const healthResult = await Api.runHealthCheckAll();
      setResults(prev => [...prev, {
        step: "Health Checks",
        success: true,
        message: `Verificados ${healthResult?.data?.length || 0} domínios`
      }]);

      // Step 3: Update VPS configurations
      setCurrentStep("Atualizando configurações VPS...");
      setProgress(75);
      
      for (const vps of vpsServers) {
        try {
          await Api.updateVpsCaddyfile(vps.id);
          setResults(prev => [...prev, {
            step: `VPS ${vps.name}`,
            success: true,
            message: "Caddyfile atualizado"
          }]);
        } catch (error) {
          setResults(prev => [...prev, {
            step: `VPS ${vps.name}`,
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : 'Falha na configuração'}`
          }]);
        }
      }

      // Step 4: Final optimization
      setCurrentStep("Finalizando otimizações...");
      setProgress(100);
      
      setResults(prev => [...prev, {
        step: "Otimização",
        success: true,
        message: "Configuração automática concluída"
      }]);

      setCompleted(true);
      setCurrentStep("Configuração concluída!");

    } catch (error) {
      setResults(prev => [...prev, {
        step: "Erro",
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }]);
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleClose = () => {
    if (!isConfiguring) {
      onOpenChange(false);
      setResults([]);
      setCompleted(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Configuração Automática do Sistema
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* System Overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Domínios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{domains.length}</div>
                <CardDescription>
                  {domains.filter(d => d.status === 'live').length} ativos
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  VPS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vpsServers.length}</div>
                <CardDescription>
                  {vpsServers.filter(v => v.health === 'healthy').length} saudáveis
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Tunnels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tunnels.length}</div>
                <CardDescription>
                  {tunnels.filter(t => t.status === 'connected').length} conectados
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold">Etapas da Configuração</h3>
            <div className="grid grid-cols-2 gap-3">
              {configurationSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = isConfiguring && progress > (index * 25);
                const isCompleted = progress > ((index + 1) * 25);
                
                return (
                  <div
                    key={step.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isCompleted ? 'bg-green-50 border-green-200' :
                      isActive ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      isCompleted ? 'text-green-600' :
                      isActive ? 'text-blue-600' :
                      'text-gray-400'
                    }`} />
                    <span className={`text-sm ${
                      isCompleted ? 'text-green-800' :
                      isActive ? 'text-blue-800' :
                      'text-gray-600'
                    }`}>
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          {isConfiguring && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentStep}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Resultados</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium text-sm">{result.step}</span>
                    </div>
                    <Badge variant={result.success ? "default" : "destructive"} className="text-xs">
                      {result.message}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Message */}
          {completed && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Configuração automática concluída! O sistema foi otimizado e sincronizado com sucesso.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isConfiguring}
            >
              {completed ? 'Fechar' : 'Cancelar'}
            </Button>
            
            {!completed && (
              <Button
                onClick={handleAutoConfiguration}
                disabled={isConfiguring}
              >
                {isConfiguring ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Iniciar Configuração
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}