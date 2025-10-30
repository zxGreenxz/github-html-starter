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

// Simple delay function
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idkhs } = await req.json(); // Expecting an array of idkh

    if (!idkhs || !Array.isArray(idkhs) || idkhs.length === 0) {
      return new Response(
        JSON.stringify({ error: "idkhs array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
        JSON.stringify({ error: 'TPOS Bearer Token not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = tokenData.bearer_token;

    const results: { idkh: string; data?: any; error?: string }[] = [];

    for (const idkh of idkhs) {
      const tposUrl = `https://tomato.tpos.vn/odata/Partner(${idkh})?$expand=PurchaseCurrency,Categories,AccountPayable,AccountReceivable,StockCustomer,StockSupplier,Title,PropertyProductPricelist,PropertySupplierPaymentTerm,PropertyPaymentTerm,Addresses,Phones`;

      console.log(`Fetching TPOS customer detail for idkh: ${idkh}`);

      try {
        const response = await fetch(tposUrl, {
          method: "GET",
          headers: getTPOSHeaders(bearerToken),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("TPOS API error:", response.status, errorText);
          results.push({
            idkh,
            error: `TPOS API error: ${response.status} - ${errorText}`,
          });
        } else {
          const data = await response.json();
          results.push({ idkh, data });
          console.log(
            `Successfully fetched TPOS customer detail for idkh: ${idkh}`,
          );
        }
      } catch (error) {
        console.error("Error fetching single customer detail:", error);
        results.push({
          idkh,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Add a small delay between requests to avoid rate limiting
      await delay(200); // 200ms delay
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      "Error in fetch-tpos-customer-details-batch function:",
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});