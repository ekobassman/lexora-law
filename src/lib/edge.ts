import { supabase } from '@/lib/supabaseClient';

export async function callEdge<T>(
  functionName: string,
  body: unknown,
  opts?: { requireAuth?: boolean; headers?: Record<string, string> }
): Promise<T> {
  // Always get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Check authentication if required
  if (opts?.requireAuth && (!session?.access_token)) {
    throw new Error('Not authenticated');
  }

  // Prepare headers
  const headers: Record<string, string> = {
    ...(opts?.headers || {}),
    // Add Authorization header if authenticated
    ...(opts?.requireAuth && session?.access_token ? {
      'Authorization': `Bearer ${session.access_token}`
    } : {}),
    // Add debug header if enabled
    ...(localStorage.getItem('lexora_debug') === '1' ? {
      'x-lexora-debug': '1'
    } : {})
  };

  // Make the call
  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
    headers
  });

  if (error) throw error;
  return data;
}
