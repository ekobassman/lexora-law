import { supabase } from '@/lib/supabaseClient';

export async function callEdge<T>(
  functionName: string,
  body: unknown,
  opts?: { requireAuth?: boolean; headers?: Record<string, string> }
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (opts?.requireAuth && (!session?.access_token)) {
    throw new Error('Not authenticated: No valid session found');
  }

  // ⚠️ IMPORTANT: do NOT set `apikey` manually.
  // Supabase client already sends the correct project key.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers || {}),
    ...(opts?.requireAuth && session?.access_token
      ? { 'Authorization': `Bearer ${session.access_token}` }
      : {}),
    ...(localStorage.getItem('lexora_debug') === '1'
      ? { 'x-lexora-debug': '1' }
      : {}),
  };

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
    headers,
  });

  if (error) throw error;
  return data;
}
