import { supabase } from "@/integrations/supabase/client";
import { getActiveTPOSToken, getTPOSHeaders } from "./tpos-config";

interface UploadOrderToTPOSParams {
  orderCode: string;
  products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    note?: string;
  }>;
  sessionInfo: {
    start_date: string;
    end_date: string;
    session_index: number;
  };
  orderItemIds?: string[];
  onProgress?: (step: number, message: string) => void;
}

interface UploadResult {
  success: boolean;
  tposOrderId?: string;
  codeTPOSOrderId?: string;
  error?: string;
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
    const filterQuery = `DateCreated ge ${startDate} and DateCreated le ${endDate} and SessionIndex eq ${sessionIndex}`;
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$filter=${encodeURIComponent(filterQuery)}&$orderby=DateCreated desc&$top=50`;

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

// Update TPOS order - OVERWRITE Quantity + Note for existing products
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
          `Product ${code} exists in TPOS order ${orderId}, overwriting: Quantity ${existingProduct.Quantity} -> ${newProduct.Quantity}, Note updated`
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
      `Updating TPOS order ${orderId}: overwritten ${newProducts.length - addedProducts.length} products, added ${addedProducts.length} new products`
    );

    const response = await fetch(url, {
      method: 'PUT',
      headers: getTPOSHeaders(bearerToken),
      body: JSON.stringify(payload),
    });

    console.log('Update response status:', response.status);
    console.log('Update response content-type:', response.headers.get('content-type'));
    console.log('Update response content-length:', response.headers.get('content-length'));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update order: ${response.status} - ${errorText}`);
    }

    // Handle 204 No Content or empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      console.log('Order updated successfully (204 No Content)');
      return { success: true };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    console.log('Order updated successfully (non-JSON response)');
    return { success: true };
  }, 'tpos');
}

export async function uploadOrderToTPOS(
  params: UploadOrderToTPOSParams
): Promise<UploadResult> {
  try {
    const bearerToken = await getActiveTPOSToken();
    if (!bearerToken) {
      throw new Error("TPOS token không khả dụng");
    }

    // Step 1: Fetch TPOS Orders
    params.onProgress?.(1, `Đang tìm đơn hàng TPOS từ ${params.sessionInfo.start_date} đến ${params.sessionInfo.end_date}...`);
    
    const tposOrders = await fetchTPOSOrders(
      params.sessionInfo.start_date,
      params.sessionInfo.end_date,
      params.sessionInfo.session_index,
      bearerToken
    );

    if (tposOrders.length === 0) {
      throw new Error("Không tìm thấy đơn hàng TPOS trong khoảng thời gian này");
    }

    // Step 2: Select first order automatically
    const selectedOrder = tposOrders[0];
    params.onProgress?.(2, `Đã chọn đơn TPOS: ${selectedOrder.Code}`);

    // Step 3: Fetch order detail and search products
    params.onProgress?.(3, `Đang tìm ${params.products.length} sản phẩm trong TPOS...`);
    
    const [orderDetail, ...productSearchResults] = await Promise.all([
      getTPOSOrderDetail(selectedOrder.Id, bearerToken),
      ...params.products.map(p => searchTPOSProduct(p.product_code, bearerToken))
    ]);

    const tposProducts = [];
    for (let i = 0; i < params.products.length; i++) {
      const product = params.products[i];
      const searchResult = productSearchResults[i];
      
      if (!searchResult) {
        throw new Error(`Không tìm thấy sản phẩm ${product.product_code} trong TPOS`);
      }

      tposProducts.push({
        ProductId: searchResult.Id,
        ProductCode: searchResult.Code,
        ProductName: searchResult.Name,
        ProductNameGet: searchResult.NameGet,
        Quantity: product.quantity,
        Note: product.note || '',
        Price: searchResult.ListPrice || searchResult.PriceVariant || 0,
        UOMId: 1,
        UOMName: "Cái",
        Factor: 1,
        ProductWeight: 0,
      });
    }

    // Step 4: Update order in TPOS
    params.onProgress?.(4, `Đang cập nhật đơn ${selectedOrder.Code} với ${tposProducts.length} sản phẩm...`);
    
    await updateTPOSOrder(selectedOrder.Id, orderDetail, tposProducts, bearerToken);

    // Update database - only update specific items if orderItemIds provided
    if (params.orderItemIds && params.orderItemIds.length > 0) {
      const { error: updateError } = await supabase
        .from('live_orders')
        .update({
          tpos_order_id: selectedOrder.Id.toString(),
          code_tpos_order_id: selectedOrder.Code,
          upload_status: 'success',
          uploaded_at: new Date().toISOString(),
        })
        .in('id', params.orderItemIds);

      if (updateError) {
        console.error('Failed to update database:', updateError);
      }
    } else {
      // Fallback: Update all items with this order_code
      const { error: updateError } = await supabase
        .from('live_orders')
        .update({
          tpos_order_id: selectedOrder.Id.toString(),
          code_tpos_order_id: selectedOrder.Code,
          upload_status: 'success',
          uploaded_at: new Date().toISOString(),
        })
        .eq('order_code', params.orderCode);

      if (updateError) {
        console.error('Failed to update database:', updateError);
      }
    }

    return {
      success: true,
      tposOrderId: selectedOrder.Id.toString(),
      codeTPOSOrderId: selectedOrder.Code,
    };
  } catch (error) {
    console.error('Upload error:', error);
    
    // Update database with failed status - only update specific items if orderItemIds provided
    if (params.orderItemIds && params.orderItemIds.length > 0) {
      await supabase
        .from('live_orders')
        .update({
          upload_status: 'failed',
          uploaded_at: new Date().toISOString(),
        })
        .in('id', params.orderItemIds);
    } else {
      await supabase
        .from('live_orders')
        .update({
          upload_status: 'failed',
          uploaded_at: new Date().toISOString(),
        })
        .eq('order_code', params.orderCode);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
