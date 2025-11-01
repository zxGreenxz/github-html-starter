import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  purchase_order_id: string;
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
    const { purchase_order_id }: RequestBody = await req.json();
    
    console.log(`🔄 [Background Process] Starting for order: ${purchase_order_id}`);

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

    // Fetch items with status filter (pending, pending_no_match, or failed only)
    // Skip Type 1 items (already have tpos_product_id)
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', purchase_order_id)
      .in('tpos_sync_status', ['pending', 'pending_no_match', 'failed'])
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

    // Step 2: Process each group (upload TPOS once per group)
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: string; error: string }> = [];

    for (const [groupKey, groupItems] of groups.entries()) {
      const primaryItem = groupItems[0]; // Use first item as representative
      console.log(`\n🔄 Processing group: ${groupKey} (${groupItems.length} items)`);

      // 🔒 LOCK CHECK: Skip if already processing (check primary item)
      if (primaryItem.tpos_sync_status === 'processing') {
        console.log(`⚠️ Group ${groupKey} is already being processed, skipping...`);
        continue;
      }

      // Mark ALL items in group as 'processing' (atomic operation with race condition protection)
      const { error: updateError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'processing',
          tpos_sync_started_at: new Date().toISOString()
        })
        .in('id', groupItems.map(i => i.id))
        .neq('tpos_sync_status', 'processing'); // ✅ Prevent race condition

      if (updateError) {
        console.error(`❌ Failed to lock group ${groupKey}:`, updateError);
        continue; // Skip this group if can't lock
      }

      try {
        // Call TPOS creation ONCE for this group
        const { data: tposResult, error: tposError } = await supabase.functions.invoke(
          'create-tpos-variants-from-order',
          {
            body: {
              baseProductCode: primaryItem.product_code.trim().toUpperCase(),
              productName: primaryItem.product_name.trim().toUpperCase(),
              purchasePrice: Number(primaryItem.purchase_price || 0) / 1000, // Convert back from storage format
              sellingPrice: Number(primaryItem.selling_price || 0) / 1000,
              selectedAttributeValueIds: primaryItem.selected_attribute_value_ids || [],
              productImages: Array.isArray(primaryItem.product_images) 
                ? primaryItem.product_images 
                : (primaryItem.product_images ? [primaryItem.product_images] : []),
              supplierName: order.supplier_name?.trim().toUpperCase() || 'UNKNOWN'
            }
          }
        );

        if (tposError) {
          throw new Error(`TPOS API error: ${tposError.message}`);
        }

        if (!tposResult?.success) {
          throw new Error(`TPOS creation failed: ${tposResult?.error || 'Unknown error'}`);
        }

        // ✅ TPOS sync success, but keep status = 'processing' until matching completes
        successCount += groupItems.length;
        console.log(`✅ Group TPOS sync success: ${groupKey} (${groupItems.length} items) - Status still 'processing'`);

      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        
        // ⚠️ Record error but DON'T update status yet - will update after retry matching completes
        failedCount += groupItems.length;
        groupItems.forEach(item => {
          failedItems.push({ id: item.id, error: errorMessage });
        });
        
        console.error(`❌ Group failed: ${groupKey}`, errorMessage);
        // Status remains 'processing', will be updated after retry matching
      }
    }

    // Return summary
    const summary = {
      success: true,
      total: items.length,
      succeeded: successCount,
      failed: failedCount,
      errors: failedItems
    };

    console.log(`\n✅ Processing complete:`, summary);

    // 🎯 Step 1.5: Mark Type 3 items (pending_no_match) as success immediately
    const { data: type3Items } = await supabase
      .from('purchase_order_items')
      .select('id')
      .eq('purchase_order_id', purchase_order_id)
      .eq('tpos_sync_status', 'pending_no_match');

    if (type3Items && type3Items.length > 0) {
      const { error: type3UpdateError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'success',
          tpos_sync_completed_at: new Date().toISOString()
        })
        .in('id', type3Items.map(i => i.id));
      
      if (type3UpdateError) {
        console.error('⚠️ Error updating Type 3 items:', type3UpdateError);
      } else {
        console.log(`✅ Marked ${type3Items.length} simple products (no matching needed) as 'success'`);
      }
    }

    // 🎯 Step 2: Match purchase order items with warehouse products (Type 2 only)
    console.log(`\n🔍 Starting product matching for Type 2 items...`);
    
    let matchResult = null;
    let matchAttempts = 0;
    const MAX_MATCH_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 1000;

    while (matchAttempts < MAX_MATCH_ATTEMPTS && !matchResult) {
      matchAttempts++;
      console.log(`🔄 Match attempt ${matchAttempts}/${MAX_MATCH_ATTEMPTS}`);
      
      try {
        const { data, error: matchError } = await supabase.functions.invoke(
          'match-purchase-order-products',
          { body: { purchase_order_id } }
        );

        if (matchError) {
          console.error(`❌ Match attempt ${matchAttempts} failed:`, matchError);
          
          // Retry if not last attempt
          if (matchAttempts < MAX_MATCH_ATTEMPTS) {
            console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          } else {
            console.error('❌ All match attempts exhausted');
            matchResult = {
              success: false,
              error: `Matching failed after ${MAX_MATCH_ATTEMPTS} attempts: ${matchError.message}`,
              matched: 0,
              unmatched: 0
            };
          }
        } else {
          // Success!
          matchResult = data;
          console.log(`✅ Matching succeeded on attempt ${matchAttempts}:`, matchResult);
          break;
        }
      } catch (matchErr: any) {
        console.error(`❌ Match attempt ${matchAttempts} threw exception:`, matchErr);
        
        if (matchAttempts < MAX_MATCH_ATTEMPTS) {
          console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          matchResult = {
            success: false,
            error: `Matching failed after ${MAX_MATCH_ATTEMPTS} attempts: ${matchErr.message}`,
            matched: 0,
            unmatched: 0
          };
        }
      }
    }

    // ✅ FINAL STATUS UPDATE: Set status = 'success' ONLY after matching completes
    console.log(`\n📝 Updating final status after matching completes...`);
    
    if (failedItems.length > 0) {
      const failedItemIds = failedItems.map(f => f.id);
      
      // Set failed status for items that had TPOS sync errors
      await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'failed',
          tpos_sync_completed_at: new Date().toISOString(),
          tpos_sync_error: failedItems[0].error
        })
        .in('id', failedItemIds)
        .eq('tpos_sync_status', 'processing');
      
      console.log(`❌ Set ${failedItemIds.length} items to 'failed' status`);
    }
    
    // 🎯 KEY CHANGE: Set 'success' for items that completed TPOS sync successfully
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
      
      console.log(`✅ Matching complete! Set ${successItemIds.length} items to 'success'`);
    }
    
    if (!matchResult?.success) {
      console.warn(`⚠️ Matching had issues, but status updated to 'success' for successful TPOS items`);
    }
    
    console.log(`✅ Final status update complete`);

    // ✅ Return BOTH tpos sync summary AND matching result
    return new Response(
      JSON.stringify({
        tpos_sync: summary,
        matching: matchResult
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
