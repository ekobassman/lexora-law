import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hardReset: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        if (!isMounted) return;

        // Only update state if there's an actual change to prevent unnecessary re-renders
        const newUserId = newSession?.user?.id ?? null;
        
        // Skip TOKEN_REFRESHED events if user hasn't changed - this prevents page jumps on app resume
        if (event === 'TOKEN_REFRESHED' && newUserId === lastUserIdRef.current) {
          return;
        }

        // For SIGNED_IN events when resuming app, only update if user actually changed
        if (event === 'SIGNED_IN' && newUserId === lastUserIdRef.current && session !== null) {
          return;
        }

        lastUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isMounted) return;
      lastUserIdRef.current = existingSession?.user?.id ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // ignore
    }

    // Always also clear local session (guarantees storage cleanup even if network fails)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    }

    // Ensure UI updates immediately even if an auth event is missed
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const hardReset = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Ignore signOut errors
    }

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    }

    try {
      const wipe = (store: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          const lower = k.toLowerCase();
          if (lower.includes('supabase') || lower.startsWith('sb-')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => store.removeItem(k));
      };
      wipe(localStorage);
      wipe(sessionStorage);
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }

    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, hardReset }}>
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
