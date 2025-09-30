import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { RotateCcw, Server, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface SyncReport {
  database_domains: string[];
  vps_domains: string[];
  missing_in_vps: string[];
  missing_in_db: string[];
  tunnel_id_fixes_needed: Array<{
    id: string;
    hostname: string;
    vps_id: string | null;
    tunnel_id: string | null;
    status: string;
  }>;
  orphaned_domains: Array<{
    id: string;
    hostname: string;
    vps_id: string | null;
    tunnel_id: string | null;
    status: string;
  }>;
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
      const { data, error } = await supabase.functions.invoke('sync-vps-domains', {
        body: { 
          action: 'sync', 
          vpsId,
          autoFix 
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSyncReport(data.report);
        setCaddyfileContent(data.caddyfile_content || '');
        
        if (autoFix && data.report.recommendations.length > 0) {
          toast.success(`Sync completed: ${data.report.recommendations.join(', ')}`);
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
                disabled={isLoading}
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

            {/* Issues */}
            {(syncReport.missing_in_vps.length > 0 || 
              syncReport.missing_in_db.length > 0 || 
              syncReport.tunnel_id_fixes_needed.length > 0 ||
              syncReport.orphaned_domains.length > 0) ? (
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

                {syncReport.tunnel_id_fixes_needed.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>Domains needing tunnel_id correction:</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {syncReport.tunnel_id_fixes_needed.map(domain => (
                          <Badge key={domain.id} variant="secondary" className="text-xs">
                            {domain.hostname}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {syncReport.orphaned_domains.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>Orphaned domains (no VPS assignment):</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {syncReport.orphaned_domains.map(domain => (
                          <Badge key={domain.id} variant="destructive" className="text-xs">
                            {domain.hostname}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>✅ All domains are synchronized!</strong> No issues found.
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            {syncReport.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Applied Fixes:</h4>
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