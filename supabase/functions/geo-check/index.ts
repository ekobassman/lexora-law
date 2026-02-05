import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-demo-mode',
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

// Get client IP from various headers
function getClientIP(req: Request): string | null {
  // X-Forwarded-For can contain multiple IPs, take the first (original client)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }
  
  // Other common headers
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  const trueClientIP = req.headers.get('true-client-ip');
  if (trueClientIP) return trueClientIP;
  
  return null;
}

// Lookup country using free IP geolocation APIs (with fallback)
async function lookupCountry(ip: string): Promise<string | null> {
  // Skip private/local IPs
  if (ip.startsWith('127.') || ip.startsWith('10.') || 
      ip.startsWith('192.168.') || ip.startsWith('172.16.') ||
      ip === 'localhost' || ip === '::1') {
    console.log('[geo-check] Local/private IP detected:', ip);
    return null;
  }
  
  // Try ip-api.com first (free, no key needed, 45 req/min)
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
      signal: AbortSignal.timeout(3000),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.countryCode) {
        console.log('[geo-check] ip-api.com result:', data.countryCode);
        return data.countryCode;
      }
    }
  } catch (e) {
    console.log('[geo-check] ip-api.com failed:', e);
  }
  
  // Fallback: ipapi.co (free tier, 1000/day)
  try {
    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(3000),
    });
    
    if (response.ok) {
      const countryCode = (await response.text()).trim();
      if (countryCode && countryCode.length === 2 && !countryCode.includes('error')) {
        console.log('[geo-check] ipapi.co result:', countryCode);
        return countryCode;
      }
    }
  } catch (e) {
    console.log('[geo-check] ipapi.co failed:', e);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // First try infrastructure headers (fastest)
    let countryCode: string | null = null;
    
    // Cloudflare headers
    countryCode = req.headers.get('cf-ipcountry');
    
    // Vercel headers
    if (!countryCode) {
      countryCode = req.headers.get('x-vercel-ip-country');
    }
    
    // Supabase/Deno Deploy may add these
    if (!countryCode) {
      countryCode = req.headers.get('x-country');
    }
    
    // Fly.io headers
    if (!countryCode) {
      countryCode = req.headers.get('fly-client-country');
    }

    // If no infrastructure header, use IP geolocation API
    if (!countryCode) {
      const clientIP = getClientIP(req);
      console.log('[geo-check] No infra header, using IP lookup:', clientIP);
      
      if (clientIP) {
        countryCode = await lookupCountry(clientIP);
      }
    }

    // Log the check
    console.log('[geo-check] Final result:', { 
      countryCode: countryCode || 'unknown',
      cfHeader: req.headers.get('cf-ipcountry'),
      forwardedFor: req.headers.get('x-forwarded-for'),
    });

    // If still no country code, BLOCK access (fail-closed for security)
    // This is a change from fail-open to fail-closed for blocked countries
    if (!countryCode) {
      console.log('[geo-check] Could not determine country - blocking for security');
      return new Response(
        JSON.stringify({
          code: 'JURISDICTION_UNKNOWN',
          countryCode: 'unknown',
          isBlocked: true,
          reason: 'CANNOT_VERIFY_LOCATION'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 451  // Unavailable For Legal Reasons
        }
      );
    }

    // Normalize country code
    const normalizedCode = countryCode.toUpperCase();
    const isBlocked = BLOCKED_COUNTRIES.includes(normalizedCode);
    
    console.log('[geo-check] Country check result:', { 
      countryCode: normalizedCode, 
      isBlocked,
    });

    // If blocked, return 451 Unavailable For Legal Reasons
    if (isBlocked) {
      return new Response(
        JSON.stringify({
          code: 'JURISDICTION_BLOCKED',
          countryCode: normalizedCode,
          isBlocked: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 451  // Unavailable For Legal Reasons
        }
      );
    }

    // Not blocked
    return new Response(
      JSON.stringify({
        countryCode: normalizedCode,
        isBlocked: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('[geo-check] Error:', error);
    
    // On error, BLOCK access (fail-closed for security)
    return new Response(
      JSON.stringify({
        code: 'JURISDICTION_UNKNOWN',
        countryCode: 'unknown',
        isBlocked: true,
        reason: 'CHECK_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 451
      }
    );
  }
});
