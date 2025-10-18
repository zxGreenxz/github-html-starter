import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, top = 20 } = await req.json();

    if (!postId) {
      throw new Error('PostId is required');
    }

    console.log('Fetching orders for postId:', postId);

    // Initialize Supabase client for token lookup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Facebook token from tpos_credentials
    const { data: tokenData, error: tokenError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'facebook')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError || !tokenData?.bearer_token) {
      console.error('❌ Facebook token not found:', tokenError);
      throw new Error('Facebook Bearer Token not found');
    }

    const bearerToken = tokenData.bearer_token;

    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetOrdersByPostId?PostId=${postId}&&%24top=${top}&%24orderby=DateCreated+desc&%24count=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'Authorization': `Bearer ${bearerToken}`,
        'tposappversion': '5.9.10.1',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', errorText);
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.value?.length || 0} orders`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
