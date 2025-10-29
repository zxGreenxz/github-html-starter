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

    // Fetch items with status filter (pending or failed only)
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', purchase_order_id)
      .in('tpos_sync_status', ['pending', 'failed'])
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

    // Process items SEQUENTIALLY (as requested by user)
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: string; error: string }> = [];

    for (const [index, item] of items.entries()) {
      console.log(`\n🔄 Processing item ${index + 1}/${items.length}: ${item.product_code}`);

      // 🔒 LOCK CHECK: Skip if already processing
      if (item.tpos_sync_status === 'processing') {
        console.log(`⚠️ Item ${item.product_code} is already being processed, skipping...`);
        continue;
      }

      // Mark as processing (atomic operation - only if status unchanged)
      const { error: updateError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'processing',
          tpos_sync_started_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .eq('tpos_sync_status', item.tpos_sync_status); // ✅ Only update if status unchanged

      if (updateError) {
        console.error(`❌ Failed to lock item ${item.product_code}:`, updateError);
        continue; // Skip this item if can't lock
      }

      try {
        // Call TPOS creation edge function (same as frontend logic)
        const { data: tposResult, error: tposError } = await supabase.functions.invoke(
          'create-tpos-variants-from-order',
          {
            body: {
              baseProductCode: item.product_code.trim().toUpperCase(),
              productName: item.product_name.trim().toUpperCase(),
              purchasePrice: Number(item.purchase_price || 0) / 1000, // Convert back from storage format
              sellingPrice: Number(item.selling_price || 0) / 1000,
              selectedAttributeValueIds: item.selected_attribute_value_ids || [],
              productImages: Array.isArray(item.product_images) 
                ? item.product_images 
                : (item.product_images ? [item.product_images] : []),
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

        // Extract tpos_product_id if available
        const tposProductId = tposResult.tpos_product_id || null;

        // Mark as success
        await supabase
          .from('purchase_order_items')
          .update({ 
            tpos_sync_status: 'success',
            tpos_sync_completed_at: new Date().toISOString(),
            tpos_sync_error: null,
            tpos_product_id: tposProductId
          })
          .eq('id', item.id);

        successCount++;
        console.log(`✅ Success: ${item.product_code} (TPOS ID: ${tposProductId || 'N/A'})`);

      } catch (error: any) {
        // Mark as failed with error message
        const errorMessage = error.message || 'Unknown error';
        
        await supabase
          .from('purchase_order_items')
          .update({ 
            tpos_sync_status: 'failed',
            tpos_sync_completed_at: new Date().toISOString(),
            tpos_sync_error: errorMessage
          })
          .eq('id', item.id);

        failedCount++;
        failedItems.push({ id: item.id, error: errorMessage });
        console.error(`❌ Failed: ${item.product_code}`, errorMessage);

        // Continue processing other items (don't throw)
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

    // 🎯 Step 2: Match purchase order items with warehouse products
    console.log(`\n🔍 Starting product matching...`);
    try {
      const { data: matchResult, error: matchError } = await supabase.functions.invoke(
        'match-purchase-order-products',
        {
          body: { purchase_order_id }
        }
      );

      if (matchError) {
        console.error('❌ Error invoking match function:', matchError);
      } else {
        console.log('✅ Matching complete:', matchResult);
      }
    } catch (matchErr: any) {
      console.error('❌ Failed to invoke matching function:', matchErr);
      // Don't throw - matching is optional enhancement
    }

    return new Response(
      JSON.stringify(summary),
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
