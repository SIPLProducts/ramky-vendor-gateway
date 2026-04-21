import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  ClipboardCheck,
  Users,
  Settings,
  History,
  Mail,
  HelpCircle,
  LogOut,
  Bell,
  Wrench,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  IndianRupee,
  ShoppingCart,
  UserCog,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ramkyLogo from '@/assets/ramky-logo.png';
import { Shield } from 'lucide-react';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';

interface SidebarProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin' | 'sharvi_admin' | 'customer_admin' | 'approver';
  userName: string;
  onSignOut: () => Promise<void>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  screenKey: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, screenKey: 'dashboard' },
  { label: 'Sharvi Admin Console', href: '/sharvi-admin', icon: Wrench, screenKey: 'sharvi_admin_console' },
  { label: 'Vendor Invitations', href: '/admin/invitations', icon: Mail, screenKey: 'vendor_invitations' },
  { label: 'User Management', href: '/admin/users', icon: UserCog, screenKey: 'user_management' },
  { label: 'My Approvals', href: '/admin/my-approvals', icon: Inbox, screenKey: 'my_approvals' },
  { label: 'Vendor Registration', href: '/vendor/register', icon: FileText, screenKey: 'vendor_registration' },
  { label: 'SCM Approval', href: '/purchase/approval', icon: ShoppingCart, screenKey: 'purchase_approval' },
  { label: 'Finance Review', href: '/finance/review', icon: IndianRupee, screenKey: 'finance_review' },
  { label: 'SAP Sync', href: '/sap/sync', icon: RefreshCw, screenKey: 'sap_sync' },
  { label: 'All Vendors', href: '/vendors', icon: Users, screenKey: 'vendors' },
  { label: 'GST Compliance', href: '/compliance/gst', icon: CheckCircle, screenKey: 'gst_compliance' },
  { label: 'Scheduled Checks', href: '/compliance/scheduled', icon: ClipboardCheck, screenKey: 'scheduled_checks' },
  { label: 'Audit Logs', href: '/audit-logs', icon: History, screenKey: 'audit_logs' },
  { label: 'Admin Configuration', href: '/settings', icon: Settings, screenKey: 'admin_configuration' },
  { label: 'Help & Support', href: '/support', icon: HelpCircle, screenKey: 'support' },
];

const roleLabels: Record<string, string> = {
  vendor: 'Vendor',
  finance: 'Finance Team',
  purchase: 'Purchase Team',
  admin: 'Administrator',
  sharvi_admin: 'Sharvi Admin',
  customer_admin: 'Customer Admin',
  approver: 'Approver',
};

export function Sidebar({ userRole, userName, onSignOut, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can, loading: permsLoading } = useScreenPermissions();
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredItems = permsLoading ? [] : navItems.filter((item) => can(item.screenKey));

  const handleLogout = async () => {
    try {
      await onSignOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/auth', { replace: true });
    }
  };

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo Header */}
      <div className={cn(
        "border-b border-sidebar-border transition-all duration-300",
        collapsed ? "p-3" : "p-4"
      )}>
        <Link to="/dashboard" className="flex items-center gap-3">
          <img
            src={ramkyLogo}
            alt="Ramky"
            className={cn(
              "transition-all duration-300",
              collapsed ? "h-8 w-8 object-contain" : "h-10 w-auto"
            )}
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="text-sm font-semibold text-sidebar-foreground block whitespace-nowrap">Vendor Portal</span>
              <span className="text-[10px] text-sidebar-foreground/50 whitespace-nowrap">Powering Progress</span>
            </div>
          )}
        </Link>
      </div>

      {/* Collapse Toggle */}
      <div className={cn(
        "px-2 pt-3 pb-1 flex",
        collapsed ? "justify-center" : "justify-between items-center"
      )}>
        {!collapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-2">
            Navigation
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(
                "h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                collapsed && "mx-auto"
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-slate-900 text-white border-0 px-3 py-1.5 text-xs font-medium rounded-full shadow-lg"
            sideOffset={8}
          >
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-1 overflow-y-auto py-2",
        collapsed ? "px-2" : "px-3"
      )}>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          const linkContent = (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <div className={cn(
                "flex items-center gap-3",
                collapsed && "justify-center"
              )}>
                <Icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                  !collapsed && isActive && "scale-110"
                )} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!collapsed && isActive && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              {/* Active indicator for collapsed state */}
              {collapsed && isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-sidebar-primary-foreground rounded-r-full" />
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-slate-900 text-white border-0 px-3 py-1.5 text-xs font-medium rounded-full shadow-lg"
                  sideOffset={8}
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* User Profile Footer */}
      <div className={cn(
        "border-t border-sidebar-border",
        collapsed ? "p-2" : "p-3"
      )}>
        {/* User Info */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center rounded-lg hover:bg-sidebar-accent transition-colors",
                    collapsed ? "justify-center p-2" : "gap-3 p-2"
                  )}
                >
                  <Avatar className={cn(
                    "transition-all duration-300",
                    collapsed ? "h-8 w-8" : "h-9 w-9"
                  )}>
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                        <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabels[userRole]}</p>
                      </div>
                      <Bell className="h-4 w-4 text-sidebar-foreground/60" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent
                side="right"
                className="bg-slate-900 text-white border-0 px-3 py-1.5 text-xs font-medium rounded-full shadow-lg"
                sideOffset={8}
              >
                {userName}
              </TooltipContent>
            )}
          </Tooltip>
          <DropdownMenuContent
            align={collapsed ? "center" : "end"}
            side="top"
            className="w-56 bg-popover border shadow-lg"
            sideOffset={8}
          >
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground font-normal">{roleLabels[userRole]}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copyright - only show when expanded */}
        {!collapsed && (
          <div className="px-2 py-1.5 text-center mt-2">
            <p className="text-[10px] text-sidebar-foreground/40">
              © 2026 Sharvi Infotech Private Limited • v2.0.0
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
