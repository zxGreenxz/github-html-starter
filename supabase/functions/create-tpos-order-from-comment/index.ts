import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Updated: 2025-01-15 - Use tpos_credentials table
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
    'accept': 'application/json, text/plain, */*',
    'authorization': `Bearer ${bearerToken}`,
    'content-type': 'application/json;charset=UTF-8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'tposappversion': '5.9.10.1',
    'x-request-id': generateRandomId(),
    'x-requested-with': 'XMLHttpRequest',
    'Referer': 'https://tomato.tpos.vn/',
  };
}

function convertFacebookTimeToISO(facebookTime: string): string {
  // Facebook format: "2025-10-09T08:43:42+0000"
  // TPOS format:     "2025-10-09T08:43:42.000Z"
  return facebookTime.replace('+0000', '.000Z');
}

/**
 * Parse variant string into name and code components
 * Format: "variant_name - product_code" or "- product_code"
 * Example: "Size M - N152" → { name: "Size M", code: "N152" }
 * Synced with frontend src/lib/variant-utils.ts for consistency
 */
function parseVariant(variant: string | null | undefined): { name: string; code: string } {
  if (!variant || variant.trim() === '') {
    return { name: '', code: '' };
  }
  
  const trimmed = variant.trim();
  
  // Format: "variant_name - product_code"
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        code: parts.slice(1).join(' - ').trim() // Handle edge case: "2-in-1 - N152"
      };
    }
  }
  
  // Format: "- product_code" (no variant name)
  if (trimmed.startsWith('- ')) {
    return {
      name: '',
      code: trimmed.substring(2).trim()
    };
  }
  
  // Old format: just variant name (backward compatibility)
  return {
    name: trimmed,
    code: ''
  };
}

/**
 * Get only the variant code part (after " - ")
 */
function getVariantCode(variant: string | null | undefined): string {
  return parseVariant(variant).code.toUpperCase();
}

/**
 * Get only the variant name part (before " - ")
 */
function getVariantName(variant: string | null | undefined): string {
  return parseVariant(variant).name;
}

/**
 * Extract all product codes from comment text
 * Pattern: N followed by numbers and optional letters (e.g., N55, N236L, N217)
 * Handles special characters around codes: (N217), [N217], N217., N217,, etc.
 */
function extractProductCodes(text: string): string[] {
  // More flexible pattern: N followed by digits, then optional letters
  // Allows for various surrounding characters
  const pattern = /N\d+[A-Z]*/gi;
  const matches = text.match(pattern);
  
  if (!matches) return [];
  
  // Convert to uppercase, remove duplicates, and normalize
  const codes = matches.map(m => m.toUpperCase().trim());
  return [...new Set(codes)]; // Remove duplicates
}

