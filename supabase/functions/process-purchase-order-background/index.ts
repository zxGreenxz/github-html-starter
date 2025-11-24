import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  purchase_order_id: string;
  imageCache?: Record<string, string>; // ✅ NEW - URL -> base64 mapping
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { purchase_order_id, imageCache = {} }: RequestBody = await req.json();

    console.log(`🔄 [Background Process] Starting for order: ${purchase_order_id}`);
    console.log(`📦 Received cache with ${Object.keys(imageCache).length} images`);

    // 🧹 Clean up stuck items (processing > 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckItems } = await supabase
      .from('purchase_order_items')
      .select('id, product_code')
      .eq('purchase_order_id', purchase_order_id)
      .eq('tpos_sync_status', 'processing')
      .lt('tpos_sync_started_at', fiveMinutesAgo);
    
    if (stuckItems && stuckItems.length > 0) {
      console.log(`🧹 Cleaning up ${stuckItems.length} stuck items`);
      await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'failed',
          tpos_sync_error: 'Timeout: Xử lý quá lâu (> 5 phút)',
          tpos_sync_completed_at: new Date().toISOString()
        })
        .in('id', stuckItems.map(i => i.id));
    }

    // ✅ CHECK EXISTENCE - Prevent crash if order was deleted
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, supplier_name')
      .eq('id', purchase_order_id)
      .maybeSingle();

    if (!order) {
      console.error(`❌ Order not found: ${purchase_order_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Đơn hàng không tồn tại hoặc đã bị xóa' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch items with status filter (pending or failed only)
    // Skip Type 1 items (already have tpos_product_id)
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', purchase_order_id)
      .in('tpos_sync_status', ['pending', 'failed'])
      .is('tpos_product_id', null)
      .order('position');

    if (itemsError) {
      console.error('❌ Error fetching items:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) {
      console.log('✅ No items to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Không có sản phẩm nào cần xử lý',
          total: 0,
          succeeded: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Processing ${items.length} items for order ${purchase_order_id}`);

    // Step 1: Group items by (product_code + selected_attribute_value_ids)
    const groups = new Map<string, typeof items>();

    for (const item of items) {
      const sortedIds = (item.selected_attribute_value_ids || []).sort().join(',');
      const groupKey = `${item.product_code}|${sortedIds}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    }

    console.log(`📦 Grouped ${items.length} items into ${groups.size} unique products`);

    // Step 2: Process groups in parallel
    // ✅ OPTIMIZATION #5: Increased concurrent requests for better throughput
    // OLD: MAX_CONCURRENT = 8 → 30 items = ~4 batches × 3s = 12s
    // NEW: MAX_CONCURRENT = 12 → 30 items = ~3 batches × 3s = 9s (25% faster)
    // Risk mitigation: Retry logic with exponential backoff handles TPOS rate limits
    // Note: Can increase to 16 if no rate limit issues observed
    const MAX_CONCURRENT = 12;
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: string; error: string }> = [];

    // Helper function: Process one group with retry
    async function processGroupWithRetry(
      groupKey: string, 
      groupItems: typeof items,
      maxRetries = 2
    ): Promise<void> {
      if (!groupItems || groupItems.length === 0) return;
      
      const primaryItem = groupItems[0];
      console.log(`\n🔄 Processing group: ${groupKey} (${groupItems.length} items)`);

      // 🔒 LOCK CHECK
      if (primaryItem.tpos_sync_status === 'processing') {
        console.log(`⚠️ Group ${groupKey} is already being processed, skipping...`);
        return;
      }

      // Mark as processing (optimistic lock)
      const { error: updateError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'processing',
          tpos_sync_started_at: new Date().toISOString()
        })
        .in('id', groupItems.map(i => i.id))
        .neq('tpos_sync_status', 'processing');

      if (updateError) {
        console.error(`❌ Failed to lock group ${groupKey}:`, updateError);
        return;
      }

      // Retry logic for TPOS API call
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { data: tposResult, error: tposError } = await supabase.functions.invoke(
            'create-tpos-variants-from-order',
            {
              body: {
                baseProductCode: primaryItem.product_code.trim().toUpperCase(),
                productName: primaryItem.product_name.trim().toUpperCase(),
                purchasePrice: Number(primaryItem.purchase_price || 0) / 1000,
                sellingPrice: Number(primaryItem.selling_price || 0) / 1000,
                selectedAttributeValueIds: primaryItem.selected_attribute_value_ids || [],
                productImages: Array.isArray(primaryItem.product_images)
                  ? primaryItem.product_images
                  : (primaryItem.product_images ? [primaryItem.product_images] : []),
                supplierName: order?.supplier_name?.trim().toUpperCase() || 'UNKNOWN',
                imageCache: imageCache // ✅ NEW - Forward cache
              }
            }
          );

          // ✅ IMPROVED ERROR HANDLING - Extract actual error from response body
          if (tposError) {
            // Try to get detailed error from response body if available
            const detailedError = tposResult?.error || tposError.message || 'Edge Function failed';
            console.error(`❌ TPOS Edge Function error for ${groupKey}:`, {
              error: tposError,
              result: tposResult,
              detailedError
            });
            throw new Error(`TPOS API error: ${detailedError}`);
          }

          if (!tposResult?.success) {
            const errorDetail = tposResult?.error || 'Unknown error';
            console.error(`❌ TPOS creation failed for ${groupKey}:`, errorDetail);
            throw new Error(`TPOS creation failed: ${errorDetail}`);
          }

          // ✅ TPOS sync success for this group
          successCount += groupItems.length;
          console.log(`✅ Group success: ${groupKey} (${groupItems.length} items)`);
          return; // Exit retry loop

        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';

          // Check if it's rate limit error (429)
          if (errorMessage.includes('429') && attempt < maxRetries) {
            console.warn(`⚠️ Rate limit hit for ${groupKey}, retrying in ${2000 * attempt}ms...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            continue;
          }

          // ⚠️ Record error for this group
          if (attempt === maxRetries) {
            failedCount += groupItems.length;
            groupItems.forEach(item => {
              failedItems.push({ id: item.id, error: errorMessage });
            });
            console.error(`❌ Group failed after ${maxRetries} attempts: ${groupKey}`, errorMessage);
          } else {
            // Log retry attempt
            console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${groupKey}: ${errorMessage}`);
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
    }

    // Convert Map to Array
    const groupArray = Array.from(groups.entries());
    console.log(`\n📦 Processing ${groupArray.length} product groups in batches of ${MAX_CONCURRENT}...`);

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < groupArray.length; i += MAX_CONCURRENT) {
      const batch = groupArray.slice(i, i + MAX_CONCURRENT);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(groupArray.length / MAX_CONCURRENT)}`);
      
      await Promise.allSettled(
        batch.map(([key, items]) => processGroupWithRetry(key, items))
      );
    }

    console.log(`\n✅ All groups processed: ${successCount} succeeded, ${failedCount} failed`);

    // Return summary
    const summary = {
      success: true,
      total: items.length,
      succeeded: successCount,
      failed: failedCount,
      errors: failedItems
    };

    console.log(`\n✅ TPOS sync complete:`, summary);

    // ✅ FINAL STATUS UPDATE: Set status = 'success' or 'failed' after TPOS processing
    console.log(`\n📝 Updating final status...`);
    
    // Step 3: Update failed items with individual errors
    if (failedItems.length > 0) {
      console.log(`❌ Updating ${failedItems.length} failed items with individual errors`);
      
      for (const failedItem of failedItems) {
        await supabase
          .from('purchase_order_items')
          .update({ 
            tpos_sync_status: 'failed',
            tpos_sync_completed_at: new Date().toISOString(),
            tpos_sync_error: failedItem.error
          })
          .eq('id', failedItem.id)
          .eq('tpos_sync_status', 'processing'); // Safety check
      }
      
      console.log(`✅ Updated ${failedItems.length} failed items`);
    }
    
    // Set 'success' for items that completed TPOS sync successfully
    if (successCount > 0) {
      const successItemIds = items
        .filter(item => !failedItems.some(f => f.id === item.id))
        .map(i => i.id);
      
      await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'success',
          tpos_sync_completed_at: new Date().toISOString(),
          tpos_sync_error: null
        })
        .in('id', successItemIds)
        .eq('tpos_sync_status', 'processing');
      
      console.log(`✅ Set ${successItemIds.length} items to 'success'`);
    }
    
    console.log(`✅ Final status update complete`);

    // ✅ Return TPOS sync summary only (no matching)
    return new Response(
      JSON.stringify({
        success: true,
        tpos_sync: summary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
