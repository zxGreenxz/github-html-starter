import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle2, XCircle, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TPOSProductItem } from "@/lib/tpos-api";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { VariantConflictDialog, type VariantConflict, type ResolvedUpdate } from "./VariantConflictDialog";

interface BulkTPOSUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface UploadProgress {
  itemId: string;
  code: string;
  name: string;
  variant: string | null;
  status: UploadStatus;
  error?: string;
}

// === HELPER TYPES ===
interface AttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId?: number;
  AttributeName?: string;
  PriceExtra?: number | null;
  NameGet?: string;
  DateCreated?: string | null;
}

interface AttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: number | null;
    CreateVariant: boolean;
  };
  Values: AttributeValue[];
  AttributeId: number;
}

// Map TPOS_ATTRIBUTES to component structure
const availableAttributes = {
  sizeText: {
    id: 1,
    name: "Size Chữ",
    code: "SZCh",
    values: TPOS_ATTRIBUTES.sizeText,
  },
  color: {
    id: 3,
    name: "Màu",
    code: "Mau",
    values: TPOS_ATTRIBUTES.color,
  },
  sizeNumber: {
    id: 4,
    name: "Size Số",
    code: "SZNu",
    values: TPOS_ATTRIBUTES.sizeNumber,
  },
};

export function BulkTPOSUploadDialog({ 
  open, 
  onOpenChange, 
  items,
  onSuccess 
}: BulkTPOSUploadDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [currentConflicts, setCurrentConflicts] = useState<VariantConflict[]>([]);
  const [currentVariantsData, setCurrentVariantsData] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState<TPOSProductItem | null>(null);
  const [currentTPOSProductId, setCurrentTPOSProductId] = useState<number | null>(null);
  
  const totalProducts = items.length;
  
  // Select all functionality
  const allSelected = selectedIds.size === items.length && items.length > 0;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };
  
  const toggleSelect = (itemId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedIds(newSet);
  };
  
  // === HELPER FUNCTIONS ===
  const getHeaders = async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi TPOS Token",
        description: "Vui lòng cấu hình TPOS Credentials trong Settings"
      });
      throw new Error('No TPOS token');
    }
    return getTPOSHeaders(token);
  };

  const loadImageAsBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // Remove "data:image/...;base64," prefix
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load image:', error);
      return null;
    }
  };

  const parseVariantString = (variantStr: string): AttributeLine[] => {
    if (!variantStr || variantStr.trim() === '') return [];
    
    const parts = variantStr.split(',').map(s => s.trim().toUpperCase());
    const attributeLines: AttributeLine[] = [];
    
    for (const part of parts) {
      // Check size text
      const sizeTextMatch = availableAttributes.sizeText.values.find(
        v => v.Name.toUpperCase() === part || v.Code.toUpperCase() === part
      );
      if (sizeTextMatch) {
        let line = attributeLines.find(l => l.AttributeId === 1);
        if (!line) {
          line = {
            Attribute: { Id: 1, Name: "Size Chữ", Code: "SZCh", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 1
          };
          attributeLines.push(line);
        }
        line.Values.push({
          Id: sizeTextMatch.Id,
          Name: sizeTextMatch.Name,
          Code: sizeTextMatch.Code,
          Sequence: sizeTextMatch.Sequence,
          AttributeId: 1,
          AttributeName: "Size Chữ",
          PriceExtra: null,
          NameGet: `Size Chữ: ${sizeTextMatch.Name}`,
          DateCreated: null
        });
      }
      
      // Check color
      const colorMatch = availableAttributes.color.values.find(
        v => v.Name.toUpperCase().includes(part) || part.includes(v.Name.toUpperCase())
      );
      if (colorMatch) {
        let line = attributeLines.find(l => l.AttributeId === 3);
        if (!line) {
          line = {
            Attribute: { Id: 3, Name: "Màu", Code: "Mau", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 3
          };
          attributeLines.push(line);
        }
        line.Values.push({
          Id: colorMatch.Id,
          Name: colorMatch.Name,
          Code: colorMatch.Code,
          Sequence: colorMatch.Sequence,
          AttributeId: 3,
          AttributeName: "Màu",
          PriceExtra: null,
          NameGet: `Màu: ${colorMatch.Name}`,
          DateCreated: null
        });
      }
      
      // Check size number
      const sizeNumberMatch = availableAttributes.sizeNumber.values.find(
        v => v.Name === part || v.Code === part
      );
      if (sizeNumberMatch) {
        let line = attributeLines.find(l => l.AttributeId === 4);
        if (!line) {
          line = {
            Attribute: { Id: 4, Name: "Size Số", Code: "SZNu", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 4
          };
          attributeLines.push(line);
        }
        line.Values.push({
          Id: sizeNumberMatch.Id,
          Name: sizeNumberMatch.Name,
          Code: sizeNumberMatch.Code,
          Sequence: sizeNumberMatch.Sequence,
          AttributeId: 4,
          AttributeName: "Size Số",
          PriceExtra: null,
          NameGet: `Size Số: ${sizeNumberMatch.Name}`,
          DateCreated: null
        });
      }
    }
    
    return attributeLines;
  };

  const generateVariants = (productName: string, listPrice: number, attributeLines: AttributeLine[]) => {
    if (!attributeLines || attributeLines.length === 0) return [];
    
    const combinations: AttributeValue[][] = [];
    
    function getCombinations(lines: AttributeLine[], current: AttributeValue[] = [], index = 0) {
      if (index === lines.length) {
        combinations.push([...current]);
        return;
      }
      const line = lines[index];
      for (const value of line.Values) {
        current.push(value);
        getCombinations(lines, current, index + 1);
        current.pop();
      }
    }
    
    getCombinations(attributeLines);
    
    return combinations.map(attrs => {
      const variantName = attrs.map(a => a.Name).join(', ');
      return {
        Id: 0,
        EAN13: null,
        DefaultCode: null,
        NameTemplate: productName,
        NameNoSign: null,
        ProductTmplId: 0,
        UOMId: 0,
        UOMName: null,
        UOMPOId: 0,
        QtyAvailable: 0,
        VirtualAvailable: 0,
        OutgoingQty: null,
        IncomingQty: null,
        NameGet: `${productName} (${variantName})`,
        POSCategId: null,
        Price: null,
        Barcode: null,
        Image: null,
        ImageUrl: null,
        Thumbnails: [],
        PriceVariant: listPrice,
        SaleOK: true,
        PurchaseOK: true,
        DisplayAttributeValues: null,
        LstPrice: 0,
        Active: true,
        ListPrice: 0,
        PurchasePrice: null,
        DiscountSale: null,
        DiscountPurchase: null,
        StandardPrice: 0,
        Weight: 0,
        Volume: null,
        OldPrice: null,
        IsDiscount: false,
        ProductTmplEnableAll: false,
        Version: 0,
        Description: null,
        LastUpdated: null,
        Type: "product",
        CategId: 0,
        CostMethod: null,
        InvoicePolicy: "order",
        Variant_TeamId: 0,
        Name: `${productName} (${variantName})`,
        PropertyCostMethod: null,
        PropertyValuation: null,
        PurchaseMethod: "receive",
        SaleDelay: 0,
        Tracking: null,
        Valuation: null,
        AvailableInPOS: true,
        CompanyId: null,
        IsCombo: null,
        NameTemplateNoSign: productName,
        TaxesIds: [],
        StockValue: null,
        SaleValue: null,
        PosSalesCount: null,
        Factor: null,
        CategName: null,
        AmountTotal: null,
        NameCombos: [],
        RewardName: null,
        Product_UOMId: null,
        Tags: null,
        DateCreated: null,
        InitInventory: 0,
        OrderTag: null,
        StringExtraProperties: null,
        CreatedById: null,
        TaxAmount: null,
        Error: null,
        AttributeValues: attrs.map(a => ({
          Id: a.Id,
          Name: a.Name,
          Code: null,
          Sequence: null,
          AttributeId: a.AttributeId,
          AttributeName: a.AttributeName,
          PriceExtra: null,
          NameGet: a.NameGet,
          DateCreated: null
        }))
      };
    });
  };

  // Check conflicts with existing products
  const checkVariantConflicts = async (variantsFromTPOS: any[]): Promise<VariantConflict[]> => {
    try {
      const variantCodes = variantsFromTPOS.map(v => v.DefaultCode).filter(Boolean);
      
      if (variantCodes.length === 0) return [];
      
      // Query existing products
      const { data: existingProducts } = await supabase
        .from('products')
        .select('*')
        .in('product_code', variantCodes);
      
      if (!existingProducts || existingProducts.length === 0) {
        return [];
      }
      
      const conflicts: VariantConflict[] = [];
      const existingMap = new Map(
        existingProducts.map(p => [p.product_code, p])
      );
      
      for (const newVariant of variantsFromTPOS) {
        const code = newVariant.DefaultCode;
        if (!code) continue;
        
        const existing = existingMap.get(code);
        
        if (existing) {
          const diffFields: string[] = [];
          
          // Compare fields
          const fieldsToCompare = [
            { field: 'selling_price', tposField: 'PriceVariant' },
            { field: 'purchase_price', tposField: 'PurchasePrice' },
            { field: 'barcode', tposField: 'Barcode' },
            { field: 'stock_quantity', tposField: 'QtyAvailable' },
            { field: 'product_name', tposField: 'Name' }
          ];
          
          for (const { field, tposField } of fieldsToCompare) {
            const oldValue = existing[field];
            const newValue = newVariant[tposField];
            
            if (oldValue !== newValue) {
              diffFields.push(field);
            }
          }
          
          if (diffFields.length > 0) {
            conflicts.push({
              product_code: code,
              variant_name: extractVariantName(newVariant),
              old_data: {
                selling_price: existing.selling_price,
                purchase_price: existing.purchase_price,
                barcode: existing.barcode,
                stock_quantity: existing.stock_quantity,
                product_name: existing.product_name
              },
              new_data: {
                selling_price: newVariant.PriceVariant,
                purchase_price: newVariant.PurchasePrice,
                barcode: newVariant.Barcode,
                stock_quantity: newVariant.QtyAvailable,
                product_name: newVariant.Name
              },
              diff_fields: diffFields
            });
          }
        }
      }
      
      return conflicts;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return [];
    }
  };

  // Extract variant name from TPOS variant object
  const extractVariantName = (variant: any): string => {
    if (!variant.AttributeValues || variant.AttributeValues.length === 0) {
      return "-";
    }
    return variant.AttributeValues.map((av: any) => av.Name).join(", ");
  };

  // Handle conflict resolution
  const handleResolveConflicts = async (resolvedUpdates: ResolvedUpdate[]) => {
    if (!currentVariantsData || !currentItem || currentTPOSProductId === null) {
      return;
    }

    try {
      // Batch update variants with error handling
      const result = await batchUpdateVariantsWithCheck(
        currentVariantsData,
        resolvedUpdates,
        currentItem,
        currentTPOSProductId
      );
      
      // Mark as success
      setProgress(prev => prev.map((p) => 
        p.itemId === currentItem.id 
          ? { ...p, status: 'success', error: result.missing.length > 0 ? `Thiếu ${result.missing.length} variants` : undefined } 
          : p
      ));
      
      // Toast thông báo
      if (result.missing.length > 0) {
        toast({
          variant: "default",
          title: `⚠️ Đã cập nhật ${result.updated} variants`,
          description: `Thiếu ${result.missing.length} biến thể:\n${result.missing.slice(0, 3).join('\n')}${result.missing.length > 3 ? `\n...và ${result.missing.length - 3} biến thể khác` : ''}`,
          duration: 8000
        });
      } else {
        toast({
          title: "✅ Đã cập nhật variants",
          description: `Đã cập nhật ${result.updated} variants vào kho`
        });
      }
    } catch (error: any) {
      // Error already handled in batchUpdateVariants
      console.error('Error resolving conflicts:', error);
    }
    
    // Reset conflict state
    setCurrentConflicts([]);
    setCurrentVariantsData([]);
    setCurrentItem(null);
    setCurrentTPOSProductId(null);
  };

  // Update productid_bienthe for resolved variants with missing check
  const batchUpdateVariantsWithCheck = async (
    variantsFromTPOS: any[],
    resolvedUpdates: ResolvedUpdate[],
    baseItem: TPOSProductItem,
    tposProductId: number
  ): Promise<{ updated: number; missing: string[] }> => {
    try {
      const variantIdMap = variantsFromTPOS.reduce((acc, variant) => {
        acc[variant.DefaultCode] = {
          id: variant.Id,
          name: variant.Name
        };
        return acc;
      }, {} as Record<string, { id: number; name: string }>);

      // Update resolved variants
      let updatedCount = 0;
      for (const update of resolvedUpdates) {
        const tposCode = update.product_code;
        const variantInfo = variantIdMap[tposCode];
        
        if (!variantInfo) continue;

        const { error } = await supabase
          .from('products')
          .update({ productid_bienthe: variantInfo.id })
          .eq('product_code', tposCode);

        if (error) throw error;
        updatedCount++;
      }

      // Check for unresolved (missing) variants
      const resolvedTPOSCodes = new Set(resolvedUpdates.map(u => u.product_code));
      const allTPOSCodes = Object.keys(variantIdMap);
      const missingCodes = allTPOSCodes.filter(code => !resolvedTPOSCodes.has(code));

      console.log(`✅ Đã cập nhật productid_bienthe cho ${updatedCount} sản phẩm con (resolved)`);

      return {
        updated: updatedCount,
        missing: missingCodes.map(code => `${code} (${variantIdMap[code].name})`)
      };

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi cập nhật resolved variants",
        description: error.message
      });
      throw error;
    }
  };

  // Update productid_bienthe only for existing products
  const updateVariantTPOSIds = async (
    variantsFromTPOS: any[],
    baseItem: TPOSProductItem,
    tposProductId: number
  ): Promise<{ updated: number; missing: string[] }> => {
    try {
      // Map variant TPOS IDs theo product_code
      const variantIdMap = variantsFromTPOS.reduce((acc, variant) => {
        acc[variant.DefaultCode] = {
          id: variant.Id,
          name: variant.Name
        };
        return acc;
      }, {} as Record<string, { id: number; name: string }>);

      // Lấy danh sách product_code của variants từ TPOS
      const variantCodes = Object.keys(variantIdMap);

      // Query các sản phẩm con đã có trong kho
      const { data: existingProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, product_code, product_name')
        .in('product_code', variantCodes);

      if (fetchError) throw fetchError;

      // So sánh để tìm variants còn thiếu
      const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);
      const missingCodes = variantCodes.filter(code => !existingCodes.has(code));

      // Prepare update data: chỉ update productid_bienthe nhưng phải include required fields
      const updates = (existingProducts || []).map(product => ({
        id: product.id,
        product_code: product.product_code,
        product_name: product.product_name,
        productid_bienthe: variantIdMap[product.product_code].id
      }));

      // Batch update nếu có sản phẩm cần update
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .upsert(updates, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (updateError) throw updateError;
      }

      console.log(`✅ Đã cập nhật productid_bienthe cho ${updates.length}/${variantCodes.length} sản phẩm con`);

      // Trả về kết quả
      return {
        updated: updates.length,
        missing: missingCodes.map(code => `${code} (${variantIdMap[code].name})`)
      };

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi cập nhật variant IDs",
        description: error.message
      });
      throw error;
    }
  };
  
  
  const handleUpload = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm để upload",
      });
      return;
    }
    
    setIsUploading(true);
    setProgress([]);
    setCurrentIndex(0);
    
    // Initialize progress tracking
    const initialProgress: UploadProgress[] = items.map(item => ({
      itemId: item.id,
      code: item.product_code,
      name: item.product_name,
      variant: item.variant || null,
      status: 'pending' as UploadStatus
    }));
    setProgress(initialProgress);
    
    let successCount = 0;
    let errorCount = 0;
    const selectedItems = items.filter(item => selectedIds.has(item.id));
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Skip if not selected
      if (!selectedIds.has(item.id)) continue;
      
      const selectedIdx = selectedItems.findIndex(si => si.id === item.id);
      setCurrentIndex(selectedIdx + 1);
      
      // Update status to uploading
      setProgress(prev => prev.map((p) => 
        p.itemId === item.id ? { ...p, status: 'uploading' } : p
      ));
      
      try {
        // Validate input
        const code = item.product_code.trim().toUpperCase();
        const name = item.product_name.trim();
        
        if (!code || !name) {
          throw new Error("Thiếu mã hoặc tên sản phẩm");
        }

        // Get TPOS headers
        const headers = await getHeaders();
        
        // STEP 1: Check if product already exists
        const checkUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${code}`;
        const checkResponse = await fetch(checkUrl, { headers });
        const checkData = await checkResponse.json();
        
        if (checkData.value && checkData.value.length > 0) {
          throw new Error(`Sản phẩm đã tồn tại: ${checkData.value[0].Name}`);
        }
        
        // STEP 2: Parse variant string to AttributeLines
        const attributeLines = parseVariantString(item.variant || "");
        
        // STEP 3: Generate variants
        const variants = generateVariants(name, item.selling_price || 0, attributeLines);
        
        // STEP 4: Load image as Base64
        let imageBase64: string | null = null;
        if (item.product_images && item.product_images.length > 0) {
          imageBase64 = await loadImageAsBase64(item.product_images[0]);
        }
        
        // STEP 5: Build full payload
        const payload = {
          Id: 0,
          Name: name,
          Type: "product",
          ListPrice: item.selling_price || 0,
          PurchasePrice: item.unit_price || 0,
          DefaultCode: code,
          Image: imageBase64,
          ImageUrl: null,
          Thumbnails: [],
          AttributeLines: attributeLines,
          ProductVariants: variants,
          Active: true,
          SaleOK: true,
          PurchaseOK: true,
          UOMId: 1,
          UOMPOId: 1,
          CategId: 2,
          CompanyId: 1,
          Tracking: "none",
          InvoicePolicy: "order",
          PurchaseMethod: "receive",
          AvailableInPOS: true,
          DiscountSale: 0,
          DiscountPurchase: 0,
          StandardPrice: 0,
          Weight: 0,
          SaleDelay: 0,
          UOM: {
            Id: 1,
            Name: "Cái",
            Rounding: 0.001,
            Active: true,
            Factor: 1,
            FactorInv: 1,
            UOMType: "reference",
            CategoryId: 1,
            CategoryName: "Đơn vị"
          },
          UOMPO: {
            Id: 1,
            Name: "Cái",
            Rounding: 0.001,
            Active: true,
            Factor: 1,
            FactorInv: 1,
            UOMType: "reference",
            CategoryId: 1,
            CategoryName: "Đơn vị"
          },
          Categ: {
            Id: 2,
            Name: "Có thể bán",
            CompleteName: "Có thể bán",
            Type: "normal",
            PropertyCostMethod: "average",
            NameNoSign: "Co the ban",
            IsPos: true
          },
          Items: [],
          UOMLines: [],
          ComboProducts: [],
          ProductSupplierInfos: []
        };
        
        // STEP 6: Call TPOS API InsertV2
        const createUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
        const response = await fetch(createUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }

        // STEP 7: Handle response and fetch variants
        let tposProductId: number | null = null;
        
        if (response.status === 204) {
          // Success - No Content
          throw new Error("TPOS không trả về Product ID");
        } else if (response.ok) {
          // Success - With JSON response
          const tposResponse = await response.json();
          tposProductId = tposResponse.Id;
        }
        
        if (!tposProductId) {
          throw new Error("Không lấy được TPOS Product ID");
        }
        
        // STEP 7.5: Update parent product's tpos_product_id immediately
        console.log(`[Upload TPOS] Updating parent product ${code} with tpos_product_id=${tposProductId}`);
        
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            tpos_product_id: tposProductId,
            updated_at: new Date().toISOString()
          })
          .eq('product_code', code)
          .eq('base_product_code', code); // Parent luôn có base_product_code = product_code

        if (updateError) {
          console.error(`[Upload TPOS] Failed to update parent product:`, updateError);
          throw new Error(`Lỗi lưu tpos_product_id cho sản phẩm cha: ${updateError.message}`);
        }

        console.log(`[Upload TPOS] ✅ Saved tpos_product_id=${tposProductId} for parent ${code}`);
        
        // STEP 7.6: Update purchase_order_items with tpos_product_id
        console.log(`[Upload TPOS] Updating purchase_order_items for product_code=${code}`);
        
        const { error: poItemsError } = await supabase
          .from('purchase_order_items')
          .update({ 
            tpos_product_id: tposProductId,
            updated_at: new Date().toISOString()
          })
          .eq('product_code', code);

        if (poItemsError) {
          console.error(`[Upload TPOS] Failed to update purchase_order_items:`, poItemsError);
        } else {
          console.log(`[Upload TPOS] ✅ Updated purchase_order_items with tpos_product_id=${tposProductId}`);
        }
        
        // STEP 8: Fetch variants from TPOS
        const fetchUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=ProductVariants($expand=AttributeValues)`;
        const fetchResponse = await fetch(fetchUrl, { headers });
        
        if (!fetchResponse.ok) {
          throw new Error("Không thể lấy thông tin variants từ TPOS");
        }
        
        const productData = await fetchResponse.json();
        const variantsFromTPOS = productData.ProductVariants || [];
        
        // STEP 9: Check for conflicts
        const conflicts = await checkVariantConflicts(variantsFromTPOS);
        
        if (conflicts.length > 0) {
          // Show conflict dialog - pause upload
          setCurrentConflicts(conflicts);
          setCurrentVariantsData(variantsFromTPOS);
          setCurrentItem(item);
          setCurrentTPOSProductId(tposProductId);
          setShowConflictDialog(true);
          
          // Mark as pending conflict resolution
          setProgress(prev => prev.map((p) => 
            p.itemId === item.id 
              ? { ...p, status: 'uploading', error: `Chờ xử lý ${conflicts.length} conflicts...` } 
              : p
          ));
          
          // IMPORTANT: Don't increment success count yet
          // Wait for user to resolve conflicts
          return; // Exit early, will continue after conflict resolution
        } else {
          // No conflicts - update variant IDs only
          const result = await updateVariantTPOSIds(variantsFromTPOS, item, tposProductId);

          successCount++;
          setProgress(prev => prev.map((p) => 
            p.itemId === item.id 
              ? { ...p, status: 'success', error: result.missing.length > 0 ? `Thiếu ${result.missing.length} variants` : undefined } 
              : p
          ));

          // Toast thông báo nếu có variants thiếu
          if (result.missing.length > 0) {
            toast({
              variant: "default",
              title: `⚠️ ${item.product_code} - Thiếu biến thể`,
              description: `Đã cập nhật ${result.updated} biến thể. Thiếu ${result.missing.length}:\n${result.missing.slice(0, 3).join('\n')}${result.missing.length > 3 ? `\n...và ${result.missing.length - 3} biến thể khác` : ''}`,
              duration: 8000
            });
          }
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, status: 'error', error: errorMessage } : p
        ));
        
        console.error(`Failed to upload ${item.product_code}:`, error);
      }
      
      // Delay 500ms between uploads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsUploading(false);
    
    // Show summary toast
    if (successCount > 0) {
      toast({
        title: "✅ Upload hoàn tất",
        description: `Thành công: ${successCount}/${selectedIds.size} sản phẩm${errorCount > 0 ? `, Lỗi: ${errorCount}` : ''}`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } else {
      toast({
        variant: "destructive",
        title: "❌ Upload thất bại",
        description: "Không có sản phẩm nào được upload thành công",
      });
    }
  };
  
  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  const getStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Thành công</Badge>;
      case 'error':
        return <Badge variant="destructive">Lỗi</Badge>;
      case 'uploading':
        return <Badge variant="secondary">Đang upload...</Badge>;
      default:
        return <Badge variant="outline">Chờ</Badge>;
    }
  };
  
  const progressPercentage = selectedIds.size > 0 ? (currentIndex / selectedIds.size) * 100 : 0;
  
  return (
    <>
      <VariantConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={currentConflicts}
        onResolve={handleResolveConflicts}
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload sản phẩm lên TPOS (InsertV2)</DialogTitle>
          <DialogDescription>
            {selectedIds.size > 0 
              ? `Đã chọn ${selectedIds.size}/${totalProducts} sản phẩm để upload` 
              : `${totalProducts} sản phẩm có sẵn`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Đang upload: {currentIndex}/{selectedIds.size}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          )}
          
          {/* Products Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có sản phẩm nào để upload
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={isUploading}
                      />
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const itemProgress = progress.find(p => p.itemId === item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            disabled={isUploading}
                          />
                        </TableCell>
                        <TableCell>
                          {itemProgress && getStatusIcon(itemProgress.status)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.product_code}
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>
                          {item.variant || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.selling_price || 0).toLocaleString('vi-VN')}₫
                        </TableCell>
                        <TableCell className="text-right">
                          {itemProgress ? (
                            <div className="space-y-1">
                              {getStatusBadge(itemProgress.status)}
                              {itemProgress.error && (
                                <p className="text-xs text-red-500 mt-1">
                                  {itemProgress.error}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">Chờ</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Đóng
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedIds.size === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Đang upload...' : `Upload ${selectedIds.size} sản phẩm`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}