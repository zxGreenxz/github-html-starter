import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVariant } from '@/lib/variant-utils';

/**
 * Extract all product codes from comment text
 * Pattern: N followed by numbers and optional letters (e.g., N55, N236L, N217)
 * Handles special characters around codes: (N217), [N217], N217., N217,, etc.
 */
function extractProductCodes(text: string): string[] {
  const pattern = /N\d+[A-Z]*/gi;
  const matches = text.match(pattern);
  
  if (!matches) return [];
  
  // Convert to uppercase, remove duplicates, and normalize
  const codes = matches.map(m => m.toUpperCase().trim());
  return [...new Set(codes)]; // Remove duplicates
}

interface PendingLiveOrder {
  id: string;
  facebook_comment_id: string;
  comment_text: string | null;
  customer_name: string | null;
  session_index: string | null;
  created_at: string;
  processed: boolean;
  error_message: string | null;
}

interface LiveProduct {
  id: string;
  product_code: string;
  variant: string | null;
  live_session_id: string;
  live_phase_id: string | null;
  sold_quantity: number;
  prepared_quantity: number;
}

/**
 * Hook to automatically process pending Facebook comment orders
 * Matches product codes from comments with live_products and creates live_orders
 * Runs on mount and every 30 seconds while on /live-products page
 */
