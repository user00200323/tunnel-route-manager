import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Loader2, 
  Radio,
  AlertCircle 
} from "lucide-react";

// Health status
interface HealthStatusProps {
  status: "healthy" | "degraded" | "down" | "unknown";
  size?: "sm" | "default";
}

export function HealthStatusBadge({ status, size = "default" }: HealthStatusProps) {
  const getConfig = () => {
    switch (status) {
      case "healthy":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          label: "Saudável",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "degraded":
        return {
          variant: "secondary" as const,
          icon: AlertTriangle,
          label: "Degradado",
          className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
        };
      case "down":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Inativo",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        };
      case "unknown":
        return {
          variant: "outline" as const,
          icon: AlertCircle,
          label: "Desconhecido",
          className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <IconComponent size={iconSize} />
      {config.label}
    </Badge>
  );
}

// Domain status
interface DomainStatusProps {
  status: "pending" | "propagating" | "live" | "error";
  size?: "sm" | "default";
}

export function DomainStatusBadge({ status, size = "default" }: DomainStatusProps) {
  const getConfig = () => {
    switch (status) {
      case "live":
        return {
          variant: "default" as const,
          icon: Radio,
          label: "Ativo",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "propagating":
        return {
          variant: "secondary" as const,
          icon: Loader2,
          label: "Propagando",
          className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
          animate: true,
        };
      case "pending":
        return {
          variant: "outline" as const,
          icon: Clock,
          label: "Pendente",
          className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        };
      case "error":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Erro",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <IconComponent 
        size={iconSize} 
        className={config.animate ? "animate-spin" : ""} 
      />
      {config.label}
    </Badge>
  );
}

// Deploy status
interface DeployStatusProps {
  status: "pending" | "running" | "success" | "failed";
  size?: "sm" | "default";
}

export function DeployStatusBadge({ status, size = "default" }: DeployStatusProps) {
  const getConfig = () => {
    switch (status) {
      case "success":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          label: "Sucesso",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "running":
        return {
          variant: "secondary" as const,
          icon: Loader2,
          label: "Executando",
          className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
          animate: true,
        };
      case "pending":
        return {
          variant: "outline" as const,
          icon: Clock,
          label: "Pendente",
          className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        };
      case "failed":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Falhou",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <IconComponent 
        size={iconSize} 
        className={config.animate ? "animate-spin" : ""} 
      />
      {config.label}
    </Badge>
  );
}

// Tunnel status
interface TunnelStatusProps {
  status: "connected" | "disconnected" | "error";
  size?: "sm" | "default";
}

export function TunnelStatusBadge({ status, size = "default" }: TunnelStatusProps) {
  const getConfig = () => {
    switch (status) {
      case "connected":
        return {
          variant: "default" as const,
          icon: Radio,
          label: "Conectado",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "disconnected":
        return {
          variant: "outline" as const,
          icon: XCircle,
          label: "Desconectado",
          className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        };
      case "error":
        return {
          variant: "destructive" as const,
          icon: AlertTriangle,
          label: "Erro",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <IconComponent size={iconSize} />
      {config.label}
    </Badge>
  );
}