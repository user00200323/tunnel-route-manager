import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  RefreshCw, 
  Info, 
  ExternalLink,
  Settings
} from 'lucide-react';
import type { DomainHealth } from '@/services/domainHealthService';

interface DomainErrorDisplayProps {
  domain: {
    id: string;
    hostname: string;
    publish_strategy: string;
    status: string;
    error_message?: string;
    vps_id?: string;
  };
  health?: DomainHealth;
  onRetry?: () => void;
  onConfigure?: () => void;
  onViewDetails?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function DomainErrorDisplay({ 
  domain, 
  health, 
  onRetry,
  onConfigure,
  onViewDetails,
  size = 'md' 
}: DomainErrorDisplayProps) {
  const getErrors = () => {
    const errors: { code: string; message: string; severity: 'error' | 'warning' | 'info' }[] = [];

    if (!health) {
      errors.push({
        code: 'NO_HEALTH_DATA',
        message: 'Nenhum dado de saúde disponível',
        severity: 'warning'
      });
      return errors;
    }

    const details = health.details || {};

    // DNS/CNAME errors
    if (domain.publish_strategy === 'tunnel') {
      if (!health.dnsOk) {
        if (details.cnameFound && details.expectedCname) {
          errors.push({
            code: 'CNAME_INCORRECT',
            message: `CNAME incorreto: ${details.cnameFound}, esperado: ${details.expectedCname}`,
            severity: 'error'
          });
        } else {
          errors.push({
            code: 'CNAME_MISSING',
            message: 'CNAME não configurado no DNS',
            severity: 'error'
          });
        }
      }
    }

    // Tunnel errors
    if (domain.publish_strategy === 'tunnel' && health.tunnelOk === false) {
      if (details.tunnelConnections === 0) {
        errors.push({
          code: 'TUNNEL_NO_CONNECTIONS',
          message: 'Túnel sem conexões ativas',
          severity: 'error'
        });
      } else if (details.tunnelError) {
        errors.push({
          code: 'TUNNEL_ERROR',
          message: `Erro no túnel: ${details.tunnelError}`,
          severity: 'error'
        });
      }
    }

    // VPS Agent errors
    if (domain.vps_id && health.agentOk === false) {
      if (details.agentStatus === 404) {
        errors.push({
          code: 'AGENT_NOT_FOUND',
          message: 'Agent VPS não encontrado - verifique se está executando',
          severity: 'error'
        });
      } else if (details.agentStatus >= 500) {
        errors.push({
          code: 'AGENT_SERVER_ERROR',
          message: `Agent VPS com erro interno (${details.agentStatus})`,
          severity: 'error'
        });
      } else if (details.agentRequestError) {
        if (details.agentRequestError.includes('timeout')) {
          errors.push({
            code: 'AGENT_TIMEOUT',
            message: 'Agent VPS não responde (timeout)',
            severity: 'warning'
          });
        } else {
          errors.push({
            code: 'AGENT_CONNECTION_ERROR',
            message: `Falha na comunicação com VPS: ${details.agentRequestError}`,
            severity: 'error'
          });
        }
      } else {
        errors.push({
          code: 'AGENT_UNKNOWN_ERROR',
          message: `Agent VPS indisponível (status: ${details.agentStatus})`,
          severity: 'warning'
        });
      }
    }

    // Domain status errors
    if (domain.status === 'error' && domain.error_message) {
      errors.push({
        code: 'DOMAIN_STATUS_ERROR',
        message: domain.error_message,
        severity: 'error'
      });
    }

    return errors;
  };

  const getRecommendations = () => {
    const errors = getErrors();
    const recommendations: string[] = [];

    errors.forEach(error => {
      switch (error.code) {
        case 'CNAME_MISSING':
        case 'CNAME_INCORRECT':
          recommendations.push('Configure o CNAME no seu provedor DNS');
          break;
        case 'TUNNEL_NO_CONNECTIONS':
          recommendations.push('Verifique se o cloudflared está executando no VPS');
          break;
        case 'AGENT_NOT_FOUND':
        case 'AGENT_TIMEOUT':
          recommendations.push('Instale ou reinicie o agent VPS');
          break;
        case 'AGENT_CONNECTION_ERROR':
          recommendations.push('Verifique a conectividade da rede com o VPS');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  };

  const errors = getErrors();
  const recommendations = getRecommendations();

  if (errors.length === 0) {
    return null;
  }

  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  return (
    <div className="space-y-3">
      {/* Critical Errors */}
      {criticalErrors.length > 0 && (
        <Alert variant="destructive" className={size === 'sm' ? 'py-2' : ''}>
          <AlertTriangle className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'}`} />
          <AlertDescription className={size === 'sm' ? 'text-xs' : ''}>
            <div className="space-y-2">
              <div className="font-medium">
                {criticalErrors.length} erro{criticalErrors.length > 1 ? 's' : ''} crítico{criticalErrors.length > 1 ? 's' : ''}:
              </div>
              <ul className="space-y-1">
                {criticalErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge variant="destructive" className={size === 'sm' ? 'text-xs py-0' : ''}>
                      {error.code}
                    </Badge>
                    <span className="flex-1">{error.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="default" className={`border-amber-200 ${size === 'sm' ? 'py-2' : ''}`}>
          <Info className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} text-amber-600`} />
          <AlertDescription className={size === 'sm' ? 'text-xs' : ''}>
            <div className="space-y-2">
              <div className="font-medium text-amber-800">
                {warnings.length} aviso{warnings.length > 1 ? 's' : ''}:
              </div>
              <ul className="space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge variant="secondary" className={size === 'sm' ? 'text-xs py-0' : ''}>
                      {warning.code}
                    </Badge>
                    <span className="flex-1">{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Alert className={`border-blue-200 bg-blue-50 ${size === 'sm' ? 'py-2' : ''}`}>
          <Settings className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} text-blue-600`} />
          <AlertDescription className={size === 'sm' ? 'text-xs' : ''}>
            <div className="space-y-2">
              <div className="font-medium text-blue-800">Recomendações:</div>
              <ul className="space-y-1 text-blue-700">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button 
            variant="outline" 
            size={size === 'sm' ? 'sm' : 'default'}
            onClick={onRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar Novamente
          </Button>
        )}
        
        {onConfigure && (
          <Button 
            variant="default" 
            size={size === 'sm' ? 'sm' : 'default'}
            onClick={onConfigure}
            className="flex items-center gap-2"
          >
            <Settings className="h-3 w-3" />
            Auto-configurar
          </Button>
        )}
        
        {onViewDetails && (
          <Button 
            variant="ghost" 
            size={size === 'sm' ? 'sm' : 'default'}
            onClick={onViewDetails}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-3 w-3" />
            Ver Detalhes
          </Button>
        )}
      </div>
    </div>
  );
}