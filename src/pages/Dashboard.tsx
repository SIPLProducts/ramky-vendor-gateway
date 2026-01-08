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
  Sparkles,
  LayoutDashboard,
  FileCheck,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, userRole: authRole } = useAuth();
  const userRole = authRole || 'vendor';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const { data: stats, isLoading: statsLoading } = useVendorStats();
  const { data: recentVendors, isLoading: vendorsLoading } = useVendors();

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
    approved: 0,
    validationFailed: 0,
    draft: 0,
    submitted: 0,
    pendingVerification: 0,
    activeVendors: 0,
  };

  const displayVendors = recentVendors?.slice(0, 5) || [];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      toast.success('Signed out successfully');
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/auth';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Logout */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time vendor onboarding insights</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
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
        <button className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          Recent Activity
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
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

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Verification
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{displayStats.pendingVerification}</div>
                <Link to="/finance/verification">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-blue-600 dark:text-blue-400">
                    Verify now <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Finance
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">{displayStats.pendingFinance}</div>
                <Link to="/finance/review">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-amber-600 dark:text-amber-400">
                    Review <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Purchase
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">{displayStats.pendingPurchase}</div>
                <Link to="/purchase/approval">
                  <Button variant="link" className="p-0 h-auto text-xs mt-2 text-teal-600 dark:text-teal-400">
                    Approve <ArrowRight className="h-3 w-3 ml-1" />
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

        <Card className="card-interactive border-0 shadow-md bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Validation Failed
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <XCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <>
                <div className="text-4xl font-bold text-red-600 dark:text-red-400">{displayStats.validationFailed}</div>
                <p className="text-xs text-muted-foreground mt-2">Require attention</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <CardTitle className="text-xl">Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(userRole === 'finance' || userRole === 'admin') && (
              <Link to="/finance/review">
                <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/30">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <span>Review Pending Vendors ({displayStats.pendingFinance})</span>
                </Button>
              </Link>
            )}
            {(userRole === 'purchase' || userRole === 'admin') && (
              <Link to="/purchase/approval">
                <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl border-teal-200 hover:bg-teal-50 hover:border-teal-300 dark:border-teal-800 dark:hover:bg-teal-950/30 mt-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
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
