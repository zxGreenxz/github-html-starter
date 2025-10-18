import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TPOSProduct {
  Id: number;
  DefaultCode: string;
  Name: string;
  Variant?: string;
  BasePrice: number;
  ListPrice: number;
  Image?: string;
  OnHand: number;
  Barcode?: string;
  CategoryName?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { top = 50, skip = 0 } = await req.json();

    console.log(`Fetching ${top} products from TPOS (skip: ${skip})`);

    // Get active TPOS token from database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('No active TPOS token found:', tokenError);
      throw new Error('No active TPOS token found');
    }

    // Fetch products from TPOS
    const tposUrl = `https://tomato.tpos.vn/odata/Product?$top=${top}&$skip=${skip}&$orderby=DateCreated desc`;
    
    console.log('Calling TPOS API:', tposUrl);

    const response = await fetch(tposUrl, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization': `Bearer ${tokenData.bearer_token}`,
        'content-type': 'application/json;charset=UTF-8',
        'origin': 'https://tomato.tpos.vn',
        'referer': 'https://tomato.tpos.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TPOS API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`TPOS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const products: TPOSProduct[] = data.value || [];

    console.log(`Successfully fetched ${products.length} products from TPOS`);

    return new Response(
      JSON.stringify({
        success: true,
        products: products.map(p => ({
          Id: p.Id,
          DefaultCode: p.DefaultCode,
          Name: p.Name,
          Variant: p.Variant || null,
          BasePrice: p.BasePrice || 0,
          ListPrice: p.ListPrice || 0,
          Image: p.Image || null,
          OnHand: p.OnHand || 0,
          Barcode: p.Barcode || null,
          CategoryName: p.CategoryName || null,
        })),
        count: products.length,
        total: data['@odata.count'] || products.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error fetching TPOS products:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
