import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVendorStats, useVendors } from '@/hooks/useVendors';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  FileText,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { userRole: authRole } = useAuth();
  const userRole = authRole || 'vendor';
  const { data: stats, isLoading: statsLoading } = useVendorStats();
  const { data: recentVendors, isLoading: vendorsLoading } = useVendors();

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'status-info' },
      submitted: { label: 'Submitted', className: 'status-info' },
      validation_pending: { label: 'Validating', className: 'status-pending' },
      validation_failed: { label: 'Validation Failed', className: 'status-error' },
      finance_review: { label: 'Finance Review', className: 'status-pending' },
      finance_approved: { label: 'Finance Approved', className: 'status-success' },
      finance_rejected: { label: 'Finance Rejected', className: 'status-error' },
      purchase_review: { label: 'Purchase Review', className: 'status-pending' },
      purchase_approved: { label: 'Purchase Approved', className: 'status-success' },
      purchase_rejected: { label: 'Purchase Rejected', className: 'status-error' },
      sap_synced: { label: 'SAP Synced', className: 'status-success' },
    };
    const { label, className } = config[status] || { label: status, className: 'status-info' };
    return <span className={`status-badge ${className}`}>{label}</span>;
  };

  const displayStats = stats || {
    total: 0,
    pendingFinance: 0,
    pendingPurchase: 0,
    approved: 0,
    validationFailed: 0,
    draft: 0,
  };

  const displayVendors = recentVendors?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of vendor onboarding activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendors
            </CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold">{displayStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1 text-success" />
                  All registered vendors
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {(userRole === 'finance' || userRole === 'admin') && (
          <Card className="border-warning/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Finance Review
              </CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-warning">{displayStats.pendingFinance}</div>
                  <Link to="/finance/review">
                    <Button variant="link" className="p-0 h-auto text-xs mt-1">
                      View all <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {(userRole === 'purchase' || userRole === 'admin') && (
          <Card className="border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Purchase Approval
              </CardTitle>
              <FileText className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-primary">{displayStats.pendingPurchase}</div>
                  <Link to="/purchase/approval">
                    <Button variant="link" className="p-0 h-auto text-xs mt-1">
                      View all <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              SAP Synced
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-success">{displayStats.approved}</div>
                <p className="text-xs text-muted-foreground mt-1">Active vendors</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Validation Failed
            </CardTitle>
            <XCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-destructive">{displayStats.validationFailed}</div>
                <p className="text-xs text-muted-foreground mt-1">Require attention</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
            <CardDescription>Latest vendor registration activities</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : displayVendors.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No vendors registered yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {vendor.legal_name || 'Unnamed Vendor'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vendor.registered_city}, {vendor.registered_state}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(vendor.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(vendor.updated_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(userRole === 'finance' || userRole === 'admin') && (
              <Link to="/finance/review">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Clock className="h-4 w-4 text-warning" />
                  Review Pending Vendors ({displayStats.pendingFinance})
                </Button>
              </Link>
            )}
            {(userRole === 'purchase' || userRole === 'admin') && (
              <Link to="/purchase/approval">
                <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Approve Vendors ({displayStats.pendingPurchase})
                </Button>
              </Link>
            )}
            <Link to="/vendors">
              <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                <Users className="h-4 w-4" />
                View All Vendors
              </Button>
            </Link>
            <Link to="/audit-logs">
              <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                View Audit Logs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
