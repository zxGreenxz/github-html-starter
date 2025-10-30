import { supabase } from "@/integrations/supabase/client";

export interface TPOSOrderDetail {
  Id: string;
  Quantity: number;
  Price: number;
  ProductId: number;
  ProductName: string;
  ProductCode: string;
  Note?: string | null;
  ImageUrl?: string | null;
}

export interface TPOSOrderInfo {
  Id: string;
  Code: string;
  Details: TPOSOrderDetail[];
  TotalAmount: number;
  TotalQuantity: number;
}

interface TPOSOrderListItem {
  Id: string;
  Code: string;
  SessionIndex: number;
}

/**
 * Fetch TPOS orders by SessionIndex within a date range
 */
export async function fetchTPOSOrdersBySessionIndex(
  sessionIndex: number,
  startDate: string,
  endDate: string,
  bearerToken: string
): Promise<TPOSOrderListItem[]> {
  // Format dates for TPOS API (ISO 8601 with timezone)
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const endISO = end.toISOString();

  const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=20&$orderby=DateCreated+desc&$filter=(DateCreated+ge+${startISO}+and+DateCreated+le+${endISO}+and+SessionIndex+eq+${sessionIndex})&$count=true`;

  console.log('🔍 [TPOS Fetch] Fetching orders:', { sessionIndex, startDate, endDate, url });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [TPOS Fetch] Error response:', errorText);
    throw new Error(`Failed to fetch TPOS orders: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ [TPOS Fetch] Orders found:', data.value?.length || 0);
  
  return data.value || [];
}

/**
 * Fetch detailed TPOS order information with expanded Details
 */
export async function fetchTPOSOrderDetails(
  orderId: string,
  bearerToken: string
): Promise<TPOSOrderInfo> {
  const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`;

  console.log('🔍 [TPOS Details] Fetching order details:', { orderId, url });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [TPOS Details] Error response:', errorText);
    throw new Error(`Failed to fetch TPOS order details: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ [TPOS Details] Order details fetched:', {
    code: data.Code,
    detailsCount: data.Details?.length || 0,
  });
  
  return {
    Id: data.Id,
    Code: data.Code,
    Details: data.Details || [],
    TotalAmount: data.TotalAmount || 0,
    TotalQuantity: data.TotalQuantity || 0,
  };
}

/**
 * Get bearer token from tpos_credentials
 */
export async function getTPOSBearerToken(): Promise<string> {
  const { data, error } = await supabase
    .from('tpos_credentials')
    .select('bearer_token')
    .eq('token_type', 'tpos')
    .single();

  if (error || !data?.bearer_token) {
    throw new Error('Không tìm thấy bearer token TPOS. Vui lòng cấu hình lại.');
  }

  return data.bearer_token;
}
