import { supabase } from "@/integrations/supabase/client";
import { convertVietnameseToUpperCase } from "./utils";
import { searchTPOSProduct } from "./tpos-api";

// Keywords for product categories
const CATEGORY_N_KEYWORDS = ["QUAN", "AO", "DAM", "SET", "JUM", "AOKHOAC"];
const CATEGORY_P_KEYWORDS = [
  "TUI", 
  "MATKINH",     // mắt kính → viết liền
  "KINH",        // kính
  "MYPHAM",      // mỹ phẩm → viết liền
  "BANGDO",      // băng đô → viết liền
  "GIAYDEP",     // giày dép → viết liền
  "GIAY",        // giày
  "DEP",         // dép
  "PHU",         // phụ kiện → viết liền
  "DONG",        // đồng hồ → viết liền
  "DAY",         // dây chuyền → viết liền
  "LAC",         // lắc
  "KHAN",        // khăn
  "NIT",         // nịt
  "KEM",         // kem
  "SUA",         // sữa
  "BANH",        // bánh
  "SON",         // son
  "CUSHION",     // cushion
  "MAT"          // mặt
];

/**
 * Extract base product code from a variant code
 * @param productCode - Product code (e.g., 'N123VX', 'M800XXD30', 'P42')
 * @returns Base product code (e.g., 'N123', 'M800', 'P42')
 */
export function extractBaseProductCode(productCode: string): string {
  if (!productCode) return '';
  
  // Match pattern: One or more letters followed by one or more digits
  // Examples: N123VX → N123, M800XXD30 → M800, P42CD → P42, N123 → N123
  const match = productCode.match(/^([A-Z]+\d+)/i);
  
  if (match) {
    return match[1].toUpperCase();
  }
  
  // If pattern doesn't match, return the original code
  return productCode.toUpperCase();
}

/**
 * Detect product category based on product name using sequential token scanning
 * @param productName - Product name to analyze
 * Format: [ddmm] [NCC] [LoaiSP] + mô tả (ddmm is optional)
 * @returns 'N' for clothing, 'P' for accessories, 'Q' for Q supplier, null if insufficient info
 */
export function detectProductCategory(productName: string): 'N' | 'P' | 'Q' | null {
  const normalized = convertVietnameseToUpperCase(productName);
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  
  if (tokens.length === 0) return null;
  
  let currentIndex = 0;
  
  // STEP 1: Check if first token is date (ddmm format)
  if (/^\d{4}$/.test(tokens[0])) {
    currentIndex++; // Skip date token
    if (currentIndex >= tokens.length) return null; // Chỉ có date → chưa đủ info
  }
  
  // STEP 2: Check if next token is NCC pattern
  const nccToken = tokens[currentIndex];
  if (nccToken) {
    // Q pattern (Q hoặc Q123) → return Q immediately
    if (/^Q\d*$/i.test(nccToken)) {
      return 'Q';
    }
    
    // A pattern (A12, B5, etc.) → continue to check loại SP
    if (/^[A-Z]\d+$/i.test(nccToken)) {
      currentIndex++; // Move to loại SP token
    }
  }
  
  // STEP 3: Check if next token is loại SP keyword
  const loaiSPToken = tokens[currentIndex];
  if (loaiSPToken) {
    // Match exact keywords
    if (CATEGORY_N_KEYWORDS.some(kw => loaiSPToken.includes(kw))) return 'N';
    if (CATEGORY_P_KEYWORDS.some(kw => loaiSPToken.includes(kw))) return 'P';
  }
  
  // STEP 4: Fallback - scan all tokens for keywords (ưu tiên token đầu tiên)
  for (const token of tokens) {
    if (CATEGORY_N_KEYWORDS.some(kw => token.includes(kw))) return 'N';
    if (CATEGORY_P_KEYWORDS.some(kw => token.includes(kw))) return 'P';
  }
  
  // STEP 5: Default to 'N' if structure is valid (date + NCC + text)
  // Check if we have: [date?] [NCC (not Q)] [additional text]
  let hasDate = /^\d{4}$/.test(tokens[0]);
  let hasNCC = false;
  let hasAdditionalText = false;
  
  // Determine if we have NCC
  if (hasDate && tokens.length > 1) {
    // Check token after date
    if (/^[A-PR-Z]\d+$/i.test(tokens[1])) { // A-P, R-Z (not Q)
      hasNCC = true;
      hasAdditionalText = tokens.length > 2;
    }
  } else if (!hasDate && tokens.length > 0) {
    // Check first token
    if (/^[A-PR-Z]\d+$/i.test(tokens[0])) { // A-P, R-Z (not Q)
      hasNCC = true;
      hasAdditionalText = tokens.length > 1;
    }
  }
  
  // If structure is valid but no keyword match → default to 'N'
  if (hasNCC && hasAdditionalText) {
    return 'N';
  }
  
  // STEP 6: Not enough information
  return null;
}

