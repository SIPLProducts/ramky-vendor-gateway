import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';
import { KeyRound } from 'lucide-react';
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
  Layers,
  Crown,
  UserCheck,
  BarChart3,
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

import { Shield } from 'lucide-react';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';
import { useAuth } from '@/hooks/useAuth';

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
  const { customRoles } = useAuth();
  const displayRole = customRoles[0]?.name ?? roleLabels[userRole];
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

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
      {/* Header */}
      {!collapsed && (
        <div className="border-b border-sidebar-border p-4">
          <Link to="/dashboard" className="flex items-center justify-center">
            <span className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap text-center">Vypaar Portal</span>
          </Link>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className={cn(
        "px-2 pt-3 pb-1 flex",
        collapsed ? "justify-center" : "justify-between items-center"
      )}>
        {!collapsed && (
          <span className="text-xs font-semibold text-sidebar-foreground/50 px-2">
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
        "sidebar-scroll flex-1 space-y-0.5 overflow-y-auto py-2",
        collapsed ? "px-2" : "px-2"
      )}>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          const linkContent = (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 group relative border',
                collapsed ? 'justify-center p-2.5 mx-0' : 'justify-between px-3 py-2 mx-1',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-[color:var(--sidebar-selected-border,transparent)]'
                  : 'border-transparent text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-accent-foreground'

              )}


            >
              <div className={cn(
                "flex items-center gap-3",
                collapsed && "justify-center"
              )}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {/* Active indicator for collapsed state */}
              {collapsed && isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-[color:var(--sidebar-selected-border,hsl(var(--sidebar-primary)))]" />
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
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setChangePasswordOpen(true)}
              className="cursor-pointer"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

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
