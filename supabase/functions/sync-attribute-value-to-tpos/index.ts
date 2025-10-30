import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATTRIBUTE_MAPPING = {
  "Màu": { id: 3, code: "Mau" },
  "Size Số": { id: 4, code: "SZNu" },
  "Size Chữ": { id: 1, code: "SZCh" },
} as const;

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
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json;charset=UTF-8",
    authorization: `Bearer ${bearerToken}`,
    "x-tpos-lang": "vi",
    origin: "https://tomato.tpos.vn",
    referer: "https://tomato.tpos.vn/",
    "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "x-request-id": generateRandomId(),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { attributeName, code, value } = await req.json();

    console.log('Syncing attribute value to TPOS:', { attributeName, code, value });

    // Validate attribute name
    if (!(attributeName in ATTRIBUTE_MAPPING)) {
      throw new Error(`Invalid attribute name: ${attributeName}. Must be one of: Màu, Size Số, Size Chữ`);
    }

    const attributeConfig = ATTRIBUTE_MAPPING[attributeName as keyof typeof ATTRIBUTE_MAPPING];

    // Get the most recent TPOS token
    const { data: tokenData, error: tokenError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token, id')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData?.bearer_token) {
      throw new Error('No TPOS token found. Please add TPOS credentials first.');
    }

    const bearerToken = tokenData.bearer_token;
    const credentialId = tokenData.id;

    // Build TPOS payload
    const payload = {
      Attribute: {
        Id: attributeConfig.id,
        Name: attributeName,
        Code: attributeConfig.code,
        Sequence: null,
        CreateVariant: true,
      },
      Code: code || value, // Use value as code if code is not provided
      Name: value,
      AttributeId: attributeConfig.id,
    };

    console.log('TPOS payload:', payload);

    // Make POST request to TPOS
    let response = await fetch(
      'https://tomato.tpos.vn/odata/ProductAttributeValue',
      {
        method: 'POST',
        headers: getTPOSHeaders(bearerToken),
        body: JSON.stringify(payload),
      }
    );

    // Handle token expiration
    if (response.status === 401) {
      console.log('Token expired, attempting to refresh...');
      
      // Call refresh token function
      const { error: refreshError } = await supabase.functions.invoke('refresh-tpos-token', {
        body: { credentialId },
      });

      if (refreshError) {
        throw new Error(`Failed to refresh token: ${refreshError.message}`);
      }

      // Get the new token
      const { data: newTokenData, error: newTokenError } = await supabase
        .from('tpos_credentials')
        .select('bearer_token')
        .eq('id', credentialId)
        .single();

      if (newTokenError || !newTokenData?.bearer_token) {
        throw new Error('Failed to get refreshed token');
      }

      console.log('Token refreshed, retrying request...');

      // Retry with new token
      response = await fetch(
        'https://tomato.tpos.vn/odata/ProductAttributeValue',
        {
          method: 'POST',
          headers: getTPOSHeaders(newTokenData.bearer_token),
          body: JSON.stringify(payload),
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', errorText);
      throw new Error(`TPOS API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('TPOS sync successful:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        tpos_id: result.Id,
        tpos_attribute_id: result.AttributeId,
        sequence: result.Sequence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-attribute-value-to-tpos:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
