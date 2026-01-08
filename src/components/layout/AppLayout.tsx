import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { user, userRole, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';

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
          
          {/* Collapse/Expand Button */}
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
        </>
      )}
      <main className={cn(
        "flex-1 overflow-auto h-screen transition-all duration-300",
        role !== 'vendor' ? 'p-6' : 'p-4 md:p-8',
        role !== 'vendor' && sidebarCollapsed ? 'pl-12' : ''
      )}>
        <Outlet />
      </main>
    </div>
  );
}