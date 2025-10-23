import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVariantDetector } from "@/hooks/use-variant-detector";
import { VariantDetectionBadge } from "./VariantDetectionBadge";
import { VariantGeneratorDialog } from "@/components/purchase-orders/VariantGeneratorDialog";
import { Sparkles, Loader2, AlertCircle, Info, X } from "lucide-react";
import { GeneratedVariant } from "@/lib/variant-generator";
import { formatVariantForDisplay } from "@/lib/variant-display-utils";
import { syncVariantsFromTPOS } from "@/lib/tpos-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { TPOS_ATTRIBUTE_IDS } from "@/lib/tpos-variant-attributes-compat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  category?: string;
  barcode?: string;
  stock_quantity: number;
  supplier_name?: string;
  base_product_code?: string | null;
  tpos_product_id?: number | null;
  productid_bienthe?: number | null;
  virtual_available?: number | null;
}

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSuccess }: EditProductDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVariantGenerator, setShowVariantGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState("price");
  const [childProducts, setChildProducts] = useState<Product[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isSyncingTPOS, setIsSyncingTPOS] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncDiscrepancy, setSyncDiscrepancy] = useState<{
    missingInLocal: string[];
    missingInTPOS: string[];
  } | null>(null);
  const [hasRunSync, setHasRunSync] = useState(false);
  
  // TPOS Edit States
  const [tposProductData, setTposProductData] = useState<any>(null);
  const [tposAttributeLines, setTposAttributeLines] = useState<any[]>([]);
  const [showTPOSEditModal, setShowTPOSEditModal] = useState(false);
  const [tposAttributeTab, setTposAttributeTab] = useState<"sizeText" | "color" | "sizeNumber">("sizeText");
  const [isLoadingTPOS, setIsLoadingTPOS] = useState(false);
  
  const [formData, setFormData] = useState({
    product_name: "",
    variant: "",
    selling_price: "",
    purchase_price: "",
    unit: "",
    category: "",
    barcode: "",
    stock_quantity: "",
    supplier_name: "",
    base_product_code: "",
  });

  // Auto-detect variants from product name
  const { detectionResult, hasDetections } = useVariantDetector({
    productName: formData.product_name,
    variant: formData.variant,
    enabled: open,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        product_name: product.product_name,
        variant: product.variant || "",
        selling_price: product.selling_price.toString(),
        purchase_price: product.purchase_price.toString(),
        unit: product.unit,
        category: product.category || "",
        barcode: product.barcode || "",
        stock_quantity: product.stock_quantity.toString(),
        supplier_name: product.supplier_name || "",
        base_product_code: product.base_product_code || "",
      });
    }
  }, [product]);

  // Fetch child products when dialog opens
  useEffect(() => {
    const fetchChildProducts = async () => {
      if (!product || !open) {
        setChildProducts([]);
        return;
      }

      // Only fetch if this is a parent product (base_product_code points to itself)
      const isParent = product.base_product_code === product.product_code;
      if (!isParent) {
        setChildProducts([]);
        return;
      }

      setIsLoadingChildren(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("base_product_code", product.product_code)
          .neq("product_code", product.product_code) // Exclude parent itself
          .order("product_code", { ascending: true });

        if (error) throw error;
        setChildProducts(data || []);
      } catch (error) {
        console.error("Error fetching child products:", error);
        setChildProducts([]);
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildProducts();
  }, [product, open]);

  // Auto-sync variants from TPOS when switching to "variants" tab
  useEffect(() => {
    const autoSyncFromTPOS = async () => {
      // Only run if:
      // 1. Active tab is "variants"
      // 2. Dialog is open
      // 3. Product is a parent
      // 4. Not already syncing
      if (
        activeTab !== "variants" ||
        !open ||
        !product ||
        product.base_product_code !== product.product_code ||
        isSyncingTPOS ||
        hasRunSync
      ) {
        return;
      }

      setHasRunSync(true);
      setIsSyncingTPOS(true);
      console.log("🔄 Auto-syncing variants from TPOS...");

      try {
        const result = await syncVariantsFromTPOS(product.product_code);
        
      if (result.updated > 0) {
        setLastSyncTime(new Date());
        toast({
          title: "✅ Đồng bộ thành công",
          description: `Đã cập nhật ${result.updated} biến thể từ TPOS`,
        });
      } else if (result.skipped > 0 && result.errors.length === 0) {
        toast({
          title: "ℹ️ Không có biến thể",
          description: "Sản phẩm này chưa có biến thể trên TPOS",
        });
      }

      if (result.errors.length > 0) {
        console.error("Sync errors:", result.errors);
      }

      // Refresh child products list
      const { data: refreshedChildren } = await supabase
        .from("products")
        .select("*")
        .eq("base_product_code", product.product_code)
        .neq("product_code", product.product_code)
        .order("product_code", { ascending: true });

      if (refreshedChildren) {
        setChildProducts(refreshedChildren);
      }

      // Save and display discrepancies
      if (result.missingInLocal || result.missingInTPOS) {
        setSyncDiscrepancy({
          missingInLocal: result.missingInLocal || [],
          missingInTPOS: result.missingInTPOS || []
        });
      }

      // Show warning toast if discrepancies found
      const hasMissingInLocal = result.missingInLocal && result.missingInLocal.length > 0;
      const hasMissingInTPOS = result.missingInTPOS && result.missingInTPOS.length > 0;

      if (hasMissingInLocal || hasMissingInTPOS) {
        let warningMessage = "";
        
        if (hasMissingInTPOS) {
          warningMessage += `⚠️ THIẾU trên TPOS: ${result.missingInTPOS.length} biến thể (${result.missingInTPOS.slice(0, 3).join(', ')}${result.missingInTPOS.length > 3 ? '...' : ''})\n`;
        }
        
        if (hasMissingInLocal) {
          warningMessage += `⚠️ DƯ trên TPOS: ${result.missingInLocal.length} biến thể chưa có trong hệ thống (${result.missingInLocal.slice(0, 3).join(', ')}${result.missingInLocal.length > 3 ? '...' : ''})`;
        }
        
        toast({
          title: "⚠️ Phát hiện sự khác biệt",
          description: warningMessage,
          variant: "default",
          duration: 10000,
        });
      }
      } catch (error: any) {
        console.error("Auto-sync error:", error);
        toast({
          title: "⚠️ Lỗi đồng bộ",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsSyncingTPOS(false);
      }
    };

    autoSyncFromTPOS();
  }, [activeTab, open, product]);

  // Reset sync flag when dialog closes
  useEffect(() => {
    if (!open) {
      setHasRunSync(false);
      setSyncDiscrepancy(null);
      setLastSyncTime(null);
      setTposProductData(null);
      setTposAttributeLines([]);
    }
  }, [open]);

  // ========== TPOS HELPER FUNCTIONS ==========
  
  const reconstructAttributeLines = (variants: any[]) => {
    if (!variants || variants.length === 0) return [];

    const attributeMap: Record<number, any> = {};

    variants.forEach((variant) => {
      if (variant.AttributeValues && variant.AttributeValues.length > 0) {
        variant.AttributeValues.forEach((attrValue: any) => {
          const attrId = attrValue.AttributeId;

          if (!attributeMap[attrId]) {
            attributeMap[attrId] = {
              Attribute: {
                Id: attrId,
                Name: attrValue.AttributeName,
                Code: null,
                Sequence: null,
                CreateVariant: true,
              },
              Values: [],
              AttributeId: attrId,
            };
          }

          const existingValue = attributeMap[attrId].Values.find(
            (v: any) => v.Id === attrValue.Id
          );
          if (!existingValue) {
            attributeMap[attrId].Values.push({
              Id: attrValue.Id,
              Name: attrValue.Name,
              Code: attrValue.Code,
              Sequence: attrValue.Sequence,
              AttributeId: attrValue.AttributeId,
              AttributeName: attrValue.AttributeName,
              PriceExtra: null,
              NameGet: attrValue.NameGet,
              DateCreated: attrValue.DateCreated,
            });
          }
        });
      }
    });

    const attributeLines = Object.values(attributeMap);
    attributeLines.forEach((line: any) => {
      line.Values.sort((a: any, b: any) => {
        if (a.Sequence !== null && b.Sequence !== null) {
          return a.Sequence - b.Sequence;
        }
        return 0;
      });
    });

    return attributeLines;
  };

  const generateVariantsFromAttributes = (
    productName: string,
    listPrice: number,
    attributeLines: any[],
    imageBase64?: string
  ) => {
    if (!attributeLines || attributeLines.length === 0) return [];

    const combinations: any[][] = [];

    function getCombinations(lines: any[], current: any[] = [], index = 0) {
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

    return combinations.map((attrs) => {
      const variantName = attrs.map((a) => a.Name).join(", ");
      return {
        Id: 0,
        DefaultCode: null,
        NameTemplate: productName,
        ProductTmplId: tposProductData?.Id || 0,
        UOMId: 1,
        UOMPOId: 1,
        QtyAvailable: 0,
        NameGet: `${productName} (${variantName})`,
        Image: imageBase64,
        PriceVariant: listPrice,
        SaleOK: true,
        PurchaseOK: true,
        StandardPrice: listPrice,
        Active: true,
        Type: "product",
        CategId: 2,
        InvoicePolicy: "order",
        Name: `${productName} (${variantName})`,
        AvailableInPOS: true,
        AttributeValues: attrs.map((a) => ({
          Id: a.Id,
          Name: a.Name,
          AttributeId: a.AttributeId,
          AttributeName: a.AttributeName,
          NameGet: a.NameGet,
        })),
      };
    });
  };

  const addTPOSAttributeValue = (type: keyof typeof TPOS_ATTRIBUTES, valueId: number) => {
    const attrValues = TPOS_ATTRIBUTES[type];
    const selectedValue = attrValues.find(v => v.Id === valueId);
    if (!selectedValue) return;

    const attributeId = type === 'sizeText' ? TPOS_ATTRIBUTE_IDS.SIZE_TEXT 
      : type === 'color' ? TPOS_ATTRIBUTE_IDS.COLOR 
      : TPOS_ATTRIBUTE_IDS.SIZE_NUMBER;
    
    const attributeName = type === 'sizeText' ? "Size Chữ" 
      : type === 'color' ? "Màu" 
      : "Size Số";

    const attributeCode = type === 'sizeText' ? 'SZCh' 
      : type === 'color' ? 'Mau' 
      : 'SZNu';

    setTposAttributeLines(prev => {
      const updated = [...prev];
      let attrLine = updated.find(line => line.AttributeId === attributeId);
      
      if (!attrLine) {
        attrLine = {
          Attribute: {
            Id: attributeId,
            Name: attributeName,
            Code: attributeCode,
            Sequence: null,
            CreateVariant: true,
          },
          Values: [],
          AttributeId: attributeId,
        };
        updated.push(attrLine);
      }

      if (attrLine.Values.find((v: any) => v.Id === valueId)) {
        toast({ variant: "destructive", title: "Giá trị đã tồn tại" });
        return prev;
      }

      attrLine.Values.push({
        Id: selectedValue.Id,
        Name: selectedValue.Name,
        Code: selectedValue.Code,
        Sequence: selectedValue.Sequence,
        AttributeId: attributeId,
        AttributeName: attributeName,
        PriceExtra: null,
        NameGet: `${attributeName}: ${selectedValue.Name}`,
        DateCreated: null,
      });

      return updated;
    });
  };

  const removeTPOSAttributeValue = (type: keyof typeof TPOS_ATTRIBUTES, valueId: number) => {
    const attributeId = type === 'sizeText' ? TPOS_ATTRIBUTE_IDS.SIZE_TEXT 
      : type === 'color' ? TPOS_ATTRIBUTE_IDS.COLOR 
      : TPOS_ATTRIBUTE_IDS.SIZE_NUMBER;
    
    setTposAttributeLines(prev => {
      const updated = prev.map(line => {
        if (line.AttributeId === attributeId) {
          return {
            ...line,
            Values: line.Values.filter((v: any) => v.Id !== valueId)
          };
        }
        return line;
      }).filter(line => line.Values.length > 0);
      
      return updated;
    });
  };

  const handleSaveTPOSAttributeLines = () => {
    if (!tposProductData) return;

    const newVariants = generateVariantsFromAttributes(
      tposProductData.Name,
      tposProductData.ListPrice || 0,
      tposAttributeLines,
      tposProductData.Image
    );

    setTposProductData({
      ...tposProductData,
      AttributeLines: tposAttributeLines,
      ProductVariants: newVariants
    });

    setShowTPOSEditModal(false);
    toast({
      title: "✅ Thành công",
      description: `Đã tạo ${newVariants.length} variants mới`
    });
  };

  const fetchTPOSProductData = async () => {
    if (!product?.tpos_product_id) return;
    
    setIsLoadingTPOS(true);
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "❌ Lỗi",
          description: "Không có TPOS token"
        });
        return;
      }
      
      const url = `https://tomato.tpos.vn/odata/ProductTemplate(${product.tpos_product_id})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
      
      const response = await fetch(url, { headers: getTPOSHeaders(token) });
      
      if (!response.ok) {
        throw new Error("Không tìm thấy sản phẩm TPOS");
      }
      
      const data = await response.json();
      setTposProductData(data);
      
      // Load AttributeLines
      if (data.AttributeLines && data.AttributeLines.length > 0) {
        setTposAttributeLines(JSON.parse(JSON.stringify(data.AttributeLines)));
      } else if (data.ProductVariants && data.ProductVariants.length > 0) {
        const reconstructed = reconstructAttributeLines(data.ProductVariants);
        setTposAttributeLines(reconstructed);
        toast({
          title: "ℹ️ Thông báo",
          description: "Đã tái tạo AttributeLines từ variants hiện có"
        });
      }
      
      toast({
        title: "✅ Đã tải TPOS",
        description: `${data.Name} (${data.ProductVariants?.length || 0} variants)`
      });
    } catch (error: any) {
      console.error("Fetch TPOS error:", error);
      toast({
        variant: "destructive",
        title: "❌ Lỗi",
        description: error.message || "Không thể tải dữ liệu TPOS"
      });
    } finally {
      setIsLoadingTPOS(false);
    }
  };

  const submitTPOSUpdate = async () => {
    if (!tposProductData) return;
    
    setIsSubmitting(true);
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Không có TPOS token");
      }
      
      const response = await fetch(
        "https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2",
        {
          method: "POST",
          headers: getTPOSHeaders(token),
          body: JSON.stringify(tposProductData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${errorText.substring(0, 200)}`);
      }
      
      toast({
        title: "🎉 Thành công",
        description: "Đã cập nhật sản phẩm lên TPOS"
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch TPOS data when dialog opens and switches to tpos tab
  useEffect(() => {
    if (open && activeTab === "tpos" && product?.tpos_product_id && !tposProductData) {
      fetchTPOSProductData();
    }
  }, [open, activeTab, product?.tpos_product_id]);

  const handleVariantTextGenerated = (variantText: string) => {
    setFormData({ ...formData, variant: variantText });
    setShowVariantGenerator(false);
  };

  const handleVariantsRegenerated = async (data: {
    variants: GeneratedVariant[];
    variantText: string;
    attributeLines: any[];
  }) => {
    if (!product) return;

    setIsSubmitting(true);

    try {
      // STEP 1: Xóa tất cả variants cũ
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("base_product_code", product.product_code)
        .neq("product_code", product.product_code);

      if (deleteError) {
        throw deleteError;
      }

      // STEP 2: Tạo variants mới
      const newVariants = data.variants.map(v => {
        let finalProductCode = v.DefaultCode;

        // Logic đặc biệt: Nếu CHỈ có 1 attribute là "Size Số" → thêm chữ "A"
        if (data.attributeLines.length === 1 && data.attributeLines[0].attributeId === 4) {
          const baseCode = product.product_code;
          const sizeNumber = v.AttributeValues?.[0]?.Name || '';
          finalProductCode = `${baseCode}A${sizeNumber}`;
        }

        return {
          product_code: finalProductCode,
          product_name: v.Name,
          variant: v.AttributeValues?.map(av => av.Name).join(', ') || '',
          base_product_code: product.product_code,
          selling_price: parseFloat(formData.selling_price) || 0,
          purchase_price: parseFloat(formData.purchase_price) || 0,
          stock_quantity: 0,
          unit: formData.unit || 'Cái',
          category: formData.category || null,
          supplier_name: formData.supplier_name || null,
          tpos_product_id: null,
        };
      });

      const { error: insertError } = await supabase
        .from("products")
        .insert(newVariants);

      if (insertError) {
        throw insertError;
      }

      // STEP 3: Update variant string của parent product
      const { error: updateError } = await supabase
        .from("products")
        .update({ variant: data.variantText })
        .eq("id", product.id);

      if (updateError) {
        throw updateError;
      }

      // STEP 4: Update formData.variant trong React state
      setFormData(prev => ({
        ...prev,
        variant: data.variantText
      }));

      toast({
        title: "✅ Thành công",
        description: `Đã tạo lại ${newVariants.length} biến thể mới`,
      });

      setShowVariantGenerator(false);
      onSuccess(); // Refresh product list

      // Refresh child products list
      const { data: refreshedChildren } = await supabase
        .from("products")
        .select("*")
        .eq("base_product_code", product.product_code)
        .neq("product_code", product.product_code)
        .order("product_code", { ascending: true });

      if (refreshedChildren) {
        setChildProducts(refreshedChildren);
      }
    } catch (error: any) {
      console.error("Error regenerating variants:", error);
      toast({
        title: "❌ Lỗi",
        description: error.message || "Không thể tạo lại biến thể",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncProductToTPOS = async (
    parentProduct: any,
    variants: any[],
    listPrice: number,
    purchasePrice: number
  ) => {
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        console.log("⚠️ Không có TPOS token, bỏ qua sync");
        return;
      }

      let tposProductId = parentProduct.tpos_product_id;

      // B1: Nếu chưa có tpos_product_id, fetch từ TPOS
      if (!tposProductId) {
        const searchUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(parentProduct.product_code)}`;
        
        const searchResponse = await fetch(searchUrl, {
          headers: getTPOSHeaders(token),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.value && searchData.value.length > 0) {
            tposProductId = searchData.value[0].Id;
            
            // Save tpos_product_id to database
            await supabase
              .from("products")
              .update({ tpos_product_id: tposProductId })
              .eq("id", parentProduct.id);
          } else {
            console.log("⚠️ Không tìm thấy sản phẩm trên TPOS");
            return;
          }
        } else {
          console.log("⚠️ Lỗi khi search TPOS");
          return;
        }
      }

      // B2: GET full payload from TPOS
      const getUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
      
      const getResponse = await fetch(getUrl, {
        headers: getTPOSHeaders(token),
      });

      if (!getResponse.ok) {
        throw new Error("Không thể lấy thông tin sản phẩm từ TPOS");
      }

      const existingProduct = await getResponse.json();

      // B3: Build payload với OVERWRITE variants
      const variantTemplate = existingProduct.ProductVariants?.[0] || {};

      // Build ProductVariants hoàn toàn từ local data
      const newProductVariants = variants.map((localVariant) => ({
        Id: 0,
        DefaultCode: localVariant.product_code,
        NameTemplate: parentProduct.product_name,
        Name: localVariant.product_name,
        NameGet: `[${localVariant.product_code}] ${localVariant.product_name}`,
        ListPrice: localVariant.selling_price || listPrice,
        PurchasePrice: localVariant.purchase_price || purchasePrice,
        StandardPrice: localVariant.purchase_price || purchasePrice,
        PriceVariant: localVariant.selling_price || listPrice,
        LstPrice: 0,
        DiscountSale: null,
        DiscountPurchase: null,
        OldPrice: null,
        IsDiscount: false,
        EAN13: null,
        Barcode: localVariant.barcode || localVariant.product_code,
        QtyAvailable: 0,
        VirtualAvailable: 0,
        OutgoingQty: null,
        IncomingQty: null,
        ProductTmplId: tposProductId,
        Type: "product",
        SaleOK: true,
        PurchaseOK: true,
        Active: true,
        AvailableInPOS: true,
        InvoicePolicy: "order",
        PurchaseMethod: "receive",
        Tracking: variantTemplate.Tracking || null,
        UOMId: variantTemplate.UOMId || 1,
        UOMName: variantTemplate.UOMName || null,
        UOMPOId: variantTemplate.UOMPOId || 1,
        UOM: variantTemplate.UOM || null,
        UOMPO: variantTemplate.UOMPO || null,
        CategId: variantTemplate.CategId || 2,
        CategName: variantTemplate.CategName || null,
        Categ: variantTemplate.Categ || null,
        POSCategId: variantTemplate.POSCategId || null,
        POSCateg: variantTemplate.POSCateg || null,
        AttributeValues: variantTemplate.AttributeValues || [],
        DisplayAttributeValues: variantTemplate.DisplayAttributeValues || null,
        Weight: 0,
        Volume: null,
        Version: 0,
        Description: null,
        LastUpdated: null,
        DateCreated: null,
        NameNoSign: null,
        NameTemplateNoSign: null,
        PropertyCostMethod: null,
        PropertyValuation: null,
        CostMethod: null,
        Valuation: null,
        CompanyId: null,
        IsCombo: null,
        ProductTmplEnableAll: false,
        Variant_TeamId: 0,
        SaleDelay: 0,
        Image: null,
        ImageUrl: null,
        Thumbnails: [],
        TaxesIds: [],
        StockValue: null,
        SaleValue: null,
        PosSalesCount: null,
        Factor: null,
        AmountTotal: null,
        NameCombos: [],
        RewardName: null,
        Product_UOMId: null,
        Tags: null,
        InitInventory: null,
        OrderTag: "",
        StringExtraProperties: '{"OrderTag":null,"Thumbnails":[]}',
        CreatedById: null,
        TaxAmount: null,
        Price: null,
        Error: null,
      }));

      // Build final payload
      const updatedPayload = {
        ...existingProduct,
        ListPrice: listPrice,
        PurchasePrice: purchasePrice,
        StandardPrice: purchasePrice,
        ProductVariants: newProductVariants,
      };

      delete updatedPayload["@odata.context"];

      // POST to UpdateV2
      const updateUrl = "https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2";
      
      const updateResponse = await fetch(updateUrl, {
        method: "POST",
        headers: getTPOSHeaders(token),
        body: JSON.stringify(updatedPayload),
      });

      if (!updateResponse.ok && updateResponse.status !== 204) {
        const errorText = await updateResponse.text();
        throw new Error(`TPOS UpdateV2 failed: ${errorText.substring(0, 200)}`);
      }

      console.log("✅ Đã đồng bộ thành công lên TPOS (overwrite variants)");
    } catch (error: any) {
      console.error("❌ Lỗi khi sync TPOS:", error);
      toast({
        title: "⚠️ Cảnh báo",
        description: "Cập nhật local thành công nhưng không thể đồng bộ TPOS: " + error.message,
        variant: "default",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    // Validation không để trống
    if (!formData.base_product_code || formData.base_product_code.trim() === "") {
      toast({
        title: "Lỗi",
        description: "Base Product Code không được để trống",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedSellingPrice = parseFloat(formData.selling_price) || 0;
      const updatedPurchasePrice = parseFloat(formData.purchase_price) || 0;

      const { error } = await supabase
        .from("products")
        .update({
          product_name: formData.product_name,
          variant: formData.variant || null,
          selling_price: updatedSellingPrice,
          purchase_price: updatedPurchasePrice,
          unit: formData.unit,
          category: formData.category || null,
          barcode: formData.barcode || null,
          stock_quantity: parseInt(formData.stock_quantity) || 0,
          supplier_name: formData.supplier_name || null,
          base_product_code: formData.base_product_code,
        })
        .eq("id", product.id);

      if (error) throw error;

      // Nếu đây là parent product, cập nhật giá cho variants có giá = 0
      const isParentProduct = product.base_product_code === product.product_code;
      if (isParentProduct && product.product_code) {
        await supabase
          .from("products")
          .update({ selling_price: updatedSellingPrice })
          .eq("base_product_code", product.product_code)
          .eq("selling_price", 0);
        
        await supabase
          .from("products")
          .update({ purchase_price: updatedPurchasePrice })
          .eq("base_product_code", product.product_code)
          .eq("purchase_price", 0);

        // Sync to TPOS if parent product
        await syncProductToTPOS(
          product,
          childProducts,
          updatedSellingPrice,
          updatedPurchasePrice
        );
      }

      setIsSubmitting(false);
      toast({
        title: "Thành công",
        description: "Đã cập nhật sản phẩm và đồng bộ TPOS",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      setIsSubmitting(false);
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ===== PHẦN TRÊN: Fixed Header ===== */}
          <div className="space-y-4 pb-4 border-b">
            <div>
              <Label>Mã sản phẩm</Label>
              <Input value={product?.product_code || ""} disabled className="bg-muted" />
            </div>

            <div>
              <Label htmlFor="product_name">Tên sản phẩm *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Base Product Code</Label>
              <Input
                value={formData.base_product_code}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Có thể giống với Mã sản phẩm (parent tự trỏ chính nó)
              </p>
            </div>
          </div>

          {/* ===== PHẦN DƯỚI: Tabs ===== */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="price">Giá</TabsTrigger>
              <TabsTrigger value="variants">Biến thể</TabsTrigger>
              <TabsTrigger value="tpos">TPOS Sync</TabsTrigger>
              <TabsTrigger value="general">Thông tin chung</TabsTrigger>
            </TabsList>

            {/* TAB 1: Giá */}
            <TabsContent value="price" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="selling_price">Giá bán</Label>
                <Input
                  id="selling_price"
                  type="number"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="purchase_price">Giá mua</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  placeholder="0"
                />
              </div>
            </TabsContent>

            {/* TAB 2: Biến thể */}
            <TabsContent value="variants" className="space-y-6 mt-4">
              {/* Sync Status Indicator */}
              {isSyncingTPOS && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">Đang đồng bộ từ TPOS...</span>
                  </div>
                </div>
              )}

          {/* Last Sync Time */}
          {lastSyncTime && !isSyncingTPOS && (
            <div className="text-xs text-muted-foreground text-right">
              Đã đồng bộ lúc: {lastSyncTime.toLocaleTimeString('vi-VN')}
            </div>
          )}

          {/* Discrepancy Warning Badges */}
          {syncDiscrepancy && (syncDiscrepancy.missingInLocal.length > 0 || syncDiscrepancy.missingInTPOS.length > 0) && (
            <div className="space-y-2">
              {syncDiscrepancy.missingInTPOS.length > 0 && (
                <Alert variant="destructive" className="bg-orange-50 border-orange-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>THIẾU trên TPOS</AlertTitle>
                  <AlertDescription>
                    {syncDiscrepancy.missingInTPOS.length} biến thể có trong hệ thống nhưng không tìm thấy trên TPOS:
                    <div className="mt-2 text-xs font-mono">
                      {syncDiscrepancy.missingInTPOS.map((code, i) => (
                        <Badge key={i} variant="outline" className="mr-1 mb-1">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {syncDiscrepancy.missingInLocal.length > 0 && (
                <Alert variant="default" className="bg-blue-50 border-blue-300">
                  <Info className="h-4 w-4" />
                  <AlertTitle>DƯ trên TPOS</AlertTitle>
                  <AlertDescription>
                    {syncDiscrepancy.missingInLocal.length} biến thể có trên TPOS nhưng chưa import vào hệ thống:
                    <div className="mt-2 text-xs font-mono">
                      {syncDiscrepancy.missingInLocal.map((code, i) => (
                        <Badge key={i} variant="secondary" className="mr-1 mb-1">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

              {/* Section 1: Thuộc tính */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Thuộc tính</h3>
                <div>
                  <Label htmlFor="variant">Giá trị thuộc tính</Label>
                  <div className="flex gap-2">
                    <Input
                      id="variant"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      placeholder="(1 | 2 | 3) (S | M | L)"
                      readOnly
                      className="bg-muted"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowVariantGenerator(true)}
                      title="Tạo biến thể tự động"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                  {hasDetections && (
                    <VariantDetectionBadge detectionResult={detectionResult} className="mt-2" />
                  )}
                </div>
              </div>

              {/* Section 2: Danh sách biến thể */}
              {product?.base_product_code === product?.product_code && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Biến thể ({childProducts.length})
                  </h3>
                  
                  {isLoadingChildren ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Đang tải danh sách biến thể...
                    </div>
                  ) : childProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Chưa có biến thể nào. Nhấn nút ✨ để tạo biến thể.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">STT</TableHead>
                            <TableHead>Tên</TableHead>
                            <TableHead className="w-32 text-right">Giá bán</TableHead>
                            <TableHead className="w-24 text-right">Tồn kho</TableHead>
                            <TableHead className="w-24 text-right">Tồn ảo</TableHead>
                            <TableHead className="w-20 text-right text-xs">TPOS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {childProducts.map((child, index) => (
                            <TableRow key={child.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">[{child.product_code}] {child.product_name}</div>
                                  {child.variant && (
                                    <div className="text-xs text-muted-foreground">
                                      ({formatVariantForDisplay(child.variant)})
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {child.selling_price?.toLocaleString('vi-VN') || '0'}
                              </TableCell>
                              <TableCell className="text-right">
                                {child.stock_quantity || 0}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {child.virtual_available || 0}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {child.productid_bienthe || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: TPOS Sync */}
            <TabsContent value="tpos" className="space-y-4 mt-4">
              {isLoadingTPOS ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Đang tải dữ liệu TPOS...</span>
                </div>
              ) : tposProductData ? (
                <div className="space-y-4">
                  {/* TPOS Product Info */}
                  <Alert>
                    <AlertTitle>Sản phẩm TPOS</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-1">
                        <div><strong>ID:</strong> {tposProductData.Id}</div>
                        <div><strong>Mã:</strong> {tposProductData.DefaultCode}</div>
                        <div><strong>Tên:</strong> {tposProductData.Name}</div>
                        <div><strong>Variants:</strong> {tposProductData.ProductVariants?.length || 0}</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  {/* Edit Variants Button */}
                  <Button 
                    onClick={() => setShowTPOSEditModal(true)}
                    className="w-full"
                    variant="outline"
                  >
                    📝 Chỉnh Sửa Biến Thể TPOS
                  </Button>
                  
                  {/* Variants List */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Danh sách variants ({tposProductData.ProductVariants?.length || 0})</h3>
                    <ScrollArea className="h-[300px] border rounded-md">
                      <div className="p-4 space-y-3">
                        {tposProductData.ProductVariants?.map((variant: any, index: number) => (
                          <div key={variant.Id || index} className="border p-3 rounded bg-muted/50">
                            <p className="font-bold text-sm mb-2">{variant.Name}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Giá Bán</Label>
                                <Input
                                  type="number"
                                  value={variant.PriceVariant || 0}
                                  onChange={(e) => {
                                    const updated = {...tposProductData};
                                    updated.ProductVariants[index].PriceVariant = parseFloat(e.target.value) || 0;
                                    setTposProductData(updated);
                                  }}
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Giá Mua</Label>
                                <Input
                                  type="number"
                                  value={variant.StandardPrice || 0}
                                  onChange={(e) => {
                                    const updated = {...tposProductData};
                                    updated.ProductVariants[index].StandardPrice = parseFloat(e.target.value) || 0;
                                    setTposProductData(updated);
                                  }}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  {/* Submit Button */}
                  <Button 
                    onClick={submitTPOSUpdate}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? "⏳ Đang cập nhật..." : "💾 Cập Nhật Lên TPOS"}
                  </Button>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    {product?.tpos_product_id 
                      ? "Nhấn vào tab này để tải dữ liệu TPOS" 
                      : "Sản phẩm chưa có TPOS Product ID"}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* TAB 4: Thông tin chung */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="unit">Đơn vị</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  disabled
                  className="bg-muted"
                  placeholder="Cái"
                />
              </div>

              <div>
                <Label htmlFor="category">Nhóm sản phẩm</Label>
                <Input
                  id="category"
                  value={formData.category}
                  disabled
                  className="bg-muted"
                  placeholder="Nhập nhóm sản phẩm"
                />
              </div>

              <div>
                <Label htmlFor="stock_quantity">Số lượng tồn</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  disabled
                  className="bg-muted"
                  placeholder="0"
                />
                {product?.base_product_code === product?.product_code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tồn kho parent = tổng tồn kho các biến thể
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="barcode">Mã vạch</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  disabled
                  className="bg-muted"
                  placeholder="Nhập mã vạch"
                />
              </div>

              <div>
                <Label htmlFor="supplier_name">Nhà cung cấp</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  disabled
                  className="bg-muted"
                  placeholder="Nhập tên nhà cung cấp"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* ===== FOOTER: Action buttons ===== */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Cập nhật"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Variant Generator Dialog */}
      {product && (
        <VariantGeneratorDialog
          open={showVariantGenerator}
          onOpenChange={setShowVariantGenerator}
          currentItem={{
            product_code: product.product_code,
            product_name: formData.product_name,
            variant: formData.variant,
            selling_price: parseFloat(formData.selling_price) || 0,
            purchase_price: parseFloat(formData.purchase_price) || 0,
          }}
          onVariantsRegenerated={handleVariantsRegenerated}
        />
      )}

      {/* TPOS Edit Attribute Modal */}
      <Dialog open={showTPOSEditModal} onOpenChange={setShowTPOSEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📝 Chỉnh Sửa Biến Thể TPOS</DialogTitle>
          </DialogHeader>
          
          <Tabs value={tposAttributeTab} onValueChange={(v) => setTposAttributeTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sizeText">Size Chữ</TabsTrigger>
              <TabsTrigger value="color">Màu</TabsTrigger>
              <TabsTrigger value="sizeNumber">Size Số</TabsTrigger>
            </TabsList>
            
            {/* Size Text Tab */}
            <TabsContent value="sizeText" className="space-y-4">
              <Select onValueChange={(v) => addTPOSAttributeValue("sizeText", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn size chữ --" />
                </SelectTrigger>
                <SelectContent>
                  {TPOS_ATTRIBUTES.sizeText.map(val => (
                    <SelectItem key={val.Id} value={val.Id.toString()}>{val.Name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="min-h-16 p-3 bg-muted rounded-lg flex flex-wrap gap-2">
                {tposAttributeLines
                  .find(line => line.AttributeId === TPOS_ATTRIBUTE_IDS.SIZE_TEXT)
                  ?.Values.map((val: any) => (
                    <Badge key={val.Id} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                      {val.Name}
                      <button
                        onClick={() => removeTPOSAttributeValue("sizeText", val.Id)}
                        className="ml-1 hover:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </Badge>
                  )) || <p className="text-muted-foreground text-sm">Chưa có giá trị</p>}
              </div>
            </TabsContent>
            
            {/* Color Tab */}
            <TabsContent value="color" className="space-y-4">
              <Select onValueChange={(v) => addTPOSAttributeValue("color", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn màu --" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TPOS_ATTRIBUTES.color.map(val => (
                    <SelectItem key={val.Id} value={val.Id.toString()}>{val.Name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="min-h-16 p-3 bg-muted rounded-lg flex flex-wrap gap-2">
                {tposAttributeLines
                  .find(line => line.AttributeId === TPOS_ATTRIBUTE_IDS.COLOR)
                  ?.Values.map((val: any) => (
                    <Badge key={val.Id} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                      {val.Name}
                      <button
                        onClick={() => removeTPOSAttributeValue("color", val.Id)}
                        className="ml-1 hover:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </Badge>
                  )) || <p className="text-muted-foreground text-sm">Chưa có giá trị</p>}
              </div>
            </TabsContent>
            
            {/* Size Number Tab */}
            <TabsContent value="sizeNumber" className="space-y-4">
              <Select onValueChange={(v) => addTPOSAttributeValue("sizeNumber", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn size số --" />
                </SelectTrigger>
                <SelectContent>
                  {TPOS_ATTRIBUTES.sizeNumber.map(val => (
                    <SelectItem key={val.Id} value={val.Id.toString()}>{val.Name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="min-h-16 p-3 bg-muted rounded-lg flex flex-wrap gap-2">
                {tposAttributeLines
                  .find(line => line.AttributeId === TPOS_ATTRIBUTE_IDS.SIZE_NUMBER)
                  ?.Values.map((val: any) => (
                    <Badge key={val.Id} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                      {val.Name}
                      <button
                        onClick={() => removeTPOSAttributeValue("sizeNumber", val.Id)}
                        className="ml-1 hover:bg-white/30 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </Badge>
                  )) || <p className="text-muted-foreground text-sm">Chưa có giá trị</p>}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTPOSEditModal(false)}>
              ❌ Hủy
            </Button>
            <Button 
              onClick={handleSaveTPOSAttributeLines} 
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={tposAttributeLines.length === 0}
            >
              ✅ Tạo {tposAttributeLines.length > 0 ? tposAttributeLines.reduce((acc, line) => acc * line.Values.length, 1) : 0} Variants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
