import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId');
  const postId = url.searchParams.get('postId');
  const sessionIndex = url.searchParams.get('sessionIndex') || postId; // Session identifier for live videos
  const limit = url.searchParams.get('limit') || '100';
  const after = url.searchParams.get('after');
  const order = url.searchParams.get('order') || 'reverse_chronological';

    if (!pageId || !postId) {
      return new Response(
        JSON.stringify({ error: 'pageId and postId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Facebook token from tpos_credentials
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'facebook')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError || !tokenData?.bearer_token) {
      console.error('❌ Facebook token not found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Facebook Bearer Token not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = tokenData.bearer_token;

    // ========== DEBOUNCE CHECK: Skip if fetched recently ==========
    const { data: snapshotCheck } = await supabaseClient
      .from('facebook_live_comments_snapshot')
      .select('last_fetched_at, comments_data')
      .eq('facebook_post_id', postId)
      .maybeSingle();

    if (snapshotCheck?.last_fetched_at) {
      const now = new Date();
      const lastFetch = new Date(snapshotCheck.last_fetched_at);
      const diffMs = now.getTime() - lastFetch.getTime();

      // Skip if fetched within last 3 seconds
      if (diffMs < 3000) {
        console.log(`⏭️ Skipping TPOS fetch - fetched ${Math.round(diffMs / 1000)}s ago`);
        
        return new Response(
          JSON.stringify({
            data: snapshotCheck.comments_data || [],
            paging: {},
            source: 'debounced'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== STEP 1: Try TPOS API first ==========
    try {
      let tposUrl = `https://tomato.tpos.vn/api/facebook-graph/comment?pageid=${pageId}&facebook_type=Page&postId=${postId}&limit=${limit}&order=${order}`;
      if (after) {
        tposUrl += `&after=${after}`;
      }

      console.log(`🔄 Fetching from TPOS API: postId=${postId}, limit=${limit}`);

      const response = await fetch(tposUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'tposappversion': '5.9.10.1',
          'x-requested-with': 'XMLHttpRequest',
        },
      });

      // ========== STEP 2A: Handle deleted post (400 error) ==========
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ TPOS API error: ${response.status} - ${errorText}`);
        
        if (response.status === 400 && errorText.includes('Object with ID')) {
          console.log(`🗑️ Post ${postId} deleted - returning empty comments`);
          
          return new Response(
            JSON.stringify({ 
              data: [], 
              paging: {}, 
              source: 'deleted' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`TPOS API failed: ${response.status}`);
      }

      // ========== STEP 2B: TPOS success - Save to JSON snapshot ==========
      const data = await response.json();
      const comments = data?.data || [];

      console.log(`✅ TPOS API returned ${comments.length} comments`);

      if (comments.length > 0) {
        console.log(`💾 Saving snapshot for post ${postId}...`);
        
        // 1. Get existing snapshot
        const { data: existingSnapshot } = await supabaseClient
          .from('facebook_live_comments_snapshot')
          .select('comments_data, last_tpos_count')
          .eq('facebook_post_id', postId)
          .maybeSingle();
        
        // 2. Create map of current TPOS comment IDs
        const tposCommentIds = new Set(comments.map((c: any) => c.id));
        
        let updatedCommentsArray = [];
        const fetchedAt = new Date().toISOString();
        
        if (existingSnapshot) {
          // 3. Process existing comments: check if deleted
          updatedCommentsArray = (existingSnapshot.comments_data || []).map((existingComment: any) => {
            if (!tposCommentIds.has(existingComment.id)) {
              // Comment was deleted by TPOS
              return {
                ...existingComment,
                is_deleted_by_tpos: true,
                deleted_at: existingComment.is_deleted_by_tpos ? existingComment.deleted_at : fetchedAt,
              };
            }
            
            // Comment still exists - update info from TPOS
            const tposComment = comments.find((c: any) => c.id === existingComment.id);
            return {
              ...existingComment,
              like_count: tposComment?.like_count || existingComment.like_count,
              is_hidden: tposComment?.is_hidden || existingComment.is_hidden,
              is_deleted_by_tpos: false,
            };
          });
        }
        
        // 4. Add NEW comments from TPOS
        const existingCommentIds = new Set(updatedCommentsArray.map((c: any) => c.id));
        let newCommentsCount = 0;
        
        comments.forEach((comment: any) => {
          if (!existingCommentIds.has(comment.id)) {
            updatedCommentsArray.push({
              id: comment.id,
              message: comment.message || '',
              from: comment.from || { name: 'Unknown', id: '' },
              created_time: comment.created_time,
              like_count: comment.like_count || 0,
              is_hidden: comment.is_hidden || false,
              fetched_at: fetchedAt,
              is_deleted_by_tpos: false,
            });
            newCommentsCount++;
          }
        });
        
        console.log(`📊 Snapshot: ${updatedCommentsArray.length} total, ${newCommentsCount} new`);
        
        // 5. Count deleted comments
        const deletedComments = updatedCommentsArray.filter((c: any) => c.is_deleted_by_tpos);
        console.log(`🗑️ Deleted comments: ${deletedComments.length}`);
        
        // 6. Upsert snapshot
        const { error: upsertError } = await supabaseClient
          .from('facebook_live_comments_snapshot')
          .upsert({
            facebook_post_id: postId,
            comments_data: updatedCommentsArray,
            total_comments: updatedCommentsArray.length,
            last_tpos_count: comments.length,
            deleted_count: deletedComments.length,
            last_fetched_at: fetchedAt,
            updated_at: fetchedAt,
          }, {
            onConflict: 'facebook_post_id',
          });
        
        if (upsertError) {
          console.error('❌ Snapshot save error:', upsertError.message);
        } else {
          console.log(`✅ Saved snapshot: ${updatedCommentsArray.length} comments (${deletedComments.length} deleted)`);
        }
        
        // Push comments to facebook_comments_archive for UI display
        if (updatedCommentsArray.length > 0) {
          console.log(`💾 Pushing ${updatedCommentsArray.length} comments to archive...`);
          
          const commentsToInsert = updatedCommentsArray.map((comment: any) => {
            const baseData: any = {
              facebook_comment_id: comment.id,
              facebook_post_id: postId,
              facebook_user_id: comment.from?.id || '',
              facebook_user_name: comment.from?.name || 'Unknown',
              comment_message: comment.message || '',
              comment_created_time: comment.created_time,
              like_count: comment.like_count || 0,
              is_deleted_by_tpos: comment.is_deleted_by_tpos || false,
              last_fetched_at: fetchedAt,
              updated_at: fetchedAt,
            };
            
            // ✅ CHỈ gán tpos_session_index cho comments MỚI (chưa có order)
            // Nếu comment đã có order, không ghi đè giá trị từ TPOS API
            if (!comment.tpos_order_id) {
              baseData.tpos_session_index = sessionIndex;
            }
            
            return baseData;
          });
          
          // ========== OPTIMIZATION: Pre-fill session_index to avoid trigger overhead ==========
          const uniqueUserIds = [...new Set(commentsToInsert.map((c: any) => c.facebook_user_id).filter(Boolean))];
          
          if (uniqueUserIds.length > 0) {
            console.log(`🔍 Looking up session_index for ${uniqueUserIds.length} users...`);
            
            const { data: existingSessions } = await supabaseClient
              .from('facebook_comments_archive')
              .select('facebook_user_id, session_index')
              .eq('facebook_post_id', postId)
              .in('facebook_user_id', uniqueUserIds)
              .not('session_index', 'is', null);
            
            // Build lookup map
            const sessionIndexMap = new Map<string, string>();
            if (existingSessions) {
              existingSessions.forEach((row: any) => {
                if (row.facebook_user_id && row.session_index) {
                  sessionIndexMap.set(row.facebook_user_id, row.session_index);
                }
              });
            }
            
            console.log(`✅ Found ${sessionIndexMap.size} existing session_index values`);
            
            // Apply to comments
            commentsToInsert.forEach((comment: any) => {
              if (!comment.session_index && comment.facebook_user_id) {
                const existingIndex = sessionIndexMap.get(comment.facebook_user_id);
                if (existingIndex) {
                  comment.session_index = existingIndex;
                }
              }
            });
          }
          
          const { error: archiveError } = await supabaseClient
            .from('facebook_comments_archive')
            .upsert(commentsToInsert, {
              onConflict: 'facebook_comment_id',
              ignoreDuplicates: false,
            });
          
          if (archiveError) {
            console.error('❌ Archive insert error:', archiveError.message);
          } else {
            console.log(`✅ Pushed ${commentsToInsert.length} comments to archive`);
          }
        }
      }
      
      // Extract paging cursor from response
      let responsePayload = data;
      if (responsePayload.paging && !responsePayload.paging.cursors?.after && responsePayload.paging.next) {
        try {
          const nextUrl = new URL(responsePayload.paging.next);
          const afterCursor = nextUrl.searchParams.get('after');
          if (afterCursor) {
            if (!responsePayload.paging.cursors) {
              responsePayload.paging.cursors = {};
            }
            responsePayload.paging.cursors.after = afterCursor;
            console.log(`📍 Extracted cursor: ${afterCursor}`);
          }
        } catch (e) {
          console.warn("Could not parse paging URL:", e instanceof Error ? e.message : String(e));
        }
      }

      return new Response(
        JSON.stringify({
          ...responsePayload,
          source: 'tpos_api'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (tposError) {
      // ========== STEP 3: TPOS failed - Fallback to snapshot ==========
      console.log(`🔄 TPOS unavailable, reading snapshot...`);
      console.error('TPOS error:', tposError instanceof Error ? tposError.message : String(tposError));

      const { data: snapshot, error: dbError } = await supabaseClient
        .from('facebook_live_comments_snapshot')
        .select('comments_data, total_comments')
        .eq('facebook_post_id', postId)
        .maybeSingle();

      if (dbError || !snapshot) {
        console.error('❌ Snapshot not found:', dbError);
        return new Response(
          JSON.stringify({ 
            error: 'No cached data available',
            details: dbError?.message
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform snapshot to TPOS format
      const transformedData = {
        data: snapshot.comments_data || [],
        paging: { cursors: {} }
      };

      console.log(`✅ Retrieved ${snapshot.total_comments} comments from snapshot`);

      return new Response(
        JSON.stringify({
          ...transformedData,
          source: 'snapshot'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('❌ Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
