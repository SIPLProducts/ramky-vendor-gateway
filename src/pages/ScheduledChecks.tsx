import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Mail,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

interface ScheduledCheck {
  id: string;
  validation_type: string;
  vendor_id: string | null;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  is_active: boolean;
}

interface ComplianceRunResult {
  totalChecked: number;
  compliant: number;
  atRisk: number;
  nonCompliant: number;
  alertsSent: boolean;
}

export default function ScheduledChecks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<ComplianceRunResult | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');

  // Fetch scheduled validations
  const { data: scheduledChecks, isLoading } = useQuery({
    queryKey: ['scheduled-validations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_validations')
        .select('*')
        .order('next_run_at', { ascending: true });
      
      if (error) throw error;
      return data as ScheduledCheck[];
    },
  });

  // Fetch audit logs for scheduled checks
  const { data: auditLogs } = useQuery({
    queryKey: ['scheduled-check-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .in('action', ['scheduled_gst_compliance_check', 'gst_compliance_alert_sent'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Run scheduled compliance check now
  const runComplianceCheck = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      
      const { data, error } = await supabase.functions.invoke('scheduled-gst-compliance');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastRunResult(data.summary);
      toast({
        title: 'Scheduled Check Complete',
        description: `Checked ${data.summary.totalChecked} vendors. ${data.summary.nonCompliant} non-compliant, ${data.summary.atRisk} at risk.`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-validations'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-check-logs'] });
      queryClient.invalidateQueries({ queryKey: ['gst-validations'] });
    },
    onError: (error) => {
      toast({
        title: 'Check Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsRunning(false);
    },
  });

  // Create/Update scheduled check
  const createScheduledCheck = useMutation({
    mutationFn: async (frequency: string) => {
      const nextRunAt = new Date();
      if (frequency === 'daily') {
        nextRunAt.setDate(nextRunAt.getDate() + 1);
      } else if (frequency === 'weekly') {
        nextRunAt.setDate(nextRunAt.getDate() + 7);
      } else if (frequency === 'monthly') {
        nextRunAt.setMonth(nextRunAt.getMonth() + 1);
      }

      const { error } = await supabase
        .from('scheduled_validations')
        .upsert({
          validation_type: 'gst_compliance',
          next_run_at: nextRunAt.toISOString(),
          is_active: true,
        }, {
          onConflict: 'validation_type',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Schedule Updated',
        description: `GST compliance checks scheduled ${scheduleFrequency}`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-validations'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Update Schedule',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduled Compliance Checks</h1>
          <p className="text-muted-foreground">
            Configure and monitor automated GST compliance verification
          </p>
        </div>
        
        <Button 
          onClick={() => runComplianceCheck.mutate()}
          disabled={isRunning}
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Check...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
      </div>

      {/* Last Run Results */}
      {lastRunResult && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Last Check Completed</h3>
                <p className="text-sm text-muted-foreground">Just now</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{lastRunResult.totalChecked}</p>
                <p className="text-xs text-muted-foreground">Total Checked</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{lastRunResult.compliant}</p>
                <p className="text-xs text-muted-foreground">Compliant</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{lastRunResult.atRisk}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{lastRunResult.nonCompliant}</p>
                <p className="text-xs text-muted-foreground">Non-Compliant</p>
              </div>
            </div>
            {lastRunResult.alertsSent && (
              <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                <Mail className="h-4 w-4" />
                Alerts sent to finance team
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Configuration */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Configuration
            </CardTitle>
            <CardDescription>
              Configure how often GST compliance checks run automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Check Frequency</Label>
              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">GST Compliance Check</p>
                  <p className="text-sm text-muted-foreground">Verify all vendor GST filing status</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">Send alerts for non-compliant vendors</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <Button 
              onClick={() => createScheduledCheck.mutate(scheduleFrequency)}
              disabled={createScheduledCheck.isPending}
              className="w-full"
            >
              {createScheduledCheck.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="mr-2 h-4 w-4" />
              )}
              Save Schedule
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Checks
            </CardTitle>
            <CardDescription>
              Next scheduled compliance verification runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !scheduledChecks?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No scheduled checks configured</p>
                <p className="text-sm">Set up a schedule to automate compliance checks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{check.validation_type.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        Next: {format(new Date(check.next_run_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                    <Badge variant={check.is_active ? 'default' : 'secondary'}>
                      {check.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Check History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check History</CardTitle>
          <CardDescription>
            Log of recent scheduled compliance checks and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!auditLogs?.length ? (
            <p className="text-center py-8 text-muted-foreground">No check history available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => {
                  const details = log.details as any;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {log.action === 'gst_compliance_alert_sent' ? (
                            <Mail className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Shield className="h-4 w-4 text-primary" />
                          )}
                          {log.action === 'gst_compliance_alert_sent' ? 'Alert Sent' : 'Compliance Check'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.action === 'scheduled_gst_compliance_check' ? (
                          <span>
                            Checked {details?.totalVendors || 0} vendors. 
                            {details?.compliant || 0} compliant, 
                            {details?.nonCompliant || 0} non-compliant.
                          </span>
                        ) : (
                          <span>
                            {details?.nonCompliantCount || 0} non-compliant, 
                            {details?.atRiskCount || 0} at-risk vendors
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
