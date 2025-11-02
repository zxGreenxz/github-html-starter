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

    console.log(`\n✅ TPOS sync complete:`, summary);

    // ✅ FINAL STATUS UPDATE: Set status = 'success' or 'failed' after TPOS processing
    console.log(`\n📝 Updating final status...`);
    
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
