import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AppLayout() {
  const { user, userRole, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
    <div className="min-h-screen bg-background flex">
      {role !== 'vendor' && (
        <>
          <div className={cn(
            "transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-64"
          )}>
            <Sidebar userRole={role} userName={userName} onSignOut={signOut} />
          </div>
          
          {/* Collapse/Expand Button + User Menu when collapsed */}
          <div className={cn(
            "fixed z-50 flex items-center gap-2 transition-all duration-300",
            sidebarCollapsed ? "left-4 top-4" : "left-60 top-4"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 rounded-full shadow-md border bg-background hover:bg-muted"
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
            
            {/* Show user menu when sidebar is collapsed */}
            {sidebarCollapsed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </>
      )}
      <main className={cn(
        "flex-1 overflow-auto h-screen transition-all duration-300",
        role !== 'vendor' ? 'p-6' : 'p-4 md:p-8',
        role !== 'vendor' && sidebarCollapsed ? 'pl-16' : ''
      )}>
        <Outlet />
      </main>
    </div>
  );
}