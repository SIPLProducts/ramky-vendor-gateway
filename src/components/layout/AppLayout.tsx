import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  userRole: 'vendor' | 'finance' | 'purchase' | 'admin';
  userName: string;
}

export function AppLayout({ userRole, userName }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header userRole={userRole} userName={userName} />
      <div className="flex">
        {userRole !== 'vendor' && <Sidebar userRole={userRole} />}
        <main className={`flex-1 ${userRole !== 'vendor' ? 'p-6' : 'p-4 md:p-8'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
