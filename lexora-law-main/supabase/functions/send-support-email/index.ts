import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Email must match exactly as registered in Resend
const SUPPORT_EMAIL = "support@lexora-law.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  if (!countryCode) return { blocked: false, countryCode: null };
  const normalized = countryCode.toUpperCase();
  return { blocked: BLOCKED_COUNTRIES.includes(normalized), countryCode: normalized };
}

interface SupportEmailRequest {
  name: string;
  email: string;
  requestType: string;
  message: string;
  language?: string;
  pageSource?: string;
  hasAttachment?: boolean;
  attachmentName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[send-support-email] Jurisdiction blocked:', geoCheck.countryCode);
    return new Response(
      JSON.stringify({ code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode }),
      { status: 451, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const { 
      name, 
      email, 
      requestType, 
      message, 
      language = 'en',
      pageSource = 'unknown',
      hasAttachment = false,
      attachmentName = ''
    }: SupportEmailRequest = await req.json();

    // Validate inputs
    if (!email || !message || !requestType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (name.length > 100 || email.length > 255 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Input too long" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize inputs for HTML
    const sanitize = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safeRequestType = sanitize(requestType);
    const safeMessage = sanitize(message).replace(/\n/g, '<br>');
    const safePageSource = sanitize(pageSource);
    const timestamp = new Date().toISOString();

    // Send email using Resend API directly
    // Using Resend's default test domain - emails go TO your email, user's email is in reply_to
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Lexora Support <onboarding@resend.dev>",
        to: [SUPPORT_EMAIL],
        reply_to: email,
        subject: `[Lexora Support] ${safeRequestType} - from ${safeName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #d4af37; margin: 0; font-size: 24px;">LEXORA SUPPORT</h1>
              <p style="color: #f5f5dc; margin: 5px 0 0 0; opacity: 0.8;">New Support Request</p>
            </div>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold; width: 140px;">Request Type:</td>
                  <td style="padding: 10px 0; color: #333;"><strong style="color: #1a1a2e;">${safeRequestType}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">Name:</td>
                  <td style="padding: 10px 0; color: #333;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">Email:</td>
                  <td style="padding: 10px 0; color: #333;"><a href="mailto:${safeEmail}" style="color: #1a1a2e;">${safeEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">Language:</td>
                  <td style="padding: 10px 0; color: #333;">${language.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">Page Source:</td>
                  <td style="padding: 10px 0; color: #333;">${safePageSource}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 10px 0; color: #333;">${timestamp}</td>
                </tr>
                ${hasAttachment ? `
                <tr>
                  <td style="padding: 10px 0; color: #666; font-weight: bold;">📎 Attachment:</td>
                  <td style="padding: 10px 0; color: #333;">${sanitize(attachmentName)}</td>
                </tr>
                ` : ''}
              </table>
              
              <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 4px; border-left: 4px solid #d4af37;">
                <p style="margin: 0 0 10px 0; color: #666; font-weight: bold;">Message:</p>
                <p style="margin: 0; color: #333; line-height: 1.6;">${safeMessage}</p>
              </div>
              
              <div style="margin-top: 20px; padding: 10px; background: #e8f4f8; border-radius: 4px;">
                <p style="margin: 0; font-size: 12px; color: #666;">
                  You can reply directly to this email to respond to ${safeName}.
                </p>
              </div>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Failed to send email");
    }

    const data = await res.json();
    console.log("Support email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-support-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);