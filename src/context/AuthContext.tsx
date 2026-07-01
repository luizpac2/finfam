import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { authService, userService } from '../services';
import type { User } from '../domain/entities/User';

export interface AuthContextValue {
  session: Session | null;
  /** E-mail da conta Google autenticada (mesmo sem autorização). */
  email: string | null;
  /** Perfil em `public.users`, ou null se o e-mail não está autorizado. */
  profile: User | null;
  /** Há uma sessão Google válida. */
  isAuthenticated: boolean;
  /** O e-mail está autorizado (perfil ativo na whitelist). */
  isAuthorized: boolean;
  /** O acesso deste e-mail foi revogado por um admin. */
  isRevoked: boolean;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve o perfil (whitelist) para a sessão atual via RPC sync_current_user.
  const resolveProfile = useCallback(async (current: Session | null) => {
    if (!current?.user) {
      setProfile(null);
      return;
    }
    const resolved = await userService.syncCurrentUser();
    setProfile(resolved);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const current = await authService.getSession();
      if (!active) return;
      setSession(current);
      await resolveProfile(current);
      if (active) setLoading(false);
    })();

    const unsubscribe = authService.onAuthStateChange(async (next) => {
      if (!active) return;
      setSession(next);
      await resolveProfile(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [resolveProfile]);

  const refreshProfile = useCallback(
    () => resolveProfile(session),
    [resolveProfile, session]
  );

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = Boolean(session);
    const isAuthorized = profile?.status === 'active';
    return {
      session,
      email: session?.user?.email ?? null,
      profile,
      isAuthenticated,
      isAuthorized,
      isRevoked: profile?.status === 'revoked',
      isAdmin: isAuthorized && profile?.role === 'admin',
      loading,
      signInWithGoogle: () => authService.signInWithGoogle(),
      signOut: () => authService.signOut(),
      refreshProfile,
    };
  }, [session, profile, loading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
