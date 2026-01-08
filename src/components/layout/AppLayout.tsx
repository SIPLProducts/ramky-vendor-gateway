import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const { user, userRole } = useAuth();
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';

  return (
    <div className="min-h-screen bg-background flex">
      {role !== 'vendor' && <Sidebar userRole={role} userName={userName} />}
      <main className={`flex-1 ${role !== 'vendor' ? 'p-6' : 'p-4 md:p-8'} overflow-auto h-screen`}>
        <Outlet />
      </main>
    </div>
  );
}
