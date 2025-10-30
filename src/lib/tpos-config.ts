// =====================================================
// TPOS API CONFIGURATION
// =====================================================

import { supabase } from "@/integrations/supabase/client";

export const TPOS_CONFIG = {
  API_BASE: "https://tomato.tpos.vn/odata/ProductTemplate",
  
  // Upload settings
  CONCURRENT_UPLOADS: 3,
  CREATED_BY_NAME: "Tú",
  
  // Product settings
  DEFAULT_CATEGORY: "QUẦN ÁO",
  DEFAULT_UOM: "CÁI",
  DEFAULT_PRODUCT_TYPE: "Có thể lưu trữ",
  
  // API version
  API_VERSION: "2701",
} as const;

// =====================================================
// TOKEN MANAGEMENT
// =====================================================

export async function getActiveTPOSToken(): Promise<string | null> {
  try {
    // Get the most recent TPOS token from credentials
    const { data, error } = await (supabase as any)
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching TPOS token from credentials:', error);
      return null;
    }
    
    return data?.bearer_token || null;
  } catch (error) {
    console.error('Exception fetching TPOS token:', error);
    return null;
  }
}

export async function getActiveFacebookToken(): Promise<string | null> {
  try {
    // Get the most recent Facebook token from credentials
    const { data, error } = await (supabase as any)
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'facebook')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching Facebook token from credentials:', error);
      return null;
    }
    
    return data?.bearer_token || null;
  } catch (error) {
    console.error('Exception fetching Facebook token:', error);
    return null;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function randomDelay(min = 500, max = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function cleanBase64(base64String: string | null | undefined): string | null {
  if (!base64String) return null;
  if (base64String.includes(",")) {
    base64String = base64String.split(",")[1];
  }
  return base64String.replace(/\s/g, "");
}

export function getTPOSHeaders(bearerToken: string) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json;charset=UTF-8",
    authorization: `Bearer ${bearerToken}`,
    "x-tpos-lang": "vi",
    origin: "https://tomato.tpos.vn",
    referer: "https://tomato.tpos.vn/",
    "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "x-request-id": generateRandomId(),
  };
}
