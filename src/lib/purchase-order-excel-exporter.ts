import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { searchTPOSProduct } from "./tpos-api";
import { convertVietnameseToUpperCase } from "./utils";
import { toast } from "@/hooks/use-toast";

interface PurchaseOrderItem {
  id?: string;
  quantity: number;
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  tpos_product_id?: number | null;
}

interface PurchaseOrder {
  id: string;
  supplier_name: string | null;
  items?: PurchaseOrderItem[];
}

/**
 * Simple variant matching (case-insensitive, remove accents)
 */
const variantsMatch = (variant1: string | null, variant2: string | null): boolean => {
  if (!variant1 || !variant2) return false;
  
  const normalize = (str: string) => 
    convertVietnameseToUpperCase(str.trim())
      .replace(/\s+/g, ' '); // Normalize spaces
  
  const v1 = normalize(variant1);
  const v2 = normalize(variant2);
  
  return v1 === v2;
};

/**
 * Format date as DD-MM
 */
const formatDateDDMM = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}`;
};

/**
 * Export purchase order to Excel with 3-step fallback matching
 */
export const exportPurchaseOrderToExcel = async (order: PurchaseOrder) => {
  const allItems = order.items || [];
  
  if (allItems.length === 0) {
    throw new Error("Đơn hàng không có sản phẩm nào");
  }

  const excelRows: Array<{
    "Mã sản phẩm (*)": string;
    "Số lượng (*)": number;
    "Đơn giá": number;
    "Chiết khấu (%)": number;
  }> = [];

  let skippedCount = 0;
  const skippedItems: string[] = [];

  for (const item of allItems) {
    // CASE 1: Đã upload TPOS
    if (item.tpos_product_id != null) {
      excelRows.push({
        "Mã sản phẩm (*)": item.product_code,
        "Số lượng (*)": item.quantity,
        "Đơn giá": item.purchase_price,
        "Chiết khấu (%)": 0
      });
      continue;
    }

    // CASE 2: Chưa upload + Không có biến thể
    if (!item.variant || item.variant.trim() === '') {
      excelRows.push({
        "Mã sản phẩm (*)": item.product_code,
        "Số lượng (*)": item.quantity,
        "Đơn giá": item.purchase_price,
        "Chiết khấu (%)": 0
      });
      continue;
    }

    // CASE 3: Chưa upload + Có biến thể → Matching với 3-step fallback
    const { data: candidates, error: candidatesError } = await supabase
      .from('products')
      .select('product_code, product_name, variant')
      .eq('base_product_code', item.product_code)
      .not('variant', 'is', null)
      .neq('variant', '');

    if (candidatesError) {
      console.error(`Error fetching candidates for ${item.product_code}:`, candidatesError);
      skippedCount++;
      skippedItems.push(`${item.product_code} (${item.variant}) - Lỗi query`);
      continue;
    }

    // Try to match variant
    const matchedProduct = candidates?.find(p => 
      variantsMatch(p.variant, item.variant)
    );

    if (matchedProduct) {
      // ✅ SUCCESS: Found variant match
      excelRows.push({
        "Mã sản phẩm (*)": matchedProduct.product_code,
        "Số lượng (*)": item.quantity,
        "Đơn giá": item.purchase_price,
        "Chiết khấu (%)": 0
      });
      continue;
    }

    // ❌ No variant match → FALLBACK STEP 1: Tìm exact product_code trong kho
    console.log(`⚠️ No variant match for ${item.product_code} (${item.variant}), trying exact match...`);

    const { data: exactMatch, error: exactError } = await supabase
      .from('products')
      .select('product_code')
      .eq('product_code', item.product_code)
      .maybeSingle();

    if (exactError) {
      console.error(`Error checking exact match for ${item.product_code}:`, exactError);
      skippedCount++;
      skippedItems.push(`${item.product_code} (${item.variant}) - Lỗi query exact match`);
      continue;
    }

    if (exactMatch) {
      // ✅ SUCCESS: Found exact product_code in warehouse
      console.log(`✅ Found exact match in warehouse: ${item.product_code}`);
      excelRows.push({
        "Mã sản phẩm (*)": item.product_code,
        "Số lượng (*)": item.quantity,
        "Đơn giá": item.purchase_price,
        "Chiết khấu (%)": 0
      });
      continue;
    }

    // ❌ Not in warehouse → FALLBACK STEP 2: Tìm trên TPOS
    console.log(`⚠️ Not found in warehouse, checking TPOS for ${item.product_code}...`);

    try {
      const tposProduct = await searchTPOSProduct(item.product_code);
      
      if (tposProduct) {
        // ✅ SUCCESS: Found on TPOS
        console.log(`✅ Found on TPOS: ${item.product_code} (ID: ${tposProduct.Id})`);
        excelRows.push({
          "Mã sản phẩm (*)": item.product_code,
          "Số lượng (*)": item.quantity,
          "Đơn giá": item.purchase_price,
          "Chiết khấu (%)": 0
        });
        continue;
      }
    } catch (tposError) {
      console.error(`Error searching TPOS for ${item.product_code}:`, tposError);
      // Fallthrough to final error
    }

    // ❌ FINAL FALLBACK: Not found anywhere → SKIP với error đỏ
    skippedCount++;
    const availableVariants = candidates
      ?.map(c => c.variant)
      .join(', ') || 'Không có';
    skippedItems.push(
      `❌ Upload TPOS Lỗi: ${item.product_code} - ${item.product_name} (Variant: ${item.variant}, Có trong kho: [${availableVariants}])`
    );
  }

  // Validate có items để xuất
  if (excelRows.length === 0) {
    throw new Error("Không có sản phẩm nào phù hợp để xuất");
  }

  // Create Excel file
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mua Hàng");
  
  const fileName = `MuaHang_${order.supplier_name}_${formatDateDDMM()}.xlsx`;
  XLSX.writeFile(wb, fileName);

  // Show toast with results
  let description = `Đã xuất ${excelRows.length} sản phẩm`;
  if (skippedCount > 0) {
    description += `\n\n❌ Bỏ qua ${skippedCount} sản phẩm:\n`;
    description += skippedItems.slice(0, 3).join('\n'); // Show first 3 errors
    if (skippedCount > 3) {
      description += `\n... và ${skippedCount - 3} sản phẩm khác`;
    }
    console.error('❌ UPLOAD TPOS LỖI - Chi tiết:', skippedItems);
  }

  toast({
    title: skippedCount > 0 ? "⚠️ Xuất Excel với lỗi!" : "✅ Xuất Excel thành công!",
    description: description,
    variant: skippedCount > 0 ? "destructive" : "default",
  });

  return { fileName, exportedCount: excelRows.length, skippedCount };
};
