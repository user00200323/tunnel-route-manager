import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { RotateCcw, Server, AlertTriangle, CheckCircle, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface SyncReport {
  database_domains: string[];
  vps_domains: string[];
  missing_in_vps: string[];
  missing_in_db: string[];
  cname_checks: { [key: string]: boolean };
  agent_status: 'online' | 'offline' | 'error';
  fixes_applied: string[];
  recommendations: string[];
}

interface VpsSyncProps {
  vpsId: string;
  vpsName: string;
  onSyncComplete?: () => void;
}

export function VpsSyncComponent({ vpsId, vpsName, onSyncComplete }: VpsSyncProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [caddyfileContent, setCaddyfileContent] = useState<string>('');

  const runSync = async (autoFix = false) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync', {
        body: { 
          hosts: [
            "merlibre.shop", "mercallbr.shop", "mercallbre.shop", 
            "mlibre.shop", "mercalibr.shop", "merclibre.shop", 
            "mllibre.shop", "mercliibre.shop", "mercalbrr.shop"
          ],
          include_www: false,
          vpsId,
          autoFix 
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSyncReport(data.report);
        setCaddyfileContent(data.caddyfile_content || '');
        
        if (autoFix && data.report.fixes_applied && data.report.fixes_applied.length > 0) {
          toast.success(`Sync completed: ${data.report.fixes_applied.join(', ')}`);
          onSyncComplete?.();
        } else {
          toast.success('VPS sync analysis completed');
        }
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'default';
    if (count <= 2) return 'secondary';
    return 'destructive';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              VPS Sync: {vpsName}
            </CardTitle>
            <CardDescription>
              Synchronize domain configuration between database and VPS
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => runSync(false)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
            {syncReport && (
              <Button
                onClick={() => runSync(true)}
                disabled={isLoading || (syncReport?.agent_status !== 'online')}
                size="sm"
              >
                Auto-Fix Issues
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {syncReport && (
          <>
            {/* Agent Status */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              {syncReport.agent_status === 'online' ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">VPS Agent Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">VPS Agent Offline</span>
                </>
              )}
            </div>

            {/* Status Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge variant="outline" className="mb-1">
                  DB Domains
                </Badge>
                <div className="text-2xl font-bold">{syncReport.database_domains.length}</div>
              </div>
              <div className="text-center">
                <Badge variant="outline" className="mb-1">
                  VPS Domains
                </Badge>
                <div className="text-2xl font-bold">{syncReport.vps_domains.length}</div>
              </div>
              <div className="text-center">
                <Badge variant={getSeverityColor(syncReport.missing_in_vps.length)} className="mb-1">
                  Missing in VPS
                </Badge>
                <div className="text-2xl font-bold">{syncReport.missing_in_vps.length}</div>
              </div>
              <div className="text-center">
                <Badge variant={getSeverityColor(syncReport.missing_in_db.length)} className="mb-1">
                  Missing in DB
                </Badge>
                <div className="text-2xl font-bold">{syncReport.missing_in_db.length}</div>
              </div>
            </div>

            <Separator />

            {/* CNAME Status */}
            {Object.keys(syncReport.cname_checks).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">CNAME Records Status:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(syncReport.cname_checks).map(([domain, valid]) => (
                    <div key={domain} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{domain}</span>
                      {valid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Issues */}
            {(syncReport.missing_in_vps.length > 0 || 
              syncReport.missing_in_db.length > 0) ? (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Issues Found
                </h4>

                {syncReport.missing_in_vps.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>Domains in DB but not in VPS Caddyfile:</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {syncReport.missing_in_vps.map(domain => (
                          <Badge key={domain} variant="destructive" className="text-xs">
                            {domain}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {syncReport.missing_in_db.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>Domains in VPS but not in DB:</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {syncReport.missing_in_db.map(domain => (
                          <Badge key={domain} variant="secondary" className="text-xs">
                            {domain}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Remove the tunnel_id_fixes_needed and orphaned_domains sections */}
              </div>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>✅ All domains are synchronized!</strong> No issues found.
                </AlertDescription>
              </Alert>
            )}

            {/* Applied Fixes */}
            {syncReport.fixes_applied && syncReport.fixes_applied.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Applied Fixes:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {syncReport.fixes_applied.map((fix, index) => (
                    <li key={index}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {syncReport.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {syncReport.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* VPS Domains */}
            {syncReport.vps_domains.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Active VPS Domains ({syncReport.vps_domains.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {syncReport.vps_domains.map(domain => (
                    <Badge key={domain} variant="outline" className="text-xs">
                      {domain}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Caddyfile Preview */}
            {caddyfileContent && (
              <details className="space-y-2">
                <summary className="font-semibold cursor-pointer">
                  View Caddyfile Content (first 120 lines)
                </summary>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                  {caddyfileContent}
                </pre>
              </details>
            )}
          </>
        )}

        {!syncReport && !isLoading && (
          <Alert>
            <AlertDescription>
              Click "Analyze" to compare domains between database and VPS Caddyfile.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}