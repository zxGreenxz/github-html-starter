import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  purchase_order_id: string;
}

/**
 * Helper function: Set-based variant matching (order-independent)
 * 
 * Examples:
 *   variantsMatch("29, Hồng Đật", "Hồng Đật, 29") → true ✅
 *   variantsMatch("29, Hồng Đật", "29, hồng đật") → true ✅ (case-insensitive)
 *   variantsMatch("29, Hồng Đật", "29, Tím Đậm") → false ❌
 */
function variantsMatch(variant1: string | null, variant2: string | null): boolean {
  if (!variant1 || !variant2) return false;
  
  // Normalize: split by comma, trim, lowercase, filter empty, then sort
  const normalize = (v: string) => 
    v.split(',')
     .map(s => s.trim().toLowerCase())
     .filter(s => s.length > 0)
     .sort();

  const arr1 = normalize(variant1);
  const arr2 = normalize(variant2);

  // Check same length
  if (arr1.length !== arr2.length) return false;

  // Check all values match (after sort)
  return arr1.every((val, idx) => val === arr2[idx]);
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
    
    console.log(`🔍 [Matching] Starting product matching for order: ${purchase_order_id}`);

    // Fetch ONLY Type 2 items (pending status with variants)
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('id, product_code, product_name, variant, tpos_sync_error, tpos_sync_status')
      .eq('purchase_order_id', purchase_order_id)
      .eq('tpos_sync_status', 'pending')
      .not('variant', 'is', null)
      .neq('variant', '')
      .order('position');

    if (itemsError) {
      console.error('❌ Error fetching items:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) {
      console.log('✅ No items with variants to match');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Không có sản phẩm nào có variant cần match',
          total: 0,
          matched: 0,
          unmatched: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Matching ${items.length} items with variants`);

    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedItems: Array<{ product_code: string; variant: string; error: string; available_variants?: string }> = [];

    for (const item of items) {
      console.log(`\n🔍 Matching item: ${item.product_code} - variant: "${item.variant}"`);

      // Step 1: Fetch ALL child products with same base_product_code
      const { data: candidates, error: candidatesError } = await supabase
        .from('products')
        .select('product_code, product_name, variant')
        .eq('base_product_code', item.product_code)
        .not('variant', 'is', null)
        .neq('variant', '');

      if (candidatesError) {
        console.error(`❌ Error fetching candidates for ${item.product_code}:`, candidatesError);
        continue;
      }

      console.log(`   Found ${candidates?.length || 0} candidate(s) with base_product_code="${item.product_code}"`);

      // Step 2: Filter in memory using variantsMatch()
      const matchedProduct = candidates?.find(p => {
        const isMatch = variantsMatch(p.variant, item.variant);
        if (isMatch) {
          console.log(`   ✅ Match found: ${p.product_code} (variant: "${p.variant}")`);
        }
        return isMatch;
      });

      if (matchedProduct) {
        // Update purchase_order_item with matched product
        const { error: updateError } = await supabase
          .from('purchase_order_items')
          .update({
            product_code: matchedProduct.product_code,
            product_name: matchedProduct.product_name
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Error updating item ${item.product_code}:`, updateError);
          continue;
        }

        matchedCount++;
        console.log(`   ✅ Updated to: ${matchedProduct.product_code} - ${matchedProduct.product_name}`);

      } else {
        // No match found - detailed error with available variants
        const candidateVariants = candidates
          ?.map(c => c.variant || 'No variant')
          .filter(v => v !== 'No variant')
          .join(', ') || 'None';
        
        const errorMsg = candidateVariants === 'None'
          ? `❌ Không tìm thấy variant "${item.variant}" - Không có sản phẩm nào với base_product_code "${item.product_code}" trong kho`
          : `❌ Không tìm thấy variant "${item.variant}" - Variants có sẵn: [${candidateVariants}]`;
        
        const existingError = item.tpos_sync_error || '';
        const newError = existingError 
          ? `${existingError}\n${errorMsg}`
          : errorMsg;

        const { error: updateError } = await supabase
          .from('purchase_order_items')
          .update({
            tpos_sync_error: newError
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Error updating error for ${item.product_code}:`, updateError);
        }

        unmatchedCount++;
        unmatchedItems.push({ 
          product_code: item.product_code, 
          variant: item.variant,
          error: errorMsg,
          available_variants: candidateVariants
        });
        console.log(`   ❌ No match: ${errorMsg}`);
      }
    }

    // Return summary
    const summary = {
      success: true,
      total: items.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      unmatched_items: unmatchedItems
    };

    console.log(`\n✅ Matching complete:`, summary);

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
