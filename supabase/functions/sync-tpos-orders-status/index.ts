import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch TPOS token from tpos_credentials
  const { data: tokenData, error: tokenError } = await supabaseClient
    .from('tpos_credentials')
    .select('bearer_token')
    .eq('token_type', 'tpos')
    .not('bearer_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenError || !tokenData?.bearer_token) {
    console.error('TPOS token not found:', tokenError);
    return new Response(
      JSON.stringify({ error: 'TPOS bearer token not found' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const bearerToken = tokenData.bearer_token;

  const headers = {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
  };

  // Get comments with orders (not already marked as deleted)
  const { data: commentsWithOrders, error } = await supabaseClient
    .from('facebook_comments_archive')
    .select('id, facebook_comment_id, tpos_order_id, tpos_session_index')
    .eq('tpos_sync_status', 'synced')
    .not('tpos_order_id', 'is', null)
    .limit(100);

  if (error) {
    console.error('Error fetching comments:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results = [];

  // Check each order on TPOS
  for (const comment of commentsWithOrders || []) {
    try {
      const response = await fetch(
        `https://services.topca.vn/api/Bill/${comment.tpos_order_id}`,
        { headers }
      );

      if (response.status === 404 || response.status === 400) {
        // Order deleted on TPOS
        await supabaseClient
          .from('facebook_comments_archive')
          .update({
            is_deleted_by_tpos: true,
            tpos_sync_status: 'deleted',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', comment.id);

        results.push({
          comment_id: comment.facebook_comment_id,
          session_index: comment.tpos_session_index,
          status: 'deleted',
        });
      } else if (response.ok) {
        // Order still exists
        await supabaseClient
          .from('facebook_comments_archive')
          .update({
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', comment.id);

        results.push({
          comment_id: comment.facebook_comment_id,
          session_index: comment.tpos_session_index,
          status: 'synced',
        });
      }
    } catch (err) {
      console.error(`Error checking order ${comment.tpos_order_id}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push({
        comment_id: comment.facebook_comment_id,
        session_index: comment.tpos_session_index,
        status: 'error',
        error: errorMessage,
      });
    }
  }

  return new Response(
    JSON.stringify({
      checked: commentsWithOrders?.length || 0,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
