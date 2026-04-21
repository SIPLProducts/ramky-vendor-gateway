import { useState, useEffect, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'vendor' | 'finance' | 'purchase' | 'admin' | 'sharvi_admin' | 'customer_admin' | 'approver';

interface CustomRoleRef {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  customRoles: CustomRoleRef[];
  hasCustomRole: boolean;
  isVendor: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRoleRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            loadRoles(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setCustomRoles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadRoles = async (userId: string) => {
    try {
      const [roleRes, customRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase
          .from('user_custom_roles')
          .select('custom_role_id, custom_roles!inner(id, name, is_active)')
          .eq('user_id', userId),
      ]);

      if (roleRes.error) {
        console.error('Error fetching user role:', roleRes.error);
        setUserRole('vendor');
      } else {
        setUserRole((roleRes.data?.role as AppRole) || 'vendor');
      }

      if (customRes.error) {
        console.error('Error fetching custom roles:', customRes.error);
        setCustomRoles([]);
      } else {
        const active: CustomRoleRef[] = (customRes.data ?? [])
          .map((r: any) => r.custom_roles)
          .filter((cr: any) => cr && cr.is_active)
          .map((cr: any) => ({ id: cr.id, name: cr.name }));
        setCustomRoles(active);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
      setUserRole('vendor');
      setCustomRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
    setUserRole(null);
    setCustomRoles([]);
  };

  const hasCustomRole = customRoles.length > 0;
  const isVendor = userRole === 'vendor' && !hasCustomRole;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        customRoles,
        hasCustomRole,
        isVendor,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
