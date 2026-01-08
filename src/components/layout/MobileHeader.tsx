import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, LogOut, Settings, User, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import ramkyLogo from '@/assets/ramky-logo.png';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

export function MobileHeader({ userName, userRole, onSignOut }: MobileHeaderProps) {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { isSubscribed, subscribe, permission } = usePushNotifications();
  const [notificationLoading, setNotificationLoading] = useState(false);

  const handleNotificationClick = async () => {
    if (!isSubscribed && permission !== 'denied') {
      setNotificationLoading(true);
      await subscribe();
      setNotificationLoading(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 px-4 flex items-center justify-between safe-area-top">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2">
        <img src={ramkyLogo} alt="Ramky" className="h-8 w-8 object-contain" />
        <span className="font-semibold text-sm">Ramky VMS</span>
      </Link>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
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

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
            <DropdownMenuItem asChild>
              <Link to="/support" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                Help & Support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
