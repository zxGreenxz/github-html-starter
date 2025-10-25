import { supabase } from "@/integrations/supabase/client";
import { getActiveTPOSToken, getTPOSHeaders } from "./tpos-config";

export interface UploadProductToTPOSParams {
  product_code: string;
  product_name: string;
  variant?: string | null;
  orders: Array<{
    id: string;
    session_index: number;
    quantity: number;
    note?: string | null;
  }>;
  sessionInfo: {
    start_date: string;
    end_date: string;
  };
  onProgress?: (step: number, message: string) => void;
}

export interface UploadProductResult {
  success: boolean;
  tposOrderId?: string;
  codeTPOSOrderId?: string;
  error?: string;
}

// Calculate representative session_index (mode - most frequent)
function getRepresentativeSessionIndex(sessionIndexes: number[]): number {
  const frequency = new Map<number, number>();
  sessionIndexes.forEach(idx => {
    frequency.set(idx, (frequency.get(idx) || 0) + 1);
  });
  
  let maxFreq = 0;
  let representative = sessionIndexes[0];
  
  frequency.forEach((freq, idx) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      representative = idx;
    }
  });
  
  return representative;
}

// Search for a product in TPOS
async function searchTPOSProduct(productCode: string, bearerToken: string) {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const url = `https://tomato.tpos.vn/odata/Product/ODataService.GetView?$filter=DefaultCode eq '${productCode}'&$top=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`Failed to search product ${productCode}: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(`Invalid response from TPOS (not JSON)`);
    }

    const data = await response.json();
    return data.value?.[0] || null;
  }, 'tpos');
}

