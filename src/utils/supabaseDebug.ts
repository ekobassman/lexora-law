// Utility per debug e gestione errori Supabase

export interface SupabaseError {
  code?: string;
  message: string;
  details?: any;
  hint?: string;
}

export interface DebugInfo {
  technical: SupabaseError;
  userMessage: string;
  isNotFound: boolean;
  isAuthError: boolean;
  isPermissionError: boolean;
}

export function debugSupabaseError(error: any, context: string): DebugInfo {
  console.error(`[Supabase Error - ${context}]`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    timestamp: new Date().toISOString()
  });

  // Mappa errori comuni
  const errorMap: Record<string, string> = {
    'PGRST116': 'Profilo non trovato (406)',
    'PGRST301': 'Relazione non trovata',
    'PGRST302': 'Violazione foreign key',
    '42501': 'Connessione database fallita',
    '23505': 'Violazione unique constraint',
    '23514': 'Violazione check constraint',
    '401': 'Non autorizzato',
    '403': 'Accesso negato',
    '500': 'Errore interno server'
  };

  const userMessage = errorMap[error?.code] || error?.message || 'Errore sconosciuto';
  
  return {
    technical: error,
    userMessage,
    isNotFound: error?.code === 'PGRST116',
    isAuthError: ['401', '403'].includes(error?.code) || error?.code?.startsWith('PGRST'),
    isPermissionError: error?.code?.startsWith('PGRST') && !['PGRST116'].includes(error?.code)
  };
}

export function logApiCall(method: string, url: string, data?: any) {
  console.log(`[API Call] ${method} ${url}`, {
    method,
    url,
    data: data ? JSON.stringify(data) : 'no body',
    timestamp: new Date().toISOString()
  });
}

export function logApiResponse(method: string, url: string, response: any, error?: any) {
  if (error) {
    console.error(`[API Response] ${method} ${url} - ERROR`, {
      method,
      url,
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`[API Response] ${method} ${url} - SUCCESS`, {
      method,
      url,
      status: response?.status || 'unknown',
      data: response?.data ? 'data received' : 'no data',
      timestamp: new Date().toISOString()
    });
  }
}

// Query SQL per debug
export const DEBUG_QUERIES = {
  checkProfile: (userId: string) => `
    -- Verifica profilo utente
    SELECT 
      id,
      email,
      created_at,
      last_seen_at,
      plan,
      age_confirmed,
      privacy_version,
      terms_version
    FROM profiles 
    WHERE id = '${userId}';
  `,
  
  checkDashboardMessages: (userId: string) => `
    -- Verifica messaggi dashboard
    SELECT 
      COUNT(*) as messages_count,
      user_id,
      MAX(created_at) as last_message_at
    FROM dashboard_chat_messages 
    WHERE user_id = '${userId}'
    GROUP BY user_id;
  `,
  
  checkTableStructure: (tableName: string) => `
    -- Verifica struttura tabella
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position;
  `,
  
  checkRLSPolicies: (tableName: string) => `
    -- Verifica policy RLS
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual
    FROM pg_policies 
    WHERE tablename = '${tableName}';
  `
};
