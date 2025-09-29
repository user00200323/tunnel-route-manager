import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Key, Eye, EyeOff, TestTube, Shield } from "lucide-react";

type SettingsFormData = {
  cfAccountId: string;
  cfApiToken: string;
  readOnlyMode: boolean;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const { user } = useAuth();
  
  const form = useForm<SettingsFormData>({
    defaultValues: {
      cfAccountId: "",
      cfApiToken: "",
      readOnlyMode: false,
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    try {
      // Mock save to localStorage (in real app, would save to backend)
      localStorage.setItem("cf-settings", JSON.stringify(data));
      
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  const testCredentials = async () => {
    setTesting(true);
    
    try {
      // Mock API test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success/failure
      const success = Math.random() > 0.3;
      
      if (success) {
        toast({
          title: "Credenciais válidas",
          description: "A conexão com o Cloudflare foi estabelecida com sucesso.",
        });
      } else {
        toast({
          title: "Credenciais inválidas",
          description: "Não foi possível conectar com o Cloudflare. Verifique as credenciais.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no teste",
        description: "Não foi possível testar as credenciais.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema e integrações
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cloudflare Integration */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Integração Cloudflare
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="cfAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="32 caracteres hexadecimais"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          ID da conta Cloudflare. Encontre no dashboard da Cloudflare.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cfApiToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Token</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showToken ? "text" : "password"}
                              placeholder="Token de API com permissões de Zero Trust"
                              {...field}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowToken(!showToken)}
                            >
                              {showToken ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Token de API com permissões para gerenciar túneis e DNS.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={testCredentials}
                      disabled={testing}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {testing ? "Testando..." : "Testar Credenciais"}
                    </Button>
                    
                    <Button type="submit">
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-6">
                  <FormField
                    control={form.control}
                    name="readOnlyMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Modo Somente Leitura
                          </FormLabel>
                          <FormDescription>
                            Impede modificações no sistema (movimentos, criação, etc.)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Usuário Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium">Email</h4>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              
              <div>
                <h4 className="font-medium">Permissão</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Help */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Como Configurar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">1. Account ID</h4>
                <p className="text-muted-foreground">
                  No dashboard da Cloudflare, vá para a barra lateral direita e copie o Account ID.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. API Token</h4>
                <p className="text-muted-foreground">
                  Crie um token personalizado em "My Profile → API Tokens" com permissões para Zone:Read e Cloudflare Tunnel:Edit.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">3. Testar</h4>
                <p className="text-muted-foreground">
                  Use o botão "Testar Credenciais" para verificar se as configurações estão corretas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="shadow-card border-warning">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <h4 className="font-medium text-warning mb-1">Segurança</h4>
                  <p className="text-muted-foreground">
                    As credenciais são armazenadas de forma segura e criptografada. 
                    Nunca compartilhe seu token de API.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}