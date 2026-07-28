import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useIdleLogout } from './useIdleLogout';
import { toast } from '@/hooks/use-toast';

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
  rolesLoading: boolean;
  rolesError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVE_MESSAGE = 'Your account is inactive. Please contact the Administrator to proceed.';

async function logAttempt(email: string, user_id: string | null, attempt_status: 'success' | 'inactive_user' | 'invalid_credentials') {
  try {
    await supabase.functions.invoke('log-login-attempt', {
      body: { email, user_id, attempt_status },
    });
  } catch (err) {
    console.warn('log-login-attempt failed:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRoleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(false);

  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT' || !session?.user) {
          loadedUserIdRef.current = null;
          setUserRole(null);
          setCustomRoles([]);
          setRolesLoading(false);
          setRolesError(false);
          setLoading(false);
          return;
        }

        // Only (re)load roles on real sign-in / account change. TOKEN_REFRESHED
        // and USER_UPDATED fire on every tab-focus and would otherwise unmount
        // the whole app tree via ProtectedRoute, killing open dialogs.
        const isSignInEvent = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
        const userChanged = loadedUserIdRef.current !== session.user.id;
        if (isSignInEvent && userChanged) {
          loadedUserIdRef.current = session.user.id;
          setRolesLoading(true);
          setRolesError(false);
          setUserRole(null);
          setCustomRoles([]);
          setTimeout(() => { loadRoles(session.user.id); }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (loadedUserIdRef.current !== session.user.id) {
          loadedUserIdRef.current = session.user.id;
          setRolesLoading(true);
          setRolesError(false);
          loadRoles(session.user.id);
        }
      } else {
        setRolesLoading(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadRoles = async (userId: string) => {
    let hadError = false;
    try {
      const [roleRes, customRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('user_custom_roles')
          .select('custom_role_id, custom_roles!inner(id, name, is_active)')
          .eq('user_id', userId),
      ]);

      if (roleRes.error) {
        console.error('Error fetching user role:', roleRes.error);
        hadError = true;
        setUserRole(null);
      } else {
        const roles = (roleRes.data ?? []).map((r: any) => r.role as AppRole);
        // Priority: any non-vendor role wins over the default 'vendor' row
        // inserted by handle_new_user, so admin-assigned users aren't misrouted.
        const priority: AppRole[] = ['sharvi_admin', 'admin', 'customer_admin', 'finance', 'purchase', 'approver', 'vendor'];
        const picked = priority.find((p) => roles.includes(p)) ?? null;
        setUserRole(picked);
      }


      if (customRes.error) {
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
      hadError = true;
      setUserRole(null);
      setCustomRoles([]);
    } finally {
      setRolesError(hadError);
      setRolesLoading(false);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // 1. Pre-check status
    try {
      const { data: statusRows, error: statusErr } = await supabase
        .rpc('check_user_active', { _email: email });
      if (!statusErr && Array.isArray(statusRows) && statusRows.length > 0) {
        const row = statusRows[0] as { user_id: string; status: string };
        if (row.status === 'inactive') {
          await logAttempt(email, row.user_id, 'inactive_user');
          return { error: new Error(INACTIVE_MESSAGE) };
        }
      }
    } catch (err) {
      console.warn('check_user_active failed, continuing:', err);
    }

    // 2. Attempt sign-in
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      await logAttempt(email, null, 'invalid_credentials');
      return { error: error as Error };
    }
    await logAttempt(email, data.user?.id ?? null, 'success');
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
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

  // Auto-logout after 30 min inactivity (only when signed in)
  const handleIdle = useCallback(async () => {
    if (!session) return;
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been signed out due to 30 minutes of inactivity.',
    });
  }, [session]);
  useIdleLogout({ enabled: !!session, minutes: 30, onIdle: handleIdle });

  return (
    <AuthContext.Provider
      value={{
        user, session, userRole, customRoles, hasCustomRole, isVendor,
        loading, rolesLoading, rolesError, signIn, signUp, signOut,
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
