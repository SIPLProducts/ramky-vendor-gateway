import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuditLogs } from '@/hooks/useVendors';
import { Search, Activity, User, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: logs, isLoading } = useAuditLogs();

  // Hide noisy legacy per-checkbox permission events; the bulk save event is shown instead.
  const HIDDEN_ACTIONS = new Set(['custom_role_screen_permission_changed']);

  const filteredLogs = logs?.filter((log) => {
    if (HIDDEN_ACTIONS.has(log.action)) return false;

    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
    
    return matchesSearch && matchesAction;
  }) || [];

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('approve')) {
      return <Badge className="bg-success/10 text-success">Approved</Badge>;
    }
    if (action.includes('reject')) {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    if (action.includes('submit')) {
      return <Badge className="bg-primary/10 text-primary">Submitted</Badge>;
    }
    if (action.includes('clarify')) {
      return <Badge className="bg-warning/10 text-warning">Clarification</Badge>;
    }
    if (action.includes('validation')) {
      return <Badge className="bg-blue-500/10 text-blue-600">Validation</Badge>;
    }
    if (action.includes('draft')) {
      return <Badge variant="secondary">Draft</Badge>;
    }
    return <Badge variant="secondary">{action}</Badge>;
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">Complete history of all vendor activities</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="submit">Submissions</SelectItem>
              <SelectItem value="approve">Approvals</SelectItem>
              <SelectItem value="reject">Rejections</SelectItem>
              <SelectItem value="validation">Validations</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No logs found</h3>
              <p className="text-muted-foreground">Activity will appear here as vendors are processed.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {log.user_id ? 'User' : 'System'}
                        </span>
                        {getActionBadge(log.action)}
                      </div>
                      <p className="text-sm text-foreground">{formatAction(log.action)}</p>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {typeof log.details === 'object' && 'comments' in (log.details as Record<string, unknown>)
                            ? String((log.details as Record<string, unknown>).comments)
                            : typeof log.details === 'object' && 'legal_name' in (log.details as Record<string, unknown>)
                            ? `Vendor: ${String((log.details as Record<string, unknown>).legal_name)}`
                            : JSON.stringify(log.details).slice(0, 100) + (JSON.stringify(log.details).length > 100 ? '...' : '')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleString('en-IN')}
                        {log.vendor_id && (
                          <span className="ml-2">Vendor ID: {log.vendor_id.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
