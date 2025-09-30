import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Circle, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Info
} from 'lucide-react';

interface HealthStatus {
  status: 'success' | 'warning' | 'error' | 'loading' | 'idle';
  label: string;
  color: string;
  details?: string;
}

interface HealthIndicatorProps {
  healthStatus: HealthStatus;
  onRetry?: () => void;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function HealthIndicator({ 
  healthStatus, 
  onRetry, 
  showDetails = true,
  size = 'md' 
}: HealthIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getIcon = () => {
    const iconClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
    
    switch (healthStatus.status) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-emerald-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-amber-600`} />;
      case 'error':
        return <Circle className={`${iconClass} fill-current text-red-600`} />;
      case 'loading':
        return <RefreshCw className={`${iconClass} text-blue-600 animate-spin`} />;
      default:
        return <Circle className={`${iconClass} text-gray-400`} />;
    }
  };

  const getBadgeVariant = () => {
    switch (healthStatus.status) {
      case 'success':
        return 'default' as const;
      case 'warning':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      case 'loading':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const content = (
    <div className="flex items-center gap-2">
      {getIcon()}
      <span className={`text-${size === 'sm' ? 'xs' : 'sm'} font-medium ${healthStatus.color}`}>
        {healthStatus.label}
      </span>
      {onRetry && healthStatus.status === 'error' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-6 w-6 p-0 hover:bg-red-100"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
      {showDetails && healthStatus.details && (
        <Info className="h-3 w-3 text-muted-foreground" />
      )}
    </div>
  );

  if (showDetails && healthStatus.details) {
    return (
      <TooltipProvider>
        <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-medium">{healthStatus.label}</div>
              <div className="text-xs text-muted-foreground">
                {healthStatus.details}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}