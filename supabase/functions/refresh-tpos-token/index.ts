import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the request body (must contain credentialId)
    const body = await req.json().catch(() => ({}));
    const { credentialId } = body;

    if (!credentialId) {
      return new Response(
        JSON.stringify({ success: false, message: 'credentialId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get credential from database
    const { data: credentialData, error: credError } = await supabase
      .from('tpos_credentials')
      .select('username, password, token_type')
      .eq('id', credentialId)
      .single();

    if (credError || !credentialData) {
      throw new Error('Credential not found');
    }

    const { username, password, token_type: tokenType } = credentialData;
    console.log(`🔄 Refreshing token for credential ${credentialId} (${tokenType})`);

    // Get new token from TPOS
    console.log('📞 Calling TPOS token endpoint...');
    const tokenResponse = await fetch('https://tomato.tpos.vn/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://tomato.tpos.vn',
        'Referer': 'https://tomato.tpos.vn/',
        'tposappversion': '5.10.13.1',
        'x-tpos-lang': 'vi'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
        client_id: 'tmtWebApp'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ TPOS token request failed:', tokenResponse.status, errorText);
      throw new Error(`Failed to get token from TPOS: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const newToken = tokenData.access_token;

    if (!newToken) {
      throw new Error('No access token in response');
    }

    console.log('✅ Got new token from TPOS');

    // Update the bearer_token in tpos_credentials
    const { error: updateError } = await supabase
      .from('tpos_credentials')
      .update({
        bearer_token: newToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', credentialId);

    if (updateError) {
      console.error(`❌ Error updating token in credentials:`, updateError);
      throw updateError;
    }

    console.log(`✅ Token refresh completed successfully for credential ${credentialId} (${tokenType})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${tokenType.toUpperCase()} token refreshed successfully`,
        tokenType,
        refreshedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in refresh-tpos-token:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
