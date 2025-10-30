import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTPOSHeaders(bearerToken: string) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    authorization: `Bearer ${bearerToken}`,
    priority: "u=1, i",
    "sec-ch-ua": '"Google Chrome";v="126", "Chromium";v="126", "Not?A_Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    Referer: "https://tomato.tpos.vn/",
    "x-request-id": generateRandomId(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for token lookup
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch TPOS token from tpos_credentials
    const { data: tokenData, error: tokenError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError || !tokenData?.bearer_token) {
      return new Response(
        JSON.stringify({ 
          is_valid: false, 
          error: 'TPOS Bearer Token not found' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const bearerToken = tokenData.bearer_token;

    // Attempt a lightweight API call to TPOS to check credentials
    const tposUrl = `https://tomato.tpos.vn/odata/Partner/ODataService.GetViewV2?$top=1`; // Fetch 1 partner to check access

    console.log("Checking TPOS credentials...");

    const response = await fetch(tposUrl, {
      method: "GET",
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "TPOS API error during credential check:",
        response.status,
        errorText,
      );

      let errorMessage = `TPOS API returned ${response.status}: ${response.statusText}`;
      if (response.status === 401 || response.status === 403) {
        errorMessage =
          "TPOS Bearer Token đã hết hạn/không hợp lệ. Vui lòng cập nhật trong Supabase Secrets.";
      } else {
        errorMessage = `Lỗi khi kiểm tra TPOS API: ${errorText}`;
      }

      return new Response(
        JSON.stringify({ is_valid: false, error: errorMessage }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("TPOS credentials are valid.");
    return new Response(JSON.stringify({ is_valid: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-tpos-credentials function:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ is_valid: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});