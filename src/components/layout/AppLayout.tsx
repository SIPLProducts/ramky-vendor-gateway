import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppLayout() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  
  // Persist sidebar state in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  });
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error signing out');
      window.location.href = '/auth';
    }
  };

  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      {role !== 'vendor' && (
        <Sidebar 
          userRole={role} 
          userName={userName} 
          onSignOut={handleLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      )}
      
      <main className={cn(
        "flex-1 overflow-auto h-screen transition-all duration-300",
        role !== 'vendor' ? 'p-6' : 'p-4 md:p-8'
      )}>
        <Outlet />
      </main>

      <InstallPrompt />
    </div>
  );
}