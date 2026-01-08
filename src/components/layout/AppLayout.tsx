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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AppLayout() {
  const { user, userRole } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = async () => {
    console.log('Logout clicked');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Supabase signOut error:', error);
        toast.error('Error signing out');
      } else {
        console.log('Signed out successfully');
        toast.success('Signed out successfully');
      }
      // Always navigate to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error signing out');
      window.location.href = '/auth';
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {role !== 'vendor' && (
        <div className={cn(
          "transition-all duration-300 ease-in-out shrink-0",
          sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-64"
        )}>
          <Sidebar userRole={role} userName={userName} onSignOut={handleLogout} />
        </div>
      )}
      
      {/* Sidebar Toggle Button */}
      {role !== 'vendor' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "fixed z-50 h-8 w-8 rounded-full shadow-md border bg-background hover:bg-muted transition-all duration-300",
            sidebarCollapsed ? "left-4 top-4" : "left-60 top-4"
          )}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      )}
      
      <main className={cn(
        "flex-1 overflow-auto h-screen",
        role !== 'vendor' ? 'p-6' : 'p-4 md:p-8',
        role !== 'vendor' && sidebarCollapsed ? 'pl-16' : ''
      )}>
        <Outlet />
      </main>
    </div>
  );
}