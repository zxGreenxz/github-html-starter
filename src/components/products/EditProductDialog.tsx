import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Sparkles, Loader2, AlertCircle, Info } from "lucide-react";
import { GeneratedVariant } from "@/lib/variant-generator";
import { formatVariantForDisplay } from "@/lib/variant-display-utils";
import { syncVariantsFromTPOS } from "@/lib/tpos-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { uploadTPOSFromInventoryVariants } from "@/lib/tpos-variant-upload-from-inventory";

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
  const [uploadProgress, setUploadProgress] = useState<string>('');
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
    }
  }, [open]);

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

      // STEP 1: Update local DB
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

      // STEP 2: Cập nhật giá cho child variants có giá = 0 (nếu là parent)
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
      }

      // STEP 3: Upload lên TPOS (cho cả parent và child)
      setUploadProgress('Đang upload lên TPOS...');
      const baseCode = formData.base_product_code || product.product_code;
      
      try {
        const uploadResult = await uploadTPOSFromInventoryVariants(
          baseCode,
          (message) => {
            setUploadProgress(message);
          }
        );

        if (uploadResult.success) {
          toast({
            title: "✅ Hoàn tất",
            description: `Đã cập nhật và đồng bộ ${uploadResult.variantsUploaded || 0} variants lên TPOS`,
          });
        } else {
          // Upload failed nhưng local DB đã update
          toast({
            title: "⚠️ Cảnh báo",
            description: "Đã cập nhật local nhưng không thể đồng bộ TPOS: " + (uploadResult.error || "Unknown error"),
            variant: "default",
          });
        }
      } catch (uploadError: any) {
        console.error("Upload to TPOS error:", uploadError);
        toast({
          title: "⚠️ Cảnh báo",
          description: "Đã cập nhật local nhưng không thể đồng bộ TPOS: " + uploadError.message,
          variant: "default",
        });
      }

      setIsSubmitting(false);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      setIsSubmitting(false);
      toast({
        title: "❌ Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadProgress('');
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

          {/* ===== PREVIEW SECTION ===== */}
          <div className="space-y-2 pb-4 border-b">
            <h3 className="text-sm font-semibold text-muted-foreground">Preview Sản Phẩm</h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">Hình ảnh</TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Giá mua</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>NCC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {/* Hình ảnh */}
                    <TableCell>
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        📷
                      </div>
                    </TableCell>
                    
                    {/* Mã SP */}
                    <TableCell className="font-medium">
                      {product?.product_code || "-"}
                    </TableCell>
                    
                    {/* Tên sản phẩm */}
                    <TableCell>
                      {formData.product_name || "-"}
                    </TableCell>
                    
                    {/* Variant */}
                    <TableCell className="text-muted-foreground">
                      {formData.variant ? formatVariantForDisplay(formData.variant) : "-"}
                    </TableCell>
                    
                    {/* Base */}
                    <TableCell className="text-muted-foreground">
                      {formData.base_product_code || "-"}
                    </TableCell>
                    
                    {/* Giá bán */}
                    <TableCell className="text-right">
                      {formData.selling_price 
                        ? parseFloat(formData.selling_price).toLocaleString('vi-VN') + ' đ'
                        : "0 đ"
                      }
                    </TableCell>
                    
                    {/* Giá mua */}
                    <TableCell className="text-right">
                      {formData.purchase_price 
                        ? parseFloat(formData.purchase_price).toLocaleString('vi-VN') + ' đ'
                        : "0 đ"
                      }
                    </TableCell>
                    
                    {/* Tồn kho */}
                    <TableCell className="text-right">
                      {formData.stock_quantity || "0"}
                    </TableCell>
                    
                    {/* Nhóm */}
                    <TableCell className="text-muted-foreground">
                      {formData.category || "-"}
                    </TableCell>
                    
                    {/* NCC */}
                    <TableCell>
                      {formData.supplier_name || "-"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <Alert className="mb-4">
              <AlertDescription className="text-sm">
                ⏳ {uploadProgress}
              </AlertDescription>
            </Alert>
          )}

          {/* ===== PHẦN DƯỚI: Tabs ===== */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="price">Giá</TabsTrigger>
              <TabsTrigger value="variants">Biến thể</TabsTrigger>
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

            {/* TAB 3: Thông tin chung */}
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
    </Dialog>
  );
}