async function getCRMTeamId(
  postId: string,
  bearerToken: string,
  supabase: any
): Promise<{ teamId: string; teamName: string }> {
  try {
    // Extract page ID from post ID (format: pageId_postId)
    const pageId = postId.split('_')[0];
    
    // Try to get from database first
    const { data: pageData, error: pageError } = await supabase
      .from('facebook_pages')
      .select('crm_team_id, crm_team_name')
      .eq('page_id', pageId)
      .maybeSingle();

    if (!pageError && pageData?.crm_team_id) {
      console.log(`Found CRM Team ID in database: ${pageData.crm_team_id} (${pageData.crm_team_name})`);
      return {
        teamId: pageData.crm_team_id,
        teamName: pageData.crm_team_name,
      };
    }

    // Fallback: fetch from TPOS API
    console.log('CRM Team ID not found in database, fetching from TPOS...');
    const response = await fetch(
      "https://tomato.tpos.vn/odata/CRMTeam/ODataService.GetAllFacebook?$expand=Childs",
      {
        method: "GET",
        headers: getTPOSHeaders(bearerToken),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch CRM teams: ${response.status}`);
    }

    const data = await response.json();
    
    // Normalize function for Vietnamese text comparison
    const normalizeText = (text: string): string => {
      return text
        .normalize('NFC') // Normalize unicode
        .trim() // Remove leading/trailing whitespace
        .toLowerCase(); // Case insensitive
    };
    
    // Try to match with CRM team name or page name from database
    const nameToMatch = pageData?.crm_team_name || pageData?.page_name;
    if (nameToMatch && data.value) {
      const normalizedSearchName = normalizeText(nameToMatch);
      console.log(`Looking for CRM team matching: "${nameToMatch}" (normalized: "${normalizedSearchName}")`);
      
      const matchedTeam = data.value.find((team: any) => {
        const normalizedTeamName = normalizeText(team.Name);
        const isMatch = normalizedTeamName === normalizedSearchName;
        console.log(`  Comparing with "${team.Name}" (normalized: "${normalizedTeamName}"): ${isMatch}`);
        return isMatch;
      });
      
      if (matchedTeam) {
        // Save to database for future use
        await supabase
          .from('facebook_pages')
          .update({
            crm_team_id: matchedTeam.Id.toString(),
            crm_team_name: matchedTeam.Name,
          })
          .eq('page_id', pageId);

        console.log(`Found and saved CRM Team: ${matchedTeam.Name} (${matchedTeam.Id})`);
        return {
          teamId: matchedTeam.Id.toString(),
          teamName: matchedTeam.Name,
        };
      } else {
        console.log(`No matching CRM team found for "${nameToMatch}"`);
        console.log(`Available teams:`, data.value.map((t: any) => t.Name).join(', '));
      }
    }

    // Last resort: use default ID
    console.log('Using default CRM Team ID: 10052');
    return { teamId: '10052', teamName: 'Default Team' };
  } catch (error) {
    console.error('Error getting CRM Team ID:', error);
    return { teamId: '10052', teamName: 'Default Team' };
  }
}

async function createLiveCampaign(
  postId: string,
  teamId: string,
  bearerToken: string
): Promise<string> {
  try {
    console.log('Creating LiveCampaign for post:', postId, 'TeamId:', teamId);
    
    const response = await fetch(
      "https://tomato.tpos.vn/rest/v1.0/facebookpost/save_posts",
      {
        method: "POST",
        headers: getTPOSHeaders(bearerToken),
        body: JSON.stringify({
          PostIds: [postId],
          TeamId: parseInt(teamId, 10),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create LiveCampaign:', response.status, errorText);
      throw new Error(`Failed to create LiveCampaign: ${response.status}`);
    }

    const data = await response.json();
    console.log("Create LiveCampaign response:", JSON.stringify(data, null, 2));

    if (Array.isArray(data) && data.length > 0 && data[0].LiveCampaignId) {
      console.log('Created LiveCampaignId:', data[0].LiveCampaignId);
      return data[0].LiveCampaignId;
    }

    throw new Error(`Failed to get LiveCampaignId from create response`);
  } catch (error) {
    console.error('Error creating LiveCampaign:', error);
    throw error;
  }
}

async function fetchLiveCampaignId(
  postId: string,
  teamId: string,
  bearerToken: string
): Promise<string> {
  try {
    console.log('Fetching LiveCampaignId for post:', postId, 'TeamId:', teamId);
    
    const response = await fetch(
      "https://tomato.tpos.vn/rest/v1.0/facebookpost/get_saved_by_ids",
      {
        method: "POST",
        headers: getTPOSHeaders(bearerToken),
        body: JSON.stringify({
          PostIds: [postId],
          TeamId: parseInt(teamId, 10),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch LiveCampaignId:', response.status, errorText);
      throw new Error(`Failed to fetch LiveCampaignId: ${response.status}`);
    }

    const data = await response.json();
    console.log("LiveCampaign API response:", JSON.stringify(data, null, 2));

    if (Array.isArray(data) && data.length > 0 && data[0].LiveCampaignId) {
      console.log('Found existing LiveCampaignId:', data[0].LiveCampaignId);
      return data[0].LiveCampaignId;
    }

    // Nếu chưa có LiveCampaign, tạo mới
    console.log('LiveCampaign not found, creating new one...');
    return await createLiveCampaign(postId, teamId, bearerToken);
  } catch (error) {
    console.error('Error fetching LiveCampaignId:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: any = null;

  try {
    const { comment, video, commentType } = await req.json();

    if (!comment || !video) {
      throw new Error('Comment and video data are required');
    }

    console.log('📝 Received commentType:', commentType || 'not provided');
    console.log('📝 commentType type:', typeof commentType);
    console.log('📝 commentType === "hang_dat":', commentType === 'hang_dat');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
      throw new Error('Facebook Bearer Token not found');
    }

    const bearerToken = tokenData.bearer_token;

    // Get CRM Team ID from database or fetch from API
    const { teamId, teamName } = await getCRMTeamId(video.objectId, bearerToken, supabase);

    // Fetch LiveCampaignId dynamically
    const liveCampaignId = await fetchLiveCampaignId(video.objectId, teamId, bearerToken);

    const tposUrl = "https://tomato.tpos.vn/odata/SaleOnline_Order?IsIncrease=True&$expand=Details,User,Partner($expand=Addresses)";

    // Clean comment object - chỉ giữ fields TPOS API cần
    const cleanComment = {
      id: comment.id,
      is_hidden: comment.is_hidden,
      message: comment.message,
      created_time: comment.created_time,
      created_time_converted: convertFacebookTimeToISO(comment.created_time),
      from: {
        id: comment.from.id,
        name: comment.from.name
      }
    };

    payload = {
      "CRMTeamId": parseInt(teamId, 10),
      "LiveCampaignId": liveCampaignId,
      "Facebook_PostId": video.objectId,
      "Facebook_ASUserId": comment.from.id,
      "Facebook_UserName": comment.from.name,
      "Facebook_CommentId": comment.id,
      "Name": comment.from.name,
      "PartnerName": comment.from.name,
      "Details": [],
      "TotalAmount": 0,
      "Facebook_Comments": [cleanComment],
      "WarehouseId": 1,
      "CompanyId": 1,
      "TotalQuantity": 0,
      "Note": `{before}${comment.message}`,
      "DateCreated": new Date().toISOString(),
    };

    console.log("Sending payload to TPOS:", JSON.stringify(payload, null, 2));

    const response = await fetch(tposUrl, {
      method: "POST",
      headers: getTPOSHeaders(bearerToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', errorText);
      // Return payload even on error for debugging
      return new Response(
        JSON.stringify({ payload, error: `TPOS API error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("TPOS response:", data);

    // Save to pending_live_orders (queue table for background processing)
    try {
      const { error: pendingError } = await supabase
        .from('pending_live_orders' as any)
        .upsert({
          id: data.Id,
          facebook_comment_id: comment.id,
          comment_text: comment.message,
          customer_name: comment.from.name,
          session_index: data.SessionIndex?.toString() || null,
          created_at: convertFacebookTimeToISO(comment.created_time),
          processed: false,
        }, {
          onConflict: 'facebook_comment_id'
        });

      if (pendingError) {
        console.error('Error saving to pending_live_orders:', pendingError);
      } else {
        console.log('Successfully saved to pending_live_orders queue');
      }
    } catch (pendingDbError) {
      console.error('Exception saving to pending_live_orders:', pendingDbError);
    }

    // Save to facebook_pending_orders table
    console.log('💾 About to save to facebook_pending_orders with commentType:', commentType);
    try {
      // Check for existing order with the same comment_id
      const { data: existingOrder } = await supabase
        .from('facebook_pending_orders')
        .select('id, order_count')
        .eq('facebook_comment_id', comment.id)
        .maybeSingle();

      if (existingOrder) {
        // Update existing record, increment count
        const newOrderCount = existingOrder.order_count + 1;
        console.log(`⬆️ Updating existing order, incrementing count to: ${newOrderCount}`);
        console.log(`⬆️ commentType value before UPDATE: "${commentType}"`);

      const { error: updateError } = await supabase
        .from('facebook_pending_orders')
        .update({
          name: data.Name || comment.from.name,
          session_index: data.SessionIndex?.toString() || null,
          code: data.Code || null,
          phone: data.Telephone || null,
          comment: comment.message || null,
          tpos_order_id: data.Id || null,
          order_count: newOrderCount,
          comment_type: commentType || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id);
      
      if (updateError) {
        console.error('❌ Error updating facebook_pending_orders:', updateError);
      } else {
        console.log(`✅ Successfully updated order with commentType: "${commentType}"`);
      }
      
      // Update facebook_comments_archive
      if (!updateError) {
        const { error: archiveUpdateError } = await supabase
          .from('facebook_comments_archive')
          .update({
            tpos_order_id: data.Id?.toString() || null,
            tpos_session_index: data.SessionIndex?.toString() || null,
            tpos_sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('facebook_comment_id', comment.id);

        if (archiveUpdateError) {
          console.error('Error updating comment archive:', archiveUpdateError);
        }
      }

      } else {
        // Insert new record with count = 1
        console.log(`➕ Creating new order with count: 1`);
        console.log(`➕ commentType value before INSERT: "${commentType}"`);

      const { error: insertError } = await supabase
        .from('facebook_pending_orders')
        .insert({
          name: data.Name || comment.from.name,
          session_index: data.SessionIndex?.toString() || null,
          code: data.Code || null,
          phone: data.Telephone || null,
          comment: comment.message || null,
          created_time: convertFacebookTimeToISO(comment.created_time),
          tpos_order_id: data.Id || null,
          facebook_comment_id: comment.id,
          facebook_user_id: comment.from.id,
          facebook_post_id: video.objectId,
          order_count: 1,
          comment_type: commentType || null,
        });
      
      if (insertError) {
        console.error('❌ Error saving to facebook_pending_orders:', insertError);
      } else {
        console.log(`✅ Successfully created order with commentType: "${commentType}"`);
      }
      
      // Update facebook_comments_archive
      if (!insertError) {
        const { error: archiveUpdateError } = await supabase
          .from('facebook_comments_archive')
          .update({
            tpos_order_id: data.Id?.toString() || null,
            tpos_session_index: data.SessionIndex?.toString() || null,
            tpos_sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('facebook_comment_id', comment.id);

        if (archiveUpdateError) {
          console.error('Error updating comment archive:', archiveUpdateError);
        }
      }

      }
    } catch (dbError) {
      console.error('Exception saving to database:', dbError);
    }

    // Return both payload and response
    return new Response(JSON.stringify({ payload, response: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-tpos-order-from-comment function:', error);
    return new Response(
      JSON.stringify({ payload, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});