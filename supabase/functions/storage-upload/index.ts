import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Check if request is from a blocked jurisdiction (FAIL-OPEN for dev/preview)
function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null; reason: string } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  
  // FAIL-OPEN: Allow if no country header (dev/preview environment)
  if (!countryCode) {
    return { blocked: false, countryCode: null, reason: 'NO_GEO_HEADER' };
  }
  
  const normalized = countryCode.toUpperCase();
  
  if (BLOCKED_COUNTRIES.includes(normalized)) {
    return { blocked: true, countryCode: normalized, reason: 'JURISDICTION_BLOCKED' };
  }
  
  return { blocked: false, countryCode: normalized, reason: 'OK' };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STORAGE-UPLOAD] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    logStep('Jurisdiction blocked', { countryCode: geoCheck.countryCode, reason: geoCheck.reason });
    return new Response(
      JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // STEP 1: Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Auth error", { error: userError?.message });
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // STEP 2: Parse request body
    const body = await req.json();
    const { 
      bucket = 'pratiche-files',
      filePath,
      fileBase64,
      mimeType,
      fileSize
    } = body;

    // STEP 3: Validate inputs
    if (!filePath || typeof filePath !== 'string') {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "filePath is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "fileBase64 is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate MIME type
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
      logStep("Invalid MIME type", { mimeType });
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "File type not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate file size
    const decodedSize = (fileBase64.length * 3) / 4; // Approximate decoded size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      logStep("File too large", { fileSize, maxSize: MAX_FILE_SIZE });
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "File size exceeds 10MB limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // STEP 4: Ensure file path includes user_id prefix for security
    const secureFilePath = filePath.startsWith(`${userId}/`) ? filePath : `${userId}/${filePath}`;

    // STEP 5: Decode base64 and upload using service role
    const binaryData = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
    
    logStep("Uploading file", { bucket, path: secureFilePath, size: binaryData.length, mimeType });

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(secureFilePath, binaryData, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      logStep("Upload error", { error: uploadError.message });
      
      // Handle duplicate file error
      if (uploadError.message.includes('already exists') || uploadError.message.includes('duplicate')) {
        return new Response(JSON.stringify({ 
          error: "DUPLICATE_FILE", 
          message: "A file with this name already exists" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // STEP 6: Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(secureFilePath);

    logStep("Upload successful", { path: uploadData.path });

    return new Response(JSON.stringify({ 
      success: true,
      path: uploadData.path,
      fullPath: secureFilePath,
      publicUrl: urlData.publicUrl,
      bucket,
      size: binaryData.length,
      mimeType: mimeType || 'application/octet-stream',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
