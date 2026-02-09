import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders, handleOptions } from '../_shared/cors'

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    console.log('=== CREATE-CASE DEBUG ===')
    console.log('Method:', req.method)
    
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header presente:', authHeader ? 'SI' : 'NO')
    
    if (!authHeader) {
      console.error('ERRORE: Authorization header mancante!')
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 401, 
        headers: corsHeaders(req) 
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY')
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    console.log('Verifico utente...')
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !userData.user) {
      console.error('Errore auth:', userError?.message || 'No user')
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { 
        status: 401, 
        headers: corsHeaders(req) 
      })
    }
    
    console.log('Utente verificato:', userData.user?.id || 'No user ID')
    console.log('Email utente:', userData.user?.email || 'No email')  
    const body = await req.json()
    console.log('Body ricevuto:', JSON.stringify(body).substring(0, 100))

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userData.user.id,
      message: 'Auth OK - funzione raggiunta' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Errore:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
