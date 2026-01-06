import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mockVendors } from '@/data/mockVendors';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  FileText,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { userRole: authRole } = useAuth();
  const userRole = authRole || 'vendor';
  const stats = {
    total: mockVendors.length,
    pendingFinance: mockVendors.filter(v => v.status === 'finance_review').length,
    pendingPurchase: mockVendors.filter(v => v.status === 'purchase_review').length,
    approved: mockVendors.filter(v => v.status === 'sap_synced').length,
    validationFailed: mockVendors.filter(v => v.status === 'validation_failed').length,
    draft: mockVendors.filter(v => v.status === 'draft').length,
  };

  const recentVendors = mockVendors
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'status-info' },
      submitted: { label: 'Submitted', className: 'status-info' },
      validation_pending: { label: 'Validating', className: 'status-pending' },
      validation_failed: { label: 'Validation Failed', className: 'status-error' },
      finance_review: { label: 'Finance Review', className: 'status-pending' },
      finance_approved: { label: 'Finance Approved', className: 'status-success' },
      purchase_review: { label: 'Purchase Review', className: 'status-pending' },
      purchase_approved: { label: 'Purchase Approved', className: 'status-success' },
      sap_synced: { label: 'SAP Synced', className: 'status-success' },
    };
    const { label, className } = config[status] || { label: status, className: 'status-info' };
    return <span className={`status-badge ${className}`}>{label}</span>;
  };

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
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1 text-success" />
              +2 this week
            </p>
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
              <div className="text-3xl font-bold text-warning">{stats.pendingFinance}</div>
              <Link to="/finance/review">
                <Button variant="link" className="p-0 h-auto text-xs mt-1">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
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
              <div className="text-3xl font-bold text-primary">{stats.pendingPurchase}</div>
              <Link to="/purchase/approval">
                <Button variant="link" className="p-0 h-auto text-xs mt-1">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
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
            <div className="text-3xl font-bold text-success">{stats.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">Active vendors</p>
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
            <div className="text-3xl font-bold text-destructive">{stats.validationFailed}</div>
            <p className="text-xs text-muted-foreground mt-1">Require attention</p>
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
            <div className="space-y-4">
              {recentVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {vendor.formData.organization.legalName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {vendor.formData.organization.registeredCity}, {vendor.formData.organization.registeredState}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(vendor.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(vendor.updatedAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
                  Review Pending Vendors ({stats.pendingFinance})
                </Button>
              </Link>
            )}
            {(userRole === 'purchase' || userRole === 'admin') && (
              <Link to="/purchase/approval">
                <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Approve Vendors ({stats.pendingPurchase})
                </Button>
              </Link>
            )}
            <Link to="/vendors">
              <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                <Users className="h-4 w-4" />
                View All Vendors
              </Button>
            </Link>
            {(userRole === 'finance' || userRole === 'admin') && (
              <Link to="/compliance/gst">
                <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  GST Compliance Check
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
