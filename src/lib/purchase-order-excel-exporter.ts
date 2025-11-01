import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Helper: Compare variants (normalize and compare)
function normalizeVariant(v: string | null | undefined): string {
  if (!v) return '';
  return v.trim().toUpperCase().replace(/\s+/g, '');
}

function variantsMatch(v1: string | null | undefined, v2: string | null | undefined): boolean {
  const n1 = normalizeVariant(v1);
  const n2 = normalizeVariant(v2);
  return n1 === n2 && n1 !== '';
}

// Helper: Format date as DDMM
function formatDateDDMM(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

// Helper: Search TPOS product by code
async function searchTPOSProduct(productCode: string): Promise<any> {
  const { data: credentials } = await supabase
    .from('tpos_credentials')
    .select('*')
    .eq('token_type', 'tpos')
    .maybeSingle();

  if (!credentials?.bearer_token) {
    throw new Error('Missing TPOS credentials');
  }

  const response = await fetch(
    `https://api.tpos.vn/products?code=${encodeURIComponent(productCode)}`,
    {
      headers: {
        'Authorization': `Bearer ${credentials.bearer_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) return null;
  
  const data = await response.json();
  return data?.length > 0 ? data[0] : null;
}

export async function exportPurchaseOrderToExcel(order: any) {
  try {
    // Fetch all items for this order
    const { data: allItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', order.id)
      .order('position');

    if (itemsError) throw itemsError;
    if (!allItems || allItems.length === 0) {
      throw new Error('Không có sản phẩm nào trong đơn hàng');
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
      }

      // ❌ FINAL FALLBACK: Not found anywhere → SKIP với error
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
      throw new Error('Không có sản phẩm nào phù hợp để xuất');
    }

    // Create Excel file
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mua Hàng");
    
    const fileName = `MuaHang_${order.supplier_name}_${formatDateDDMM()}.xlsx`;
    XLSX.writeFile(wb, fileName);

    // Show result
    let description = `Đã xuất ${excelRows.length} sản phẩm`;
    if (skippedCount > 0) {
      description += `\n\n❌ Bỏ qua ${skippedCount} sản phẩm:\n`;
      description += skippedItems.slice(0, 3).join('\n');
      if (skippedCount > 3) {
        description += `\n... và ${skippedCount - 3} sản phẩm khác`;
      }
      console.error('❌ UPLOAD TPOS LỖI - Chi tiết:', skippedItems);
    }

    toast({
      title: skippedCount > 0 ? "⚠️ Xuất Excel với lỗi!" : "Xuất Excel thành công!",
      description: description,
      variant: skippedCount > 0 ? "destructive" : "default",
    });

    return { success: true, skippedCount };
  } catch (error: any) {
    console.error("Error exporting purchase Excel:", error);
    toast({
      title: "Lỗi khi xuất Excel!",
      description: error.message || "Vui lòng thử lại",
      variant: "destructive",
    });
    throw error;
  }
}
