import { Link, useLocation } from 'react-router-dom';
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
  Building2,
} from 'lucide-react';

interface SidebarProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin';
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
    label: 'My Registration',
    href: '/vendor/register',
    icon: FileText,
    roles: ['vendor'],
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
];

export function Sidebar({ userRole }: SidebarProps) {
  const location = useLocation();

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-sidebar border-r flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-sidebar-primary" />
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground">Ramky Infrastructure</p>
            <p className="text-xs text-sidebar-foreground/70">Vendor Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60">
          <p>Version 1.0.0</p>
          <p>© 2024 Ramky Infrastructure</p>
        </div>
      </div>
    </aside>
  );
}
