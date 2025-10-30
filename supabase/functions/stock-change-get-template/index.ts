import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    "accept-language": "vi-VN",
    authorization: `Bearer ${bearerToken}`,
    "content-type": "application/json;charset=UTF-8",
    "x-request-id": generateRandomId(),
    "x-tpos-lang": "vi",
    origin: "https://tomato.tpos.vn",
    referer: "https://tomato.tpos.vn/",
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch TPOS token
    const { data: tokenData, error: tokenError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError || !tokenData?.bearer_token) {
      throw new Error('TPOS Bearer Token not found');
    }

    const bearerToken = tokenData.bearer_token;

    // Parse request body
    const requestBody = await req.json();
    const productTmplId = requestBody.model?.ProductTmplId;
    
    if (!productTmplId) {
      return new Response(
        JSON.stringify({ error: 'Missing ProductTmplId in model' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 [Step 1] Getting stock change template for ProductTmplId: ${productTmplId}`);

    // Call TPOS API
    const url = "https://tomato.tpos.vn/odata/StockChangeProductQty/ODataService.DefaultGetAll?$expand=ProductTmpl,Product,Location";
    const payload = { "model": { "ProductTmplId": productTmplId } };

    const response = await fetch(url, {
      method: 'POST',
      headers: getTPOSHeaders(bearerToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Step 1] TPOS API error: ${response.status}`, errorText);
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ [Step 1] Stock change template fetched successfully. Items: ${data.value?.length || 0}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ [Step 1] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
