import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function uuidv4(): string {
  // crypto.randomUUID() exists in Deno
  return crypto.randomUUID()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== CREATE-CASE DEBUG ===')
    console.log('Method:', req.method)

    const authHeader =
      req.headers.get('authorization') || req.headers.get('Authorization')

    console.log('Auth header presente:', authHeader ? 'SI' : 'NO')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Invalid Authorization header format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.slice(7).trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid Authorization header format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    console.log('Verifico utente...')
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !userData?.user) {
      console.error('Errore auth:', userError?.message || 'No user')
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = userData.user.id
    console.log('Utente verificato:', userId)

    // Parse request body
    const body = await req.json()
    console.log('Body ricevuto:', JSON.stringify(body).substring(0, 100))

    // Create case in database
    const { data: caseData, error: caseError } = await supabaseClient
      .from('cases')
      .insert({
        user_id: userData.user.id,
        title: body.title || 'Nuova pratica',
        status: body.status || 'new',
        source: body.source || null,
        metadata: body.metadata || {}
      })
      .select()
      .single()

    if (caseError) {
      console.error('Errore creazione case:', caseError)
      return new Response(JSON.stringify({ 
        error: 'Failed to create case',
        details: caseError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Case creato con successo:', caseData.id)

    return new Response(JSON.stringify({ 
      success: true, 
      case_id: caseData.id,
      case: {
        id: caseData.id,
        user_id: caseData.user_id,
        title: caseData.title,
        status: caseData.status,
        created_at: caseData.created_at
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Errore:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})