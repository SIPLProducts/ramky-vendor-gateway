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
  UserCog,
} from 'lucide-react';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';

interface MobileBottomNavProps {
  userRole: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  screenKey: string;
}

const mobileNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, screenKey: 'dashboard' },
  { label: 'Vendors', href: '/vendors', icon: Users, screenKey: 'vendors' },
  { label: 'Review', href: '/finance/review', icon: CheckCircle, screenKey: 'finance_review' },
  { label: 'Approval', href: '/purchase/approval', icon: ClipboardCheck, screenKey: 'purchase_approval' },
  { label: 'GST', href: '/compliance/gst', icon: Shield, screenKey: 'gst_compliance' },
  { label: 'Register', href: '/vendor/register', icon: FileText, screenKey: 'vendor_registration' },
  { label: 'Users', href: '/admin/users', icon: UserCog, screenKey: 'user_management' },
  { label: 'Settings', href: '/settings', icon: Settings, screenKey: 'admin_configuration' },
  { label: 'Help', href: '/support', icon: HelpCircle, screenKey: 'support' },
];

export function MobileBottomNav({ userRole }: MobileBottomNavProps) {
  const location = useLocation();
  const { can, loading } = useScreenPermissions();

  const filteredItems = (loading ? [] : mobileNavItems.filter((i) => can(i.screenKey))).slice(0, 5);

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
                isActive ? 'text-primary' : 'text-muted-foreground'
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
