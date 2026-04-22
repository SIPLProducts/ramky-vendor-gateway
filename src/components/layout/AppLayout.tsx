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
import { EnterpriseHeader } from './EnterpriseHeader';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppLayout() {
  const { user, userRole, hasCustomRole, isVendor } = useAuth();
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

  // Built-in roles that should see the portal sidebar
  const portalBuiltInRoles = ['sharvi_admin', 'admin', 'customer_admin', 'finance', 'purchase', 'approver'];
  const isBuiltInPortalRole = portalBuiltInRoles.includes(role);

  // Also treat as portal user if they have any granted custom/approver permission
  const { allowed, loading: permsLoading } = useScreenPermissions();
  const hasAnyPermission = allowed.size > 0;

  // Anyone with a custom role is a portal user — the custom role drives access, not the built-in enum.
  const isPortalUser = hasCustomRole || isBuiltInPortalRole || (!isVendor) || hasAnyPermission;

  // Show mobile layout for mobile devices with portal access
  const showMobileLayout = isMobile && isPortalUser && !permsLoading;
  const showDesktopSidebar = !isMobile && isPortalUser && !permsLoading;

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
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        showDesktopSidebar && "h-screen",
      )}>
        {/* Desktop tenant switcher header for portal users */}
        {showDesktopSidebar && <EnterpriseHeader />}

        <main className={cn(
          "flex-1 overflow-auto",
          // Mobile: Add padding for header and bottom nav
          showMobileLayout && "pt-14 pb-20",
          // Desktop with sidebar — content padding
          showDesktopSidebar && "p-6",
          // Vendor on any device (true vendor only — not custom-role users)
          isVendor && "p-4 md:p-8",
          // Mobile without sidebar (true vendor only)
          isMobile && isVendor && "px-4"
        )}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {showMobileLayout && (
        <MobileBottomNav userRole={role} />
      )}

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
