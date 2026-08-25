import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu, Bell, LogOut, Settings, User, X, Building2, KeyRound,
  LayoutDashboard, FileText, CheckCircle, ClipboardCheck, Users,
  History, Mail, HelpCircle, Wrench, RefreshCw, IndianRupee, ShoppingCart,
  UserCog, ShieldCheck, Layers, Crown, UserCheck, BarChart3,
} from 'lucide-react';
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import ramkyLogo from '@/assets/ramky-logo-transparent.png';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';

interface MobileHeaderProps {
  userName: string;
  userRole: string;
  onSignOut: () => Promise<void>;
}

const roleLabels: Record<string, string> = {
  vendor: 'Vendor',
  finance: 'Finance Team',
  purchase: 'Purchase Team',
  admin: 'Administrator',
  sharvi_admin: 'Sharvi Admin',
  customer_admin: 'Customer Admin',
  approver: 'Approver',
};

const drawerNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, screenKey: 'dashboard' },
  { label: 'Sharvi Admin Console', href: '/sharvi-admin', icon: Wrench, screenKey: 'sharvi_admin_console' },
  { label: 'Form Builder', href: '/admin/form-builder', icon: Layers, screenKey: 'form_builder' },
  { label: 'Vendor Invitations', href: '/admin/invitations', icon: Mail, screenKey: 'vendor_invitations' },
  { label: 'User Management', href: '/admin/users', icon: UserCog, screenKey: 'user_management' },
  { label: 'Buyer Approval', href: '/approvals/buyer', icon: UserCheck, screenKey: 'buyer_approval' },
  { label: 'SCM Approval', href: '/approvals/scm-manager', icon: ShoppingCart, screenKey: 'scm_manager_approval' },
  { label: 'SCM Head Approval', href: '/approvals/scm-head', icon: ShieldCheck, screenKey: 'scm_head_approval' },
  { label: 'Finance 1 Approval', href: '/approvals/finance-1', icon: IndianRupee, screenKey: 'finance1_approval' },
  { label: 'Finance 2 Approval', href: '/approvals/finance-2', icon: IndianRupee, screenKey: 'finance2_approval' },
  { label: 'CEO Office Approval', href: '/approvals/ceo', icon: Crown, screenKey: 'ceo_approval' },
  { label: 'SAP Sync', href: '/sap/sync', icon: RefreshCw, screenKey: 'sap_sync' },
  { label: 'SAP API Settings', href: '/sap/api-settings', icon: Settings, screenKey: 'sap_api_settings' },
  { label: 'KYC API Settings', href: '/admin/kyc-api-settings', icon: ShieldCheck, screenKey: 'kyc_api_settings' },
  { label: 'All Vendors', href: '/vendors', icon: Users, screenKey: 'vendors' },
  { label: 'GST Compliance', href: '/compliance/gst', icon: CheckCircle, screenKey: 'gst_compliance' },
  { label: 'Scheduled Checks', href: '/compliance/scheduled', icon: ClipboardCheck, screenKey: 'scheduled_checks' },
  { label: 'Audit Logs', href: '/audit-logs', icon: History, screenKey: 'audit_logs' },
  { label: 'Reports', href: '/reports', icon: BarChart3, screenKey: 'reports' },
  { label: 'Admin Configuration', href: '/settings', icon: Settings, screenKey: 'admin_configuration' },
  { label: 'Email Configuration', href: '/admin/email-config', icon: Mail, screenKey: 'email_configuration' },
  { label: 'Help & Support', href: '/support', icon: HelpCircle, screenKey: 'support' },
];

export function MobileHeader({ userName, userRole, onSignOut }: MobileHeaderProps) {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { isSubscribed, subscribe, permission } = usePushNotifications();
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { can, loading: permsLoading } = useScreenPermissions();
  const visibleNavItems = permsLoading ? [] : drawerNavItems.filter((i) => can(i.screenKey));
  const {
    myTenants, activeTenantId, setActiveTenantId,
    isSuperAdmin, isCrossTenantReviewer, isScmManager,
  } = useTenantContext();
  const hidePicker = isCrossTenantReviewer || isScmManager;
  const showSwitcher = !hidePicker && (myTenants.length > 1 || (isSuperAdmin && myTenants.length > 0));

  useEffect(() => {
    if (hidePicker && activeTenantId !== null) setActiveTenantId(null);
  }, [hidePicker, activeTenantId, setActiveTenantId]);

  const handleNotificationClick = async () => {
    if (!isSubscribed && permission !== 'denied') {
      setNotificationLoading(true);
      await subscribe();
      setNotificationLoading(false);
    }
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 px-3 flex items-center justify-between safe-area-top gap-2">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-center text-base">Vyapaar Portal</SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto py-2">
              {visibleNavItems.length === 0 && !permsLoading && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No screens available.</p>
              )}
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t px-4 py-3 text-[10px] text-muted-foreground text-center">
              © 2026 Sharvi Infotech Private Limited
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-base truncate text-foreground tracking-wide whitespace-nowrap">Vyapaar Portal</span>
        </Link>
      </div>


      {/* Right Actions */}
      <div className="flex items-center gap-2 pr-2">

        {showSwitcher && (
          <Select
            value={activeTenantId ?? '__all__'}
            onValueChange={(v) => setActiveTenantId(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="h-8 w-[120px] gap-1 text-xs px-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Tenant" />
            </SelectTrigger>
            <SelectContent align="end">
              {isSuperAdmin && <SelectItem value="__all__">All Tenants</SelectItem>}
              {myTenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9",
            isSubscribed && "text-primary"
          )}
          onClick={handleNotificationClick}
          disabled={notificationLoading || permission === 'denied'}
        >
          <Bell className="h-5 w-5" />
          {isSubscribed && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>

        {/* User Avatar → Sign Out */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="h-10 w-10 rounded-full p-0"
        >
          <Avatar className="h-8 w-8 ring-1 ring-primary/30 shadow-sm">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
        <img src={ramkyLogo} alt="Ramky" className="h-9 w-auto object-contain shrink-0" />
        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />


      </div>
    </header>
  );
}
