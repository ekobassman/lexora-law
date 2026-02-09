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
          plan,
          created_at,
          updated_at,
          payment_status,
          first_name,
          last_name,
          full_name,
          address,
          city,
          postal_code,
          country,
          sender_full_name,
          sender_address,
          sender_city,
          sender_postal_code,
          sender_country,
          terms_version
        `)
        .eq('id', user.id)
        .maybeSingle();

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

      // Handle null data (no profile found)
      if (!data) {
        console.log('[useSafeProfile] Nessun profilo trovato per utente:', user.id);
        return null;
      }

      console.log('[useSafeProfile] Profile loaded successfully:', {
        id: data.id,
        plan: data.plan,
        email: data.email
      });

      return {
        id: data.id,
        plan: data.plan || 'free',
        email: data.email || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
        payment_status: data.payment_status || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        full_name: data.full_name || null,
        address: data.address || null,
        city: data.city || null,
        postal_code: data.postal_code || null,
        country: data.country || null,
        sender_full_name: data.sender_full_name || null,
        sender_address: data.sender_address || null,
        sender_city: data.sender_city || null,
        sender_postal_code: data.sender_postal_code || null,
        sender_country: data.sender_country || null,
        terms_version: data.terms_version || null,
      };
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
        .select('*')
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
