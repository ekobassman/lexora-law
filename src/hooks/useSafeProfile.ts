import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  plan: string;
  age_confirmed: boolean;
  privacy_version: string;
  terms_version: string;
}

export function useSafeProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          created_at,
          last_seen_at,
          plan,
          age_confirmed,
          privacy_version,
          terms_version
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[useSafeProfile] Profile fetch error:', {
          code: (error as any)?.code,
          message: error.message,
          details: (error as any)?.details,
          userId: user.id
        });
        
        // Gestisci 406 come "nessun profilo trovato"
        if ((error as any)?.code === 'PGRST116') {
          console.log('[useSafeProfile] Nessun profilo trovato per utente:', user.id);
          return null; // Non è un errore, solo profilo non esiste
        }
        
        throw error;
      }

      console.log('[useSafeProfile] Profile loaded successfully:', {
        id: data.id,
        plan: data.plan,
        email: data.email
      });

      return data;
    },
    enabled: !!user?.id,
    retry: (failureCount, error) => {
      // Non ritentare se è 406 o profilo non trovato
      if ((error as any)?.code === 'PGRST116') return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
}

export function useDashboardMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_chat_messages')
        .select('messages_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[useDashboardMessages] Messages fetch error:', {
          code: (error as any)?.code,
          message: error.message,
          userId: user.id
        });
        
        if ((error as any)?.code === 'PGRST116') {
          console.log('[useDashboardMessages] Nessun messaggio trovato per utente:', user.id);
          return [];
        }
        
        throw error;
      }

      console.log('[useDashboardMessages] Messages loaded:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    retry: (failureCount, error) => {
      if ((error as any)?.code === 'PGRST116') return false;
      return failureCount < 2;
    }
  });
}
