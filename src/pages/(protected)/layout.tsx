import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Server, 
  Globe, 
  Settings, 
  LogOut, 
  BarChart3,
  Moon,
  Sun,
  Plus,
  Users
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/login");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Tenants", href: "/tenants", icon: Users },
    { name: "Domínios", href: "/domains", icon: Globe },
    { name: "VPS", href: "/vps", icon: Server },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === "/") return "Dashboard";
    if (path.startsWith("/tenants")) {
      if (path === "/tenants") return "Tenants";
      return "Detalhes do Tenant";
    }
    if (path.startsWith("/domains")) {
      if (path === "/domains") return "Domínios";
      if (path === "/domains/new") return "Novo Domínio";
      return "Detalhes do Domínio";
    }
    if (path.startsWith("/vps")) {
      if (path === "/vps") return "VPS";
      if (path === "/vps/new") return "Nova VPS";
      return "Detalhes da VPS";
    }
    if (path === "/settings") return "Configurações";
    return "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-primary p-2 rounded-lg">
                  <Server className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">RotaDomínios</span>
              </div>
              
              <nav className="hidden md:flex space-x-6">
                {navigation.map((item) => {
                  const isActive = item.href === "/" 
                    ? location.pathname === "/" 
                    : location.pathname.startsWith(item.href);
                  
                  return (
                    <Button
                      key={item.name}
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => navigate(item.href)}
                      className="flex items-center space-x-2"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Button>
                  );
                })}
              </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Quick Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/domains/new")}>
                    <Globe className="h-4 w-4 mr-2" />
                    Novo Domínio
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/vps/new")}>
                    <Server className="h-4 w-4 mr-2" />
                    Nova VPS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="h-9 w-9 p-0"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 p-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.email}</p>
                      <p className="text-xs text-muted-foreground">Admin</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold">{getBreadcrumb()}</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}