/**
 * Get the next available product code for a category
 * @param category - 'N', 'P', or 'Q'
 * @returns Next product code (e.g., 'N126', 'P45', or 'Q1')
 */
export async function getNextProductCode(category: 'N' | 'P' | 'Q'): Promise<string> {
  try {
    // Query for ALL codes in this category
    const { data, error } = await supabase
      .from("products")
      .select("product_code")
      .like("product_code", `${category}%`);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      // No existing codes, start with 1
      return `${category}1`;
    }
    
    // Parse all numbers and find the maximum
    let maxNumber = 0;
    data.forEach(item => {
      const numberMatch = item.product_code.match(/\d+$/);
      if (numberMatch) {
        const num = parseInt(numberMatch[0], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    return `${category}${nextNumber}`;
  } catch (error) {
    console.error("Error getting next product code:", error);
    // Fallback to default
    return `${category}1`;
  }
}

/**
 * Increment product code by 1
 * @param productCode - Current product code (e.g., 'N123' or 'P45')
 * @param existingCodes - Array of existing codes to avoid duplicates
 * @returns Incremented code (e.g., 'N124' or 'P46') or null if invalid
 */
export function incrementProductCode(
  productCode: string, 
  existingCodes: string[] = []
): string | null {
  if (!productCode.trim()) return null;
  
  // Extract prefix and number
  const match = productCode.match(/^([NPQ])(\d+)$/);
  if (!match) return null; // Invalid format
  
  const prefix = match[1];
  let number = parseInt(match[2], 10);
  
  // Increment and check for duplicates
  let newCode: string;
  do {
    number++;
    newCode = `${prefix}${number}`;
  } while (existingCodes.includes(newCode));
  
  return newCode;
}

/**
 * Get max product number from form items for a category
 * @param items - Array of items in the form
 * @param category - 'N', 'P', or 'Q'
 * @returns Max number found, or 0 if none
 */
export function getMaxNumberFromItems(
  items: Array<{ product_code: string }>, 
  category: 'N' | 'P' | 'Q'
): number {
  let maxNumber = 0;
  
  items.forEach(item => {
    const match = item.product_code.match(/^([NPQ])(\d+)$/);
    if (match && match[1] === category) {
      const num = parseInt(match[2], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  
  return maxNumber;
}



/**
 * Get max product number from purchase order items for a category
 * @param category - 'N', 'P', or 'Q'
 * @returns Max number found, or 0 if none
 */
export async function getMaxNumberFromPurchaseOrderItems(
  category: 'N' | 'P' | 'Q'
): Promise<number> {
  try {
    // Query for ALL codes in this category from purchase_order_items table
    const { data, error } = await supabase
      .from("purchase_order_items")
      .select("product_code")
      .like("product_code", `${category}%`);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    // Parse all numbers and find the maximum
    let maxNumber = 0;
    data.forEach(item => {
      const match = item.product_code?.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    return maxNumber;
  } catch (error) {
    console.error("Error getting max number from purchase_order_items:", error);
    return 0;
  }
}

/**
 * Get max product number from products table for a category
 * @param category - 'N', 'P', or 'Q'
 * @returns Max number found, or 0 if none
 */
export async function getMaxNumberFromProducts(
  category: 'N' | 'P' | 'Q'
): Promise<number> {
  try {
    // Query for ALL codes in this category from products table
    const { data, error } = await supabase
      .from("products")
      .select("product_code")
      .like("product_code", `${category}%`);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    // Parse all numbers and find the maximum
    let maxNumber = 0;
    data.forEach(item => {
      const match = item.product_code?.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    return maxNumber;
  } catch (error) {
    console.error("Error getting max number from products:", error);
    return 0;
  }
}


/**
 * Generate product code based on max from form, database, and purchase orders
 * @param productName - Product name to detect category
 * @param formItems - Current items in the form
 * @param userId - Reserved for future use (not used)
 * @returns Generated product code (e.g., 'N128')
 */
export async function generateProductCodeFromMax(
  productName: string,
  formItems: Array<{ product_code: string }>,
  userId?: string
): Promise<string> {
  if (!productName.trim()) {
    throw new Error("Tên sản phẩm không được để trống");
  }
  
  const category = detectProductCategory(productName);
  
  // Handle null case - chưa đủ thông tin để detect category
  if (category === null) {
    throw new Error("⚠️ Chưa đủ thông tin để tạo mã SP. Vui lòng nhập thêm:\n• Loại SP (ÁO, TÚI, QUẦN...)\n• Hoặc NCC (Q5, A12...)");
  }
  
  // Get max from all permanent sources
  const maxFromForm = getMaxNumberFromItems(formItems, category);
  const maxFromProducts = await getMaxNumberFromProducts(category);
  const maxFromPurchaseOrders = await getMaxNumberFromPurchaseOrderItems(category);
  
  // Take the largest one and add 1
  const maxNumber = Math.max(maxFromForm, maxFromProducts, maxFromPurchaseOrders);
  let nextNumber = maxNumber + 1;
  let candidateCode = `${category}${nextNumber}`;
  
  // Check TPOS API for existence
  while (true) {
    const tposProduct = await searchTPOSProduct(candidateCode);
    
    if (tposProduct) {
      // Code exists on TPOS - increment and try again
      console.log(`⚠️ Mã ${candidateCode} đã tồn tại trên TPOS, thử mã tiếp theo...`);
      nextNumber++;
      candidateCode = `${category}${nextNumber}`;
      continue;
    }
    
    // Code is available
    break;
  }
  
  return candidateCode;
}

/**
 * Get next available N/A code
 * @returns Next N/A code (e.g., 'N/A', 'N/A1', 'N/A2'...)
 */
export async function getNextNACode(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("live_products")
      .select("product_code")
      .like("product_code", "N/A%")
      .order("product_code", { ascending: false });
    
    if (error) throw error;
    
    // Nếu chưa có N/A nào, trả về "N/A"
    if (!data || data.length === 0) {
      return "N/A";
    }
    
    // Parse tất cả các số và tìm max
    let maxNumber = 0;
    let hasBaseNA = false;
    
    data.forEach(item => {
      if (item.product_code === "N/A") {
        hasBaseNA = true;
      }
      const match = item.product_code.match(/^N\/A(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    // Nếu chưa có "N/A" thuần, trả về "N/A"
    if (!hasBaseNA) {
      return "N/A";
    }
    
    // Nếu đã có "N/A", bắt đầu từ N/A1
    const nextNumber = maxNumber + 1;
    return `N/A${nextNumber}`;
  } catch (error) {
    console.error("Error getting next N/A code:", error);
    return "N/A";
  }
}

/**
 * Generate product code based on product name
 * @param productName - Product name to generate code from
 * @returns Generated product code (e.g., 'N126' or 'P45')
 */
export async function generateProductCode(productName: string): Promise<string> {
  if (!productName.trim()) {
    throw new Error("Tên sản phẩm không được để trống");
  }
  
  const category = detectProductCategory(productName);
  
  // Handle null case - chưa đủ thông tin để detect category
  if (category === null) {
    throw new Error("⚠️ Chưa đủ thông tin để tạo mã SP. Vui lòng nhập thêm:\n• Loại SP (ÁO, TÚI, QUẦN...)\n• Hoặc NCC (Q5, A12...)");
  }
  
  const code = await getNextProductCode(category);
  
  return code;
}
