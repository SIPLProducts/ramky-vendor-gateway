import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVendorStats, useVendors, useBuyerCompanies, useStuckApprovalVendors } from '@/hooks/useVendors';
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  WifiOff,
  Building2,
  Server,
  IndianRupee,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectionStatus } from '@/components/pwa/ConnectionStatus';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const { user, userRole: authRole } = useAuth();
  const userRole = authRole || 'vendor';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const { data: stats, isLoading: statsLoading, isOffline: statsOffline, cacheAge: statsCacheAge } = useVendorStats();
  const { data: recentVendors, isLoading: vendorsLoading, isOffline: vendorsOffline, cacheAge: vendorsCacheAge } = useVendors();
  const { data: buyerCompanies } = useBuyerCompanies();
  const { data: stuckCount } = useStuckApprovalVendors();
  const isAdmin = userRole === 'admin' || userRole === 'sharvi_admin' || userRole === 'customer_admin';
  const queryClient = useQueryClient();

  // Subscribe to real-time updates
  const { isConnected } = useRealtimeUpdates({
    onVendorUpdate: () => {
      // Refresh data when vendor updates come in
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
    },
    showNotifications: true,
  });

  const isOffline = statsOffline || vendorsOffline;

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

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
    pendingSAPSync: 0,
    approved: 0,
    validationFailed: 0,
    draft: 0,
    submitted: 0,
    pendingVerification: 0,
    activeVendors: 0,
    byCompany: {} as Record<string, { total: number; pending: number; approved: number; rejected: number }>,
  };

  const displayVendors = recentVendors?.slice(0, 5) || [];

  // Get company breakdown with names
  type CompanyStats = { total: number; pending: number; approved: number; rejected: number };
  const byCompanyData = (displayStats.byCompany || {}) as Record<string, CompanyStats>;

  const companyBreakdown = Object.entries(byCompanyData).map(([tenantId, companyData]) => {
    const company = buyerCompanies?.find(c => c.id === tenantId);
    return {
      id: tenantId,
      name: company?.name || 'Unassigned',
      code: company?.code || '-',
      total: companyData.total,
      pending: companyData.pending,
      approved: companyData.approved,
      rejected: companyData.rejected,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Offline Alert */}
      {isOffline && (
        <Alert className="bg-warning/10 border-warning/30">
          <WifiOff className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning-foreground">
            You're offline. Showing cached data from {statsCacheAge || vendorsCacheAge || 'earlier'}.
          </AlertDescription>
        </Alert>
      )}

      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time vendor onboarding insights</p>
          </div>
        </div>
        <ConnectionStatus showLabel showLogout />
      </div>

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 p-6 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Welcome Back</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">{getGreeting()}, {userName}!</h2>
          <p className="text-sm opacity-90">Your vendor operations are running smoothly.</p>
        </div>
        {/* Decorative circles */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
          <div className="w-32 h-32 rounded-full border-4 border-white" />
          <div className="w-24 h-24 rounded-full border-4 border-white absolute top-4 left-4" />
        </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center gap-6 border-b">
        <button className="pb-3 text-sm font-semibold text-foreground border-b-2 border-primary">
          Key Metrics
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        <Card className="card-interactive border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendors
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold">{displayStats.total}</div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  All registered vendors
                </p>
              </>
            )}
          </CardContent>
        </Card>


        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Purchase / SCM
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">{displayStats.pendingPurchase}</div>
                <Link to="/purchase/approval">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-amber-600 dark:text-amber-400">
                    Approve <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Finance
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <IndianRupee className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">{displayStats.pendingFinance}</div>
                <Link to="/finance/review">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-teal-600 dark:text-teal-400">
                    Review <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending SAP Sync
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">{displayStats.pendingSAPSync}</div>
                <Link to="/sap/sync">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-purple-600 dark:text-purple-400">
                    Sync now <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Vendors
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400">{displayStats.activeVendors}</div>
                <p className="text-xs text-muted-foreground mt-2">SAP synced vendors</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Recent Submissions</CardTitle>
            <CardDescription>Latest vendor registration activities</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : displayVendors.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No vendors registered yet</p>
                <p className="text-sm mt-1">Vendors will appear here once they register</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {vendor.legal_name || 'Unnamed Vendor'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vendor.registered_city}, {vendor.registered_state}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(vendor.status)}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(vendor.updated_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Vendors by Buyer Company
            </CardTitle>
            <CardDescription>Distribution across buyer companies</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : companyBreakdown.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No vendor data by company yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {companyBreakdown.slice(0, 5).map((company) => (
                  <div key={company.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{company.name}</span>
                        <span className="text-muted-foreground text-sm ml-2">({company.code})</span>
                      </div>
                      <span className="text-sm font-semibold">{company.total} vendors</span>
                    </div>
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                      {company.approved > 0 && (
                        <div
                          className="bg-green-500 h-full"
                          style={{ width: `${(company.approved / company.total) * 100}%` }}
                        />
                      )}
                      {company.pending > 0 && (
                        <div
                          className="bg-amber-500 h-full"
                          style={{ width: `${(company.pending / company.total) * 100}%` }}
                        />
                      )}
                      {company.rejected > 0 && (
                        <div
                          className="bg-red-500 h-full"
                          style={{ width: `${(company.rejected / company.total) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Approved: {company.approved}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        Pending: {company.pending}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Rejected: {company.rejected}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(userRole === 'finance' || userRole === 'admin') && (
              <Link to="/finance/review">
                <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/30">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <IndianRupee className="h-4 w-4 text-white" />
                  </div>
                  <span>Review Pending Vendors ({displayStats.pendingFinance})</span>
                </Button>
              </Link>
            )}
            {(userRole === 'purchase' || userRole === 'admin') && (
              <Link to="/purchase/approval">
                <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl border-teal-200 hover:bg-teal-50 hover:border-teal-300 dark:border-teal-800 dark:hover:bg-teal-950/30 mt-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-white" />
                  </div>
                  <span>Approve Vendors ({displayStats.pendingPurchase})</span>
                </Button>
              </Link>
            )}
            <Link to="/vendors">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl mt-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <span>View All Vendors</span>
              </Button>
            </Link>
            <Link to="/audit-logs">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl mt-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span>View Audit Logs</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
