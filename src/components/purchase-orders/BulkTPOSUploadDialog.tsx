import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, XCircle, Clock, Package, Database, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TPOSProductItem } from "@/lib/tpos-api";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { uploadTPOSFromInventoryVariants } from "@/lib/tpos-variant-upload-from-inventory";
import { useProductVariants } from "@/hooks/use-product-variants";

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
  const [uploadMode, setUploadMode] = useState<'inventory' | 'manual'>('inventory');
  
  const totalProducts = items.length;
  
  // Load variants from inventory for preview (only for first selected item)
  const firstSelectedItem = items.find(item => selectedIds.has(item.id));
  const { data: inventoryVariants } = useProductVariants(firstSelectedItem?.product_code || '');
  
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

  // Helper: Auto-detect attribute type
  const detectAttributeType = (values: string[]): number => {
    if (values.every(v => /^\d+$/.test(v))) return 4; // Size Số
    if (values.every(v => v.length <= 4 && /^[A-Z]+$/i.test(v))) return 1; // Size Chữ
    return 3; // Màu
  };

  const parseVariantString = (variantStr: string): AttributeLine[] => {
    if (!variantStr || variantStr.trim() === '') return [];
    
    const trimmed = variantStr.trim();
    
    // ✅ NEW FORMAT: "(S | M) (31 | 30 | 2) (ĐỎ | ĐEN | NÂU)"
    const groupPattern = /\(([^)]+)\)/g;
    const groups: string[] = [];
    let match;
    
    while ((match = groupPattern.exec(trimmed)) !== null) {
      groups.push(match[1]);
    }
    
    if (groups.length > 0) {
      const attributeLines: AttributeLine[] = [];
      
      for (const group of groups) {
        const values = group.split('|').map(v => v.trim()).filter(v => v.length > 0);
        if (values.length === 0) continue;
        
        const detectedAttributeId = detectAttributeType(values);
        
        if (detectedAttributeId === 4) {
          // Size Số
          const line: AttributeLine = {
            Attribute: { Id: 4, Name: "Size Số", Code: "SZNu", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 4
          };
          
          for (const val of values) {
            const match = availableAttributes.sizeNumber.values.find(v => v.Name === val);
            if (match) {
              line.Values.push({
                Id: match.Id,
                Name: match.Name,
                Code: match.Code,
                Sequence: match.Sequence,
                AttributeId: 4,
                AttributeName: "Size Số",
                PriceExtra: null,
                NameGet: `Size Số: ${match.Name}`,
                DateCreated: null
              });
            }
          }
          
          if (line.Values.length > 0) attributeLines.push(line);
        } else if (detectedAttributeId === 1) {
          // Size Chữ
          const line: AttributeLine = {
            Attribute: { Id: 1, Name: "Size Chữ", Code: "SZCh", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 1
          };
          
          for (const val of values) {
            const match = availableAttributes.sizeText.values.find(
              v => v.Name.toUpperCase() === val.toUpperCase()
            );
            if (match) {
              line.Values.push({
                Id: match.Id,
                Name: match.Name,
                Code: match.Code,
                Sequence: match.Sequence,
                AttributeId: 1,
                AttributeName: "Size Chữ",
                PriceExtra: null,
                NameGet: `Size Chữ: ${match.Name}`,
                DateCreated: null
              });
            }
          }
          
          if (line.Values.length > 0) attributeLines.push(line);
        } else {
          // Màu
          const line: AttributeLine = {
            Attribute: { Id: 3, Name: "Màu", Code: "Mau", Sequence: null, CreateVariant: true },
            Values: [],
            AttributeId: 3
          };
          
          for (const val of values) {
            const match = availableAttributes.color.values.find(
              v => v.Name.toUpperCase() === val.toUpperCase()
            );
            if (match) {
              line.Values.push({
                Id: match.Id,
                Name: match.Name,
                Code: match.Code,
                Sequence: match.Sequence,
                AttributeId: 3,
                AttributeName: "Màu",
                PriceExtra: null,
                NameGet: `Màu: ${match.Name}`,
                DateCreated: null
              });
            }
          }
          
          if (line.Values.length > 0) attributeLines.push(line);
        }
      }
      
      return attributeLines;
    }
    
    // ✅ FALLBACK: Old comma-separated format
    const parts = trimmed.split(',').map(s => s.trim().toUpperCase());
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

  // Update productid_bienthe only for existing products
  const updateVariantTPOSIds = async (
    variantsFromTPOS: any[],
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

      const variantCodes = Object.keys(variantIdMap);

      const { data: existingProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, product_code, product_name')
        .in('product_code', variantCodes);

      if (fetchError) throw fetchError;

      const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);
      const missingCodes = variantCodes.filter(code => !existingCodes.has(code));

      const updates = (existingProducts || []).map(product => ({
        id: product.id,
        product_code: product.product_code,
        product_name: product.product_name,
        productid_bienthe: variantIdMap[product.product_code].id
      }));

      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .upsert(updates, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (updateError) throw updateError;
      }

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

  // Upload using variants from inventory (3-step process)
  const handleInventoryUpload = async (item: TPOSProductItem) => {
    // ✅ Extract base product code from product_code
    const baseCode = item.product_code.includes('-') 
      ? item.product_code.split('-')[0] 
      : item.product_code;
    
    const result = await uploadTPOSFromInventoryVariants(
      baseCode,
      (msg) => {
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, error: msg } : p
        ));
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    if (result.variantsUploaded) {
      toast({
        title: `✅ ${baseCode}`,
        description: `Đã upload ${result.variantsUploaded} variants`,
        duration: 3000
      });
    }
  };

  // Manual upload using existing logic (1-step InsertV2)
  const handleManualUpload = async (item: TPOSProductItem) => {
    const code = item.product_code.trim().toUpperCase();
    const name = item.product_name.trim();
    
    if (!code || !name) {
      throw new Error("Thiếu mã hoặc tên sản phẩm");
    }

    const headers = await getHeaders();
    
    // Check if product exists
    const checkUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${code}`;
    const checkResponse = await fetch(checkUrl, { headers });
    const checkData = await checkResponse.json();
    
    if (checkData.value && checkData.value.length > 0) {
      throw new Error(`Sản phẩm đã tồn tại: ${checkData.value[0].Name}`);
    }
    
    // Parse and generate
    const attributeLines = parseVariantString(item.variant || "");
    const variants = generateVariants(name, item.selling_price || 0, attributeLines);
    
    let imageBase64: string | null = null;
    if (item.product_images && item.product_images.length > 0) {
      imageBase64 = await loadImageAsBase64(item.product_images[0]);
    }
    
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

    const tposResponse = await response.json();
    const tposProductId = tposResponse.Id;
    
    if (!tposProductId) {
      throw new Error("Không lấy được TPOS Product ID");
    }
    
    // Update database
    await supabase
      .from('products')
      .update({ 
        tpos_product_id: tposProductId,
        updated_at: new Date().toISOString()
      })
      .eq('product_code', code)
      .eq('base_product_code', code);

    await supabase
      .from('purchase_order_items')
      .update({ 
        tpos_product_id: tposProductId,
        updated_at: new Date().toISOString()
      })
      .eq('product_code', code);
    
    // Fetch and update variants
    const fetchUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=ProductVariants($expand=AttributeValues)`;
    const fetchResponse = await fetch(fetchUrl, { headers });
    
    if (!fetchResponse.ok) {
      throw new Error("Không thể lấy thông tin variants từ TPOS");
    }
    
    const productData = await fetchResponse.json();
    const variantsFromTPOS = productData.ProductVariants || [];
    
    const result = await updateVariantTPOSIds(variantsFromTPOS, item, tposProductId);

    if (result.missing.length > 0) {
      toast({
        variant: "default",
        title: `⚠️ ${item.product_code}`,
        description: `Thiếu ${result.missing.length} variants trong kho`,
        duration: 5000
      });
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
      
      if (!selectedIds.has(item.id)) continue;
      
      const selectedIdx = selectedItems.findIndex(si => si.id === item.id);
      setCurrentIndex(selectedIdx + 1);
      
      setProgress(prev => prev.map((p) => 
        p.itemId === item.id ? { ...p, status: 'uploading' } : p
      ));
      
      try {
        if (uploadMode === 'inventory') {
          await handleInventoryUpload(item);
        } else {
          await handleManualUpload(item);
        }
        successCount++;
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, status: 'success' } : p
        ));
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, status: 'error', error: errorMessage } : p
        ));
        console.error(`Failed to upload ${item.product_code}:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsUploading(false);
    
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload sản phẩm lên TPOS</DialogTitle>
          <DialogDescription>
            {selectedIds.size > 0 
              ? `Đã chọn ${selectedIds.size}/${totalProducts} sản phẩm để upload` 
              : `${totalProducts} sản phẩm có sẵn`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Upload Mode Selection */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="text-sm font-semibold mb-3 block">Chế độ upload</Label>
            <RadioGroup value={uploadMode} onValueChange={(v) => setUploadMode(v as 'inventory' | 'manual')} disabled={isUploading}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="inventory" id="inventory" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="inventory" className="font-medium cursor-pointer flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Upload từ kho (Khuyến nghị)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sử dụng variants đã có trong kho. Logic 3-step: Preview → Save → Verify
                  </p>
                  {inventoryVariants && inventoryVariants.length > 0 && selectedIds.size === 1 && (
                    <div className="mt-2 p-2 bg-primary/5 rounded border border-primary/20">
                      <p className="text-xs font-medium text-primary">
                        📦 {inventoryVariants.length} variants: {inventoryVariants.slice(0, 3).map(v => v.variant).join(', ')}
                        {inventoryVariants.length > 3 && '...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="manual" id="manual" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="manual" className="font-medium cursor-pointer flex items-center gap-2">
                    <FileEdit className="w-4 h-4" />
                    Upload thủ công
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Parse variant text thủ công. Logic 1-step: InsertV2
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Đang upload ({uploadMode === 'inventory' ? '3-step' : '1-step'}): {currentIndex}/{selectedIds.size}</span>
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
  );
}
