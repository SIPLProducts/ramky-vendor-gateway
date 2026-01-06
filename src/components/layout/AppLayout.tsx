import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const { user, userRole } = useAuth();
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const role = userRole || 'vendor';

  return (
    <div className="min-h-screen bg-background">
      <Header userRole={role} userName={userName} />
      <div className="flex">
        {role !== 'vendor' && <Sidebar userRole={role} />}
        <main className={`flex-1 ${role !== 'vendor' ? 'p-6' : 'p-4 md:p-8'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
