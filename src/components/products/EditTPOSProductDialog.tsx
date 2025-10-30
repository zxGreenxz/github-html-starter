import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2, X, Package } from "lucide-react";
import { toast } from "sonner";
import { updateTPOSProductDetails, type TPOSProductFullDetails, type TPOSUpdateProductPayload } from "@/lib/tpos-api";
import { useImagePaste } from "@/hooks/use-image-paste";
import { VariantSelectorDialog } from "./VariantSelectorDialog";
import { convertVariantsToAttributeLines, generateProductVariants } from "@/lib/tpos-variant-converter";
import { upsertProductFromTPOS } from "@/lib/tpos-product-sync";
import { formatVariantFromTPOSAttributeLines } from "@/lib/variant-utils";
import { getTPOSBearerToken } from "@/lib/tpos-order-details-fetcher";

const formSchema = z.object({
  name: z.string().min(1, "Tên sản phẩm không được để trống"),
  purchasePrice: z.coerce.number().min(0, "Giá mua phải >= 0"),
  listPrice: z.coerce.number().min(0, "Giá bán phải >= 0"),
  qtyAvailable: z.coerce.number().min(0, "Số lượng phải >= 0"),
});

interface EditTPOSProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: TPOSProductFullDetails | null;
  onSuccess?: () => void;
}

