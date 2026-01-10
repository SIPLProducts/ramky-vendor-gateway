import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { MobileHeader } from './MobileHeader';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppLayout() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
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

  // Admin roles that should see the sidebar
  const adminRoles = ['sharvi_admin', 'admin'];
  const isAdminRole = adminRoles.includes(role);
  
  // Show mobile layout for mobile devices with admin roles
  const showMobileLayout = isMobile && isAdminRole;
  const showDesktopSidebar = !isMobile && isAdminRole;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row w-full">
      {/* Mobile Header - Only show on mobile for non-vendor roles */}
      {showMobileLayout && (
        <MobileHeader 
          userName={userName} 
          userRole={role} 
          onSignOut={handleLogout}
        />
      )}

      {/* Desktop Sidebar */}
      {showDesktopSidebar && (
        <Sidebar 
          userRole={role} 
          userName={userName} 
          onSignOut={handleLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      )}
      
      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-auto transition-all duration-300",
        // Mobile: Add padding for header and bottom nav
        showMobileLayout && "pt-14 pb-20",
        // Desktop with sidebar
        showDesktopSidebar && "h-screen p-6",
        // Vendor on any device
        role === 'vendor' && "p-4 md:p-8",
        // Mobile without sidebar (non-vendor)
        isMobile && role !== 'vendor' && "px-4"
      )}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      {showMobileLayout && (
        <MobileBottomNav userRole={role} />
      )}

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
