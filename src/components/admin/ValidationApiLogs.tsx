import { forwardRef } from 'react';
import { useValidationApiLogs, ValidationApiLog } from '@/hooks/useValidationOrchestrator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

interface ValidationApiLogsProps {
  vendorId?: string;
}

export const ValidationApiLogs = forwardRef<HTMLDivElement, ValidationApiLogsProps>(
  function ValidationApiLogs({ vendorId }, ref) {
  const { data: logs, isLoading, refetch } = useValidationApiLogs(vendorId);

  if (isLoading) {
    return (
      <div ref={ref} className="flex items-center justify-center h-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card ref={ref}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            API Audit Logs
          </CardTitle>
          <CardDescription>
            Complete request/response history for compliance and debugging
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Execution Time</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {log.validation_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.api_provider || '—'}
                  </TableCell>
                  <TableCell>
                    {log.is_success ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">
                        {log.execution_time_ms ? `${log.execution_time_ms}ms` : '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <LogDetailDialog log={log} />
                  </TableCell>
                </TableRow>
              ))}

              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No API logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

function LogDetailDialog({ log }: { log: ValidationApiLog }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            API Call Details
          </DialogTitle>
          <DialogDescription>
            {format(new Date(log.created_at), 'MMMM dd, yyyy HH:mm:ss')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Validation Type</p>
                <p className="font-medium capitalize">{log.validation_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">API Provider</p>
                <p className="font-medium">{log.api_provider || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status Code</p>
                <p className="font-medium">{log.response_status || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Execution Time</p>
                <p className="font-medium">{log.execution_time_ms ? `${log.execution_time_ms}ms` : 'N/A'}</p>
              </div>
            </div>

            {log.error_message && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Error Message</p>
                <pre className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive overflow-x-auto">
                  {log.error_message}
                </pre>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Request Payload</p>
              <pre className="p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                {log.request_payload ? JSON.stringify(log.request_payload, null, 2) : 'No request data'}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Response Payload</p>
              <pre className="p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                {log.response_payload ? JSON.stringify(log.response_payload, null, 2) : 'No response data'}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}