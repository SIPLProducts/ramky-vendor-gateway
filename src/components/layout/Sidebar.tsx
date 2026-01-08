import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  ClipboardCheck,
  Users,
  Settings,
  Shield,
  History,
  Mail,
  ChevronRight,
  FileCheck,
  HelpCircle,
  Play,
  Calendar,
  LogOut,
  Bell,
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
import ramkyLogo from '@/assets/ramky-logo.png';

interface SidebarProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin';
  userName: string;
  onSignOut: () => Promise<void>;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['finance', 'purchase', 'admin'],
  },
  {
    label: 'Vendor Invitations',
    href: '/admin/invitations',
    icon: Mail,
    roles: ['admin'],
  },
  {
    label: 'Vendor Registration',
    href: '/vendor/register',
    icon: FileText,
    roles: ['vendor', 'admin'],
  },
  {
    label: 'Document Verification',
    href: '/finance/verification',
    icon: FileCheck,
    roles: ['finance', 'admin'],
  },
  {
    label: 'Finance Review',
    href: '/finance/review',
    icon: CheckCircle,
    roles: ['finance', 'admin'],
  },
  {
    label: 'Purchase Approval',
    href: '/purchase/approval',
    icon: ClipboardCheck,
    roles: ['purchase', 'admin'],
  },
  {
    label: 'All Vendors',
    href: '/vendors',
    icon: Users,
    roles: ['finance', 'purchase', 'admin'],
  },
  {
    label: 'GST Compliance',
    href: '/compliance/gst',
    icon: Shield,
    roles: ['finance', 'admin'],
  },
  {
    label: 'Scheduled Checks',
    href: '/compliance/scheduled',
    icon: Calendar,
    roles: ['admin'],
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: History,
    roles: ['finance', 'purchase', 'admin'],
  },
  {
    label: 'Configuration',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
  {
    label: 'Demo Showcase',
    href: '/demo',
    icon: Play,
    roles: ['admin', 'finance', 'purchase'],
  },
  {
    label: 'Help & Support',
    href: '/support',
    icon: HelpCircle,
    roles: ['vendor', 'finance', 'purchase', 'admin'],
  },
];

const roleLabels: Record<string, string> = {
  vendor: 'Vendor',
  finance: 'Finance Team',
  purchase: 'Purchase Team',
  admin: 'Administrator',
};

export function Sidebar({ userRole, userName, onSignOut }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

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
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo Header */}
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto" />
          <div>
            <span className="text-sm font-semibold text-sidebar-foreground block">Vendor Portal</span>
            <span className="text-[10px] text-sidebar-foreground/50">Powering Progress</span>
          </div>
        </Link>
      </div>

      {/* Navigation Label */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Navigation
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-3">
        {/* User Info */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabels[userRole]}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <Bell className="h-4 w-4" />
              </Button>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground font-normal">{roleLabels[userRole]}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copyright */}
        <div className="px-2 py-1.5 text-center">
          <p className="text-[10px] text-sidebar-foreground/40">
            © 2025 Ramky Infrastructure • v2.0.0
          </p>
        </div>
      </div>
    </aside>
  );
}