export function useProcessPendingOrders() {
  const queryClient = useQueryClient();

  const processPendingOrders = useCallback(async () => {
    console.log('[useProcessPendingOrders] 🔄 Starting to process pending orders...');

    try {
      // Get phase_date from today
      const today = new Date();
      const phase_date = today.toISOString().split('T')[0];

      // 1. Fetch pending_live_orders that haven't been processed yet
      // Note: Using 'as any' to bypass TypeScript until migration is run
      const { data: pendingOrders, error: fetchError } = await supabase
        .from('pending_live_orders' as any)
        .select('*')
        .eq('processed', false)
        .gte('created_at', `${phase_date}T00:00:00`)
        .lt('created_at', `${phase_date}T23:59:59`)
        .order('created_at', { ascending: true }) as { data: PendingLiveOrder[] | null; error: any };

      if (fetchError) {
        console.error('[useProcessPendingOrders] ❌ Error fetching:', fetchError);
        return;
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        console.log('[useProcessPendingOrders] ✓ No pending orders to process');
        return;
      }

      console.log(`[useProcessPendingOrders] 📦 Found ${pendingOrders.length} pending orders`);

      // 2. Fetch existing live_orders to check which products are already processed
      const { data: existingOrders } = await supabase
        .from('live_orders')
        .select('facebook_comment_id, live_product_id')
        .gte('created_at', `${phase_date}T00:00:00`)
        .lt('created_at', `${phase_date}T23:59:59`);

      console.log(`[useProcessPendingOrders] 📊 Found ${existingOrders?.length || 0} existing live orders`);

      // 3. Fetch all live_products with variants (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: liveSessions } = await supabase
        .from('live_sessions')
        .select('id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!liveSessions || liveSessions.length === 0) {
        console.log('[useProcessPendingOrders] ⚠️ No recent live sessions found');
        return;
      }

      const sessionIds = liveSessions.map(s => s.id);

      const { data: rawLiveProducts, error: productsError } = await supabase
        .from('live_products')
        .select('id, product_code, variant, live_session_id, live_phase_id, sold_quantity, prepared_quantity')
        .in('live_session_id', sessionIds)
        .not('variant', 'is', null);
      
      const liveProducts = rawLiveProducts as LiveProduct[] | null;

      if (productsError) {
        console.error('[useProcessPendingOrders] ❌ Error fetching live_products:', productsError);
        return;
      }

      console.log(`[useProcessPendingOrders] 📊 Found ${liveProducts?.length || 0} live products with variants`);

      // 🐛 DEBUG: Log all variants and their split results
      console.log('\n🐛 ===== DEBUG: ALL VARIANTS SPLIT ANALYSIS =====');
      liveProducts?.forEach((product, index) => {
        const splitResult = product.variant?.split(' - ') || [];
        console.log(`${index + 1}. Product: ${product.product_code}`);
        console.log(`   Raw variant: "${product.variant}"`);
        console.log(`   split(" - "):`, splitResult);
        console.log(`   [0]: "${splitResult[0]}"`);
        console.log(`   [1]: "${splitResult[1] || 'undefined'}"`);
        console.log(`   parseVariant().code: "${parseVariant(product.variant).code}"`);
        console.log('---');
      });
      console.log('🐛 ===== END DEBUG =====\n');

      // 4. Process each pending order
      let processedCount = 0;
      let errorCount = 0;

      for (const pending of pendingOrders) {
        console.log(`\n[Processing] Pending order ${pending.id}:`);
        console.log(`  Comment: ${pending.comment_text}`);
        console.log(`  Session index: ${pending.session_index}`);

        // Extract product codes from comment
        const productCodes = extractProductCodes(pending.comment_text || '');
        console.log(`  Product codes: [${productCodes.join(', ')}]`);

        if (productCodes.length === 0) {
          console.log(`  ⚠️ No product codes found in comment`);
          
          // Mark as processed with error
          await supabase
            .from('pending_live_orders' as any)
            .update({ 
              processed: true, 
              processed_at: new Date().toISOString(),
              error_message: 'No product codes found in comment'
            })
            .eq('id', pending.id);
          
          continue;
        }

        // Check which products from this comment have already been processed
        const processedProductIds = new Set(
          existingOrders
            ?.filter(o => o.facebook_comment_id === pending.facebook_comment_id)
            .map(o => o.live_product_id) || []
        );
        console.log(`  Already processed product IDs: [${Array.from(processedProductIds).join(', ')}]`);

        let matchedProduct = null;
        let matchedCode = '';

        // Try to match each product code
        for (const productCode of productCodes) {
          console.log(`  🔍 Looking for: "${productCode}"`);

          matchedProduct = liveProducts?.find(product => {
            // Handle old data without variant code
            if (!product.variant) {
              console.log(`    Skipping "${product.product_code}" - no variant (old data)`);
              return false;
            }

            // 🐛 DEBUG: Raw split result
            const splitResult = product.variant.split(' - ');
            console.log(`    🐛 [DEBUG] variant="${product.variant}"`);
            console.log(`    🐛 [DEBUG] split(" - ")=`, splitResult);
            console.log(`    🐛 [DEBUG] split(" - ")[0]="${splitResult[0]}"`);
            console.log(`    🐛 [DEBUG] split(" - ")[1]="${splitResult[1]}"`);

            const variantCode = parseVariant(product.variant).code;
            
            // Skip if variant code is empty (old format: variant name only)
            if (!variantCode || variantCode.trim() === '') {
              console.log(`    Skipping "${product.variant}" - no code part (old format)`);
              return false;
            }

            const normalized = variantCode.toUpperCase().trim();
            const isMatch = normalized === productCode;

            console.log(`    Checking: "${product.variant}" → code="${variantCode}" → normalized="${normalized}" → ${isMatch ? '✅ MATCH' : '✗'}`);

            return isMatch;
          });

          if (matchedProduct) {
            matchedCode = productCode;
            console.log(`  ✅ Found match! Product ID: ${matchedProduct.id}`);
            
            // Check if this product has already been processed for this comment
            if (processedProductIds.has(matchedProduct.id)) {
              console.log(`  ⚠️ Product ${matchedProduct.id} already processed for this comment, skipping...`);
              continue;
            }
            
            break;
          }
        }

        if (matchedProduct) {
          // Check oversell
          const isOversell = (matchedProduct.sold_quantity || 0) >= (matchedProduct.prepared_quantity || 0);

          // Create live_order
          const { data: newOrder, error: insertError } = await supabase
            .from('live_orders')
            .insert({
              facebook_comment_id: pending.facebook_comment_id,
              session_index: pending.session_index,
              live_product_id: matchedProduct.id,
              live_session_id: matchedProduct.live_session_id,
              live_phase_id: matchedProduct.live_phase_id,
              comment_text: pending.comment_text,
              customer_name: pending.customer_name,
              facebook_user_id: null,
              is_oversell: isOversell,
            } as any)
            .select()
            .single();

          if (insertError) {
            console.error(`  ❌ Failed to create live_order:`, insertError);
            errorCount++;
          } else {
            console.log(`  ✅ Created live_order successfully (ID: ${newOrder.id})`);

            // Update sold_quantity
            const newSoldQuantity = (matchedProduct.sold_quantity || 0) + 1;
            await supabase
              .from('live_products')
              .update({ sold_quantity: newSoldQuantity })
              .eq('id', matchedProduct.id);

            processedCount++;
          }
        } else {
          console.log(`  ⚠️ No matching product found for codes: [${productCodes.join(', ')}]`);
          errorCount++;
        }

        // Mark pending order as processed
        await supabase
          .from('pending_live_orders' as any)
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString(),
            error_message: matchedProduct ? null : `No matching products found for codes: ${productCodes.join(', ')}`
          })
          .eq('id', pending.id);
      }

      console.log(`\n[useProcessPendingOrders] ✅ Processing complete:`);
      console.log(`  Processed: ${processedCount}`);
      console.log(`  Errors: ${errorCount}`);

      if (processedCount > 0) {
        toast.success(`Đã xử lý ${processedCount} đơn hàng từ Facebook Comments`);
        
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['live-products'] });
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      }

      if (errorCount > 0) {
        toast.warning(`${errorCount} đơn hàng không thể xử lý (không tìm thấy sản phẩm)`);
      }

    } catch (error) {
      console.error('[useProcessPendingOrders] ❌ Unexpected error:', error);
    }
  }, [queryClient]);

  // Auto-process on mount and every 30 seconds
  useEffect(() => {
    processPendingOrders();

    const interval = setInterval(() => {
      processPendingOrders();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [processPendingOrders]);

  return { processPendingOrders };
}
