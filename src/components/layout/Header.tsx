import { Bell, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin';
  userName: string;
}

export function Header({ userRole, userName }: HeaderProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if signOut fails
      navigate('/auth', { replace: true });
    }
  };

  const roleLabels = {
    vendor: 'Vendor',
    finance: 'Finance Team',
    purchase: 'Purchase Team',
    admin: 'Administrator',
  };

  const roleColors = {
    vendor: 'bg-blue-100 text-blue-700 border-blue-200',
    finance: 'bg-amber-100 text-amber-700 border-amber-200',
    purchase: 'bg-teal-100 text-teal-700 border-teal-200',
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-lg px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Ramky Vendor Portal</h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold shadow-lg">
            3
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 pl-2 pr-4 rounded-xl h-10">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold leading-none mb-1">{userName}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border ${roleColors[userRole]}`}>
                  {roleLabels[userRole]}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-lg cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive cursor-pointer rounded-lg" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