// Fetch orders from TPOS by date range and session index
async function fetchTPOSOrders(
  startDate: string,
  endDate: string,
  sessionIndex: number,
  bearerToken: string
) {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const toDateOnly = (dateStr: string): string => dateStr.split('T')[0];
    
    const vnDateToUTCStart = (vnDate: string): string => {
      const date = new Date(vnDate + 'T00:00:00+07:00');
      return date.toISOString().replace('.000Z', 'Z');
    };
    
    const vnDateToUTCEnd = (vnDate: string): string => {
      const date = new Date(vnDate + 'T23:59:59+07:00');
      return date.toISOString().replace('.000Z', 'Z');
    };
    
    const startDateOnly = toDateOnly(startDate);
    const endDateOnly = toDateOnly(endDate);
    
    const startDateTime = vnDateToUTCStart(startDateOnly);
    const endDateTime = vnDateToUTCEnd(endDateOnly);
    
    const filterQuery = `DateCreated ge ${startDateTime} and DateCreated le ${endDateTime} and SessionIndex eq ${sessionIndex}`;
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$filter=${encodeURIComponent(filterQuery)}&$orderby=DateCreated desc&$top=50`;
    
    console.log('📡 [PRODUCT UPLOAD] TPOS API Request:', {
      url,
      filterQuery,
      sessionIndex,
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TPOS orders: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(`Invalid response from TPOS (not JSON)`);
    }

    const data = await response.json();
    
    console.log('✅ [PRODUCT UPLOAD] TPOS API Response:', {
      ordersCount: data.value?.length || 0,
    });
    
    return data.value || [];
  }, 'tpos');
}

// Get order detail from TPOS
async function getTPOSOrderDetail(orderId: number, bearerToken: string) {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order detail: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(`Invalid response from TPOS (not JSON)`);
    }

    return await response.json();
  }, 'tpos');
}

// Update TPOS order with product
async function updateTPOSOrder(
  orderId: number,
  orderDetail: any,
  newProducts: any[],
  bearerToken: string
) {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`;

    const existingDetails = orderDetail.Details || [];
    const existingProductsMap = new Map<string, { product: any; index: number }>();

    existingDetails.forEach((product: any, index: number) => {
      const code = product.ProductCode;
      if (code) {
        existingProductsMap.set(code, { product, index });
      }
    });

    const updatedDetails = [...existingDetails];
    const addedProducts: any[] = [];

    newProducts.forEach((newProduct) => {
      const code = newProduct.ProductCode;

      if (existingProductsMap.has(code)) {
        const { index } = existingProductsMap.get(code)!;
        const existingProduct = updatedDetails[index];

        updatedDetails[index] = {
          ...existingProduct,
          Quantity: newProduct.Quantity,
          Note: newProduct.Note || '',
        };

        console.log(
          `[PRODUCT UPLOAD] Product ${code} exists, overwriting: Quantity ${existingProduct.Quantity} -> ${newProduct.Quantity}`
        );
      } else {
        addedProducts.push(newProduct);
      }
    });

    const mergedProducts = [...updatedDetails, ...addedProducts];

    const payload = {
      ...orderDetail,
      Details: mergedProducts,
    };

    console.log(
      `[PRODUCT UPLOAD] Updating TPOS order ${orderId}: overwritten ${newProducts.length - addedProducts.length}, added ${addedProducts.length}`
    );

    const response = await fetch(url, {
      method: 'PUT',
      headers: getTPOSHeaders(bearerToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update order: ${response.status} - ${errorText}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      console.log('[PRODUCT UPLOAD] Order updated successfully (204 No Content)');
      return { success: true };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    console.log('[PRODUCT UPLOAD] Order updated successfully');
    return { success: true };
  }, 'tpos');
}

export async function uploadProductToTPOS(
  params: UploadProductToTPOSParams
): Promise<UploadProductResult> {
  try {
    const bearerToken = await getActiveTPOSToken();
    if (!bearerToken) {
      throw new Error("TPOS token không khả dụng");
    }

    // Step 1: Calculate representative session_index
    const sessionIndexes = params.orders.map(o => o.session_index);
    const representativeSessionIndex = getRepresentativeSessionIndex(sessionIndexes);
    const totalQuantity = params.orders.reduce((sum, o) => sum + o.quantity, 0);
    
    console.log('🔍 [PRODUCT UPLOAD] Processing product:', {
      product_code: params.product_code,
      totalOrders: params.orders.length,
      totalQuantity,
      sessionIndexes: [...new Set(sessionIndexes)],
      representativeSessionIndex,
    });

    params.onProgress?.(1, `Đang tìm đơn TPOS cho SessionIndex ${representativeSessionIndex}...`);

    // Step 2: Fetch TPOS Orders
    const tposOrders = await fetchTPOSOrders(
      params.sessionInfo.start_date,
      params.sessionInfo.end_date,
      representativeSessionIndex,
      bearerToken
    );

    if (tposOrders.length === 0) {
      throw new Error(`Không tìm thấy đơn hàng TPOS với SessionIndex ${representativeSessionIndex}`);
    }

    const selectedOrder = tposOrders[0];
    params.onProgress?.(2, `Đã chọn đơn TPOS: ${selectedOrder.Code}`);

    // Step 3: Search product and fetch order detail
    params.onProgress?.(3, `Đang tìm sản phẩm ${params.product_code} trong TPOS...`);
    
    const [orderDetail, searchResult] = await Promise.all([
      getTPOSOrderDetail(selectedOrder.Id, bearerToken),
      searchTPOSProduct(params.product_code, bearerToken)
    ]);

    if (!searchResult) {
      throw new Error(`Không tìm thấy sản phẩm ${params.product_code} trong TPOS`);
    }

    // Step 4: Prepare product data with combined note
    const sessionIndexList = [...new Set(sessionIndexes)].sort((a, b) => a - b).join(', ');
    const combinedNote = `Gộp ${params.orders.length} đơn [${sessionIndexList}]`;

    const tposProduct = {
      ProductId: searchResult.Id,
      ProductCode: searchResult.Code,
      ProductName: searchResult.Name,
      ProductNameGet: searchResult.NameGet,
      Quantity: totalQuantity,
      Note: combinedNote,
      Price: searchResult.ListPrice || searchResult.PriceVariant || 0,
      UOMId: 1,
      UOMName: "Cái",
      Factor: 1,
      ProductWeight: 0,
    };

    // Step 5: Update order in TPOS
    params.onProgress?.(4, `Đang cập nhật đơn ${selectedOrder.Code} với tổng SL ${totalQuantity}...`);
    
    await updateTPOSOrder(selectedOrder.Id, orderDetail, [tposProduct], bearerToken);

    // Step 6: Update database - all order items
    const orderItemIds = params.orders.map(o => o.id);
    
    const { error: updateError } = await supabase
      .from('live_orders')
      .update({
        tpos_order_id: selectedOrder.Id.toString(),
        code_tpos_order_id: selectedOrder.Code,
        upload_status: 'success',
        uploaded_at: new Date().toISOString(),
      })
      .in('id', orderItemIds);

    if (updateError) {
      console.error('[PRODUCT UPLOAD] Failed to update database:', updateError);
    }

    console.log('✅ [PRODUCT UPLOAD] Success:', {
      product_code: params.product_code,
      tposOrderId: selectedOrder.Id,
      codeTPOSOrderId: selectedOrder.Code,
      updatedOrderItems: orderItemIds.length,
    });

    return {
      success: true,
      tposOrderId: selectedOrder.Id.toString(),
      codeTPOSOrderId: selectedOrder.Code,
    };
  } catch (error) {
    console.error('[PRODUCT UPLOAD] Error:', error);
    
    // Update database with failed status
    const orderItemIds = params.orders.map(o => o.id);
    await supabase
      .from('live_orders')
      .update({
        upload_status: 'failed',
        uploaded_at: new Date().toISOString(),
      })
      .in('id', orderItemIds);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