export function EditTPOSProductDialog({ 
  open, 
  onOpenChange, 
  product,
  onSuccess 
}: EditTPOSProductDialogProps) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string>("");
  const [isVariantSelectorOpen, setIsVariantSelectorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableVariants, setEditableVariants] = useState<Record<number, { NameGet: string }>>({});
  
  useImagePaste((base64) => {
    setImageBase64(base64);
    toast.success("Đã paste ảnh");
  }, open);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      purchasePrice: 0,
      listPrice: 0,
      qtyAvailable: 0,
    }
  });
  
  useEffect(() => {
    if (product && open) {
      form.reset({
        name: product.Name,
        purchasePrice: product.PurchasePrice,
        listPrice: product.ListPrice,
        qtyAvailable: product.QtyAvailable,
      });
      setImageBase64(null);
      
      // ✅ Parse AttributeLines từ TPOS → Variant string
      console.log('📦 [Edit Dialog] Raw product.AttributeLines:', JSON.stringify(product.AttributeLines, null, 2));
      
      const variantString = formatVariantFromTPOSAttributeLines(product.AttributeLines);
      setSelectedVariants(variantString);
      
      console.log('🔄 [Edit Dialog] Auto-filled variants from AttributeLines:', variantString);
      
      // ✅ Initialize editable variants with current NameGet values
      if (product.ProductVariants && product.ProductVariants.length > 0) {
        const initialVariants: Record<number, { NameGet: string }> = {};
        product.ProductVariants.forEach(variant => {
          initialVariants[variant.Id] = {
            NameGet: variant.NameGet || variant.Name
          };
        });
        setEditableVariants(initialVariants);
      }
    }
  }, [product, open, form]);
  
  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!product) return;
    
    setIsSaving(true);
    
    try {
      // ✅ CRITICAL: Deep clone the ENTIRE product object from API
      // This ensures all fields are preserved (TPOS requires round-trip pattern)
      const payload: any = JSON.parse(JSON.stringify(product));
      
      // ✅ CRITICAL: Clean up nested objects that TPOS API doesn't accept
      if (payload.UOM) delete payload.UOM;
      if (payload.UOMPO) delete payload.UOMPO;
      if (payload.Categ) delete payload.Categ;
      if (payload.POSCateg) delete payload.POSCateg;
      if (payload.Taxes) delete payload.Taxes;
      if (payload.SupplierTaxes) delete payload.SupplierTaxes;
      if (payload.Product_Teams) delete payload.Product_Teams;
      if (payload.Images) delete payload.Images;
      if (payload.UOMView) delete payload.UOMView;
      if (payload.Distributor) delete payload.Distributor;
      if (payload.Importer) delete payload.Importer;
      if (payload.Producer) delete payload.Producer;
      if (payload.OriginCountry) delete payload.OriginCountry;
      
      // ✅ Clean AttributeLines nested objects
      if (payload.AttributeLines) {
        payload.AttributeLines = payload.AttributeLines.map((line: any) => ({
          AttributeId: line.AttributeId,
          ValueIds: line.ValueIds || line.Values?.map((v: any) => v.Id) || []
        }));
      }
      
      // ✅ Only override the fields that user edited
      payload.Name = data.name;
      payload.ListPrice = data.listPrice;
      payload.PurchasePrice = data.purchasePrice;
      payload.StandardPrice = data.purchasePrice;
      
      // ✅ Handle Image correctly
      let imageData: string | undefined = undefined;
      if (imageBase64) {
        // imageBase64 có dạng "data:image/png;base64,..." → lấy phần sau dấu ,
        imageData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      }
      
      if (imageData) {
        // User pasted new image → Update it
        payload.Image = imageData;
        payload.ImageUrl = null;
        if (payload.Images) payload.Images = [];
      } else if (product.Image) {
        // No new image, keep existing from API
        payload.Image = product.Image;
      }
      
      // ✅ Check if we can update variants (theo file mẫu line 287-295)
      const hasStock = product.ProductVariants && 
        product.ProductVariants.some(v => 
          (v.QtyAvailable || 0) > 0 || (v.VirtualAvailable || 0) > 0
        );
      
      // ✅ CHỈ regenerate khi KHÔNG CÓ STOCK
      if (!hasStock && selectedVariants && selectedVariants !== "") {
        console.log("🔄 No stock found, regenerating variants based on new attributes...");
        
        // Convert selectedVariants sang AttributeLines format
        const attributeLines = await convertVariantsToAttributeLines(selectedVariants);
        
        if (attributeLines.length > 0) {
          // Update payload với AttributeLines và ProductVariants mới
          payload.AttributeLines = attributeLines;
          payload.ProductVariants = generateProductVariants(
            data.name,
            data.listPrice,
            attributeLines,
            imageData || product.Image || undefined,
            product.Id,
            product
          );
          
          console.log(`✅ Generated ${payload.ProductVariants.length} variants from AttributeLines`);
        }
      } else if (hasStock) {
        console.log("📦 Stock found, skipping variant structure update.");
      } else {
        console.log("ℹ️ No variant changes, keeping original structure.");
      }
      
      // ✅ Clean ProductVariants nested objects and update NameGet
      if (payload.ProductVariants) {
        payload.ProductVariants = payload.ProductVariants.map((variant: any) => {
          // Remove nested objects
          const cleanedVariant: any = { ...variant };
          delete cleanedVariant.UOM;
          delete cleanedVariant.UOMPO;
          delete cleanedVariant.Categ;
          delete cleanedVariant.POSCateg;
          delete cleanedVariant.AttributeValues; // ⚠️ CRITICAL: Remove nested AttributeValues
          
          // Remove quantity fields
          delete cleanedVariant.QtyAvailable;
          delete cleanedVariant.VirtualAvailable;
          
          // Update NameGet if edited
          const editedNameGet = editableVariants[variant.Id]?.NameGet;
          if (editedNameGet && editedNameGet !== (variant.NameGet || variant.Name)) {
            console.log(`🔄 Updating variant ${variant.Id} NameGet: "${variant.NameGet || variant.Name}" → "${editedNameGet}"`);
            cleanedVariant.NameGet = editedNameGet;
          }
          
          return cleanedVariant;
        });
      }
      
      console.log("🧹 [Edit Dialog] Cleaned payload - removed nested objects");
      
      console.log("📤 [Edit Dialog] Submitting FULL product payload (all fields preserved)");
      console.log("📋 [Edit Dialog] Total fields:", Object.keys(payload).length);
      console.log("📋 [Edit Dialog] Has AttributeLines:", !!payload.AttributeLines);
      console.log("📋 [Edit Dialog] Variants count:", payload.ProductVariants?.length || 0);
      
      await updateTPOSProductDetails(payload);
      
      // ✅ Fetch lại từ TPOS và upsert vào local DB
      console.log("🔄 Fetching updated product from TPOS...");
      try {
        const bearerToken = await getTPOSBearerToken();
        const syncResult = await upsertProductFromTPOS(
          product.DefaultCode, 
          bearerToken
        );

        if (syncResult.success) {
          console.log("✅ Synced to local DB:", syncResult.message);
          toast.success(`Cập nhật thành công! ${syncResult.message}`);
        } else {
          console.warn("⚠️ TPOS update OK but sync failed:", syncResult.message);
          toast.success("Đã cập nhật TPOS (nhưng chưa đồng bộ về local)");
        }
      } catch (syncError) {
        console.error("⚠️ Sync error:", syncError);
        toast.success("Đã cập nhật TPOS (nhưng chưa đồng bộ về local)");
      }
      
      onSuccess?.();
      
    } catch (error: any) {
      console.error('❌ Error updating product:', error);
      toast.error(error.message || "Cập nhật thất bại");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteImage = () => {
    setImageBase64(null);
    toast.info("Đã xóa ảnh");
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa sản phẩm TPOS</DialogTitle>
            <DialogDescription>
              Mã: {product?.DefaultCode} | ID: {product?.Id}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên sản phẩm</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nhập tên sản phẩm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <FormLabel>Hình ảnh (Ctrl+V để paste)</FormLabel>
                <div className="border-2 border-dashed rounded-lg p-4 min-h-[200px] flex items-center justify-center relative bg-muted/10">
                  {imageBase64 ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img 
                        src={imageBase64} 
                        alt="Pasted" 
                        className="max-h-[180px] max-w-full object-contain rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={handleDeleteImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : product?.ImageUrl ? (
                    <img 
                      src={product.ImageUrl} 
                      alt="Current" 
                      className="max-h-[180px] max-w-full object-contain rounded"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nhấn Ctrl+V để paste ảnh</p>
                      <p className="text-xs mt-1">Hoặc giữ nguyên ảnh hiện tại</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <FormLabel>Biến thế</FormLabel>
                <div className="flex gap-2">
                  <Input
                    value={selectedVariants}
                    readOnly
                    placeholder="(Cam | Đỏ | Vàng)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsVariantSelectorOpen(true)}
                  >
                    Chọn biến thể
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giá mua</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="listPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giá bán</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="qtyAvailable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tổng SL thực tế</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        placeholder="0"
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {product?.ProductVariants && product.ProductVariants.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    Danh sách biến thể từ TPOS ({product.ProductVariants.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>TÊN BIẾN THỂ (NAMEGET)</TableHead>
                          <TableHead>MÃ SP CON</TableHead>
                          <TableHead className="text-right">SL THỰC TẾ</TableHead>
                          <TableHead className="text-right">GIÁ BÁN</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {product.ProductVariants.map((variant) => (
                          <TableRow key={variant.Id}>
                            <TableCell className="font-medium">
                              <Input
                                value={editableVariants[variant.Id]?.NameGet || variant.NameGet || variant.Name}
                                onChange={(e) => {
                                  setEditableVariants(prev => ({
                                    ...prev,
                                    [variant.Id]: { NameGet: e.target.value }
                                  }));
                                }}
                                className="min-w-[200px]"
                                placeholder="Tên biến thể"
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {variant.DefaultCode}
                            </TableCell>
                            <TableCell className="text-right">
                              {variant.QtyAvailable}
                            </TableCell>
                            <TableCell className="text-right">
                              {variant.ListPrice.toLocaleString('vi-VN')} đ
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <VariantSelectorDialog
        open={isVariantSelectorOpen}
        onOpenChange={setIsVariantSelectorOpen}
        selectedVariants={selectedVariants}
        onVariantsChange={setSelectedVariants}
      />
    </>
  );
}
