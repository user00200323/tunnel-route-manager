import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface HealthPillProps {
  status: "healthy" | "degraded" | "down";
  size?: "sm" | "default";
}

export function HealthPill({ status, size = "default" }: HealthPillProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "healthy":
        return {
          variant: "success" as const,
          icon: CheckCircle,
          label: "Saudável",
        };
      case "degraded":
        return {
          variant: "warning" as const,
          icon: AlertTriangle,
          label: "Degradado",
        };
      case "down":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Inativo",
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge variant={config.variant} className="gap-1">
      <IconComponent size={iconSize} />
      {config.label}
    </Badge>
  );
}