import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== CREATE-CASE DEBUG ===')

    const authHeader =
      req.headers.get('authorization') || req.headers.get('Authorization')

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('Auth header mancante o non Bearer')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.slice(7).trim()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('ENV Supabase mancanti')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client per verificare l’utente
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })

    const { data: userData, error: userError } =
      await authClient.auth.getUser(token)

    if (userError || !userData?.user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = userData.user.id
    const body = await req.json().catch(() => ({}))

    console.log('Body ricevuto:', body)

    // Client SERVICE ROLE per insert (bypassa RLS ma con user_id controllato)
    const db = createClient(supabaseUrl, serviceKey)

    let caseId = crypto.randomUUID()
    let insertError: any = null

    const { data: inserted, error } = await db
      .from('cases')
      .insert({
        id: caseId,
        user_id: userId,
        title: body?.title ?? 'Nuova pratica',
        authority: body?.authority ?? null,
        source: body?.source ?? 'app',
        metadata: body ?? {},
      })
      .select()
      .maybeSingle()

    if (error) {
      insertError = error
      console.error('❌ DB INSERT ERROR:', error)
    } else {
      caseId = inserted.id
      console.log('✅ Case creato:', caseId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        case_id: caseId,
        inserted: !insertError,
        db_error: insertError?.message ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('FATAL ERROR:', err)
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})