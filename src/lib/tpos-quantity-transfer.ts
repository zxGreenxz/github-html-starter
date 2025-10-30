import { supabase } from "@/integrations/supabase/client";

/**
 * Thực hiện quy trình 3-step để cập nhật số lượng variants trên TPOS
 * @param productTmplId - ID của sản phẩm cha (ProductTemplate)
 * @param changedQtyMap - Map của {variantId: newQuantity}
 * @returns Promise<void>
 */
export async function transferQuantitiesThreeStep(
  productTmplId: number,
  changedQtyMap: Record<number, number>
): Promise<void> {
  console.log(`📦 [Transfer Service] Starting 3-step process for product ${productTmplId}`, changedQtyMap);

  try {
    // ===== STEP 1: GET PAYLOAD TEMPLATE =====
    console.log('📦 [Step 1/3] Getting payload template...');
    
    const { data: templateData, error: step1Error } = await supabase.functions.invoke(
      'stock-change-get-template',
      {
        body: {
          model: { ProductTmplId: productTmplId }
        },
      }
    );

    if (step1Error) {
      console.error('❌ [Step 1/3] Error:', step1Error);
      throw new Error(`Step 1 failed: ${step1Error.message}`);
    }

    if (!templateData || !Array.isArray(templateData.value) || templateData.value.length === 0) {
      throw new Error('Không thể lấy mẫu payload từ TPOS. Vui lòng thử lại.');
    }

    console.log(`✅ [Step 1/3] Template fetched. Items: ${templateData.value.length}`);

    // ===== STEP 2: MODIFY TEMPLATE & POST CHANGED QUANTITIES =====
    console.log('📝 [Step 2/3] Modifying template and posting changes...');

    // Modify template theo logic từ file mẫu
    const modifiedTemplate = templateData.value.map((item: any) => {
      const variantId = item.Product.Id;
      const newItem = { ...item };

      // Set LocationId to 12
      newItem.LocationId = 12;

      // Set NewQuantity nếu variant này có trong changedQtyMap
      if (changedQtyMap.hasOwnProperty(variantId)) {
        newItem.NewQuantity = changedQtyMap[variantId];
        console.log(`  → Variant ${variantId}: ${item.Product?.QtyAvailable || 0} → ${changedQtyMap[variantId]}`);
      }

      return newItem;
    });

    const { data: postData, error: step2Error } = await supabase.functions.invoke(
      'stock-change-post-qty',
      {
        body: {
          model: modifiedTemplate
        },
      }
    );

    if (step2Error) {
      console.error('❌ [Step 2/3] Error:', step2Error);
      throw new Error(`Step 2 failed: ${step2Error.message}`);
    }

    if (!postData || !Array.isArray(postData.value) || postData.value.length === 0) {
      throw new Error('Không thể đăng tải thay đổi số lượng lên TPOS. Vui lòng thử lại.');
    }

    console.log(`✅ [Step 2/3] Changes posted. Returned IDs: ${postData.value.length}`);

    // Extract IDs cho Step 3
    const idsToExecute = postData.value.map((item: any) => item.Id);

    // ===== STEP 3: EXECUTE CHANGE =====
    console.log('🚀 [Step 3/3] Executing stock change...');

    const { data: executeData, error: step3Error } = await supabase.functions.invoke(
      'stock-change-execute',
      {
        body: { ids: idsToExecute },
      }
    );

    if (step3Error) {
      console.error('❌ [Step 3/3] Error:', step3Error);
      throw new Error(`Step 3 failed: ${step3Error.message}`);
    }

    console.log(`✅ [Step 3/3] Stock change executed successfully!`, executeData);
    console.log(`🎉 [Transfer Service] 3-step process completed for product ${productTmplId}`);

  } catch (error) {
    console.error(`❌ [Transfer Service] Error in 3-step process:`, error);
    throw new Error(`Lỗi cập nhật số lượng: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
  }
}
