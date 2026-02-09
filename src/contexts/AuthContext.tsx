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
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Se login successo, crea automaticamente il profilo se non esiste
    if (!error && data.user) {
      console.log('[AuthContext] Login successful, checking profile for user:', data.user.id);
      
      try {
        // Verifica se il profilo esiste già
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id, email, plan, created_at')
          .eq('id', data.user.id)
          .maybeSingle();

        console.log('[AuthContext] Profile check result:', { 
          userId: data.user.id, 
          existingProfile: existingProfile, 
          checkError: checkError 
        });

        // Se non esiste, crealo con dettagli completi
        if (!existingProfile && !checkError) {
          console.log('[AuthContext] Creating NEW profile for user:', data.user.id);
          
          const profileData = {
            id: data.user.id,
            email: data.user.email || email,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            plan: 'free',
            age_confirmed: true, // Default per nuovi utenti
            privacy_version: '1.0',
            terms_version: '1.0',
            first_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
            last_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
          };

          console.log('[AuthContext] Profile data to insert:', profileData);

          const { error: profileError, data: newProfile } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();

          if (profileError) {
            console.error('[AuthContext] ERROR creating profile:', profileError);
          } else if (newProfile) {
            console.log('[AuthContext] Profile CREATED successfully:', newProfile);
          } else {
            console.warn('[AuthContext] Profile insert returned no data');
          }
        } else if (existingProfile) {
          console.log('[AuthContext] Profile already exists, skipping creation');
        } else if (checkError) {
          console.error('[AuthContext] ERROR checking profile existence:', checkError);
        }
      } catch (err) {
        console.error('[AuthContext] CRITICAL ERROR in profile creation:', err);
      }
    } else {
      console.log('[AuthContext] Login failed:', error);
    }

    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
        },
      },
    });

    // Se signup successo, crea automaticamente il profilo
    if (!error && data.user) {
      try {
        console.log('[AuthContext] Creating profile for new user after signup:', data.user.id);
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email || email,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            plan: 'free',
            age_confirmed: true, // Default per nuovi utenti
            privacy_version: '1.0',
            terms_version: '1.0',
          })
          .select()
          .single();

        if (profileError) {
          console.error('[AuthContext] Error creating profile after signup:', profileError);
        } else {
          console.log('[AuthContext] Profile created successfully after signup for user:', data.user.id);
        }
      } catch (err) {
        console.error('[AuthContext] Error creating profile after signup:', err);
      }
    }
    
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
