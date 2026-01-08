import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CheckCircle,
  Settings,
  HelpCircle,
  FileText,
  ClipboardCheck,
  Shield,
} from 'lucide-react';

interface MobileBottomNavProps {
  userRole: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const mobileNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['finance', 'purchase', 'admin', 'sharvi_admin', 'customer_admin'],
  },
  {
    label: 'Vendors',
    href: '/vendors',
    icon: Users,
    roles: ['finance', 'purchase', 'admin', 'sharvi_admin', 'customer_admin'],
  },
  {
    label: 'Review',
    href: '/finance/review',
    icon: CheckCircle,
    roles: ['finance', 'admin', 'sharvi_admin'],
  },
  {
    label: 'Approval',
    href: '/purchase/approval',
    icon: ClipboardCheck,
    roles: ['purchase', 'admin', 'sharvi_admin', 'approver'],
  },
  {
    label: 'GST',
    href: '/compliance/gst',
    icon: Shield,
    roles: ['finance', 'admin', 'sharvi_admin'],
  },
  {
    label: 'Register',
    href: '/vendor/register',
    icon: FileText,
    roles: ['vendor', 'admin', 'sharvi_admin'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'sharvi_admin', 'customer_admin'],
  },
  {
    label: 'Help',
    href: '/support',
    icon: HelpCircle,
    roles: ['vendor', 'finance', 'purchase', 'admin', 'sharvi_admin', 'customer_admin', 'approver'],
  },
];

export function MobileBottomNav({ userRole }: MobileBottomNavProps) {
  const location = useLocation();

  // Filter items based on role and limit to 5 items max
  const filteredItems = mobileNavItems
    .filter((item) => item.roles.includes(userRole))
    .slice(0, 5);

  if (filteredItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-colors',
                'tap-highlight-transparent active:scale-95 transition-transform',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                  isActive && 'bg-primary/10'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium mt-0.5 truncate max-w-full',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
