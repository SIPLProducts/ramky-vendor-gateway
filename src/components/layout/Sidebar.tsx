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
  Mail,
  ChevronRight,
  FileCheck,
  HelpCircle,
  Play,
  Calendar,
} from 'lucide-react';
import ramkyLogo from '@/assets/ramky-logo.png';

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

export function Sidebar({ userRole }: SidebarProps) {
  const location = useLocation();

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-sidebar border-r flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={ramkyLogo} 
            alt="Ramky Infrastructure" 
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                {item.label}
              </div>
              {isActive && <ChevronRight className="h-4 w-4" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-5 border-t border-sidebar-border">
        <div className="px-4 py-3 rounded-xl bg-sidebar-accent/50">
          <div className="text-xs text-sidebar-foreground/60">
            <p className="font-medium text-sidebar-foreground mb-1">Version 2.0.0</p>
            <p>© 2024 Ramky Infrastructure</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
