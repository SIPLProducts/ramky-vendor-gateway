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
  User,
} from 'lucide-react';
import ramkyLogo from '@/assets/ramky-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin';
  userName: string;
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

const roleLabels = {
  vendor: 'Vendor',
  finance: 'Finance Team',
  purchase: 'Purchase Team',
  admin: 'Administrator',
};

export function Sidebar({ userRole, userName }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/auth', { replace: true });
    }
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo Section */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={ramkyLogo} 
            alt="Ramky Infrastructure" 
            className="h-10 w-auto object-contain"
          />
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-accent/50">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{userName}</p>
            <Badge variant="outline" className="text-[10px] px-2 py-0 mt-1 border-sidebar-border text-sidebar-foreground/70 bg-transparent">
              {roleLabels[userRole]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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

      {/* Footer with Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
        <div className="px-3 py-2 rounded-lg bg-sidebar-accent/30">
          <p className="text-[10px] text-sidebar-foreground/50 text-center">
            © 2025 Ramky Infrastructure • v2.0.0
          </p>
        </div>
      </div>
    </aside>
  );
}
