import { supabase } from '@/integrations/supabase/client';

/** True when the auth server says the saved login no longer exists (dead session_id). */
export function isDeadSessionError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string; status?: number };
  const msg = String(e.message || '').toLowerCase();
  return (
    e.code === 'session_not_found' ||
    msg.includes('session_not_found') ||
    msg.includes('session from session_id claim in jwt does not exist') ||
    e.code === 'refresh_token_not_found'
  );
}

/** Remove a dead saved login from this browser only, like a fresh/incognito window. */
export async function purgeDeadLocalSession(): Promise<void> {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith('sb-') && k.includes('auth-token')) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch { /* storage unavailable */ }
  }
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
}
