import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, CheckSquare, Square, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToTPOS, generateTPOSExcel, type TPOSProductItem } from "@/lib/tpos-api";
import { createTPOSVariants } from "@/lib/tpos-variant-creator";
import { formatVND } from "@/lib/currency-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVariantType } from "@/lib/tpos-variant-attributes-compat";
import { detectVariantsFromText } from "@/lib/variant-detector";
import { generateAllVariants } from "@/lib/variant-generator-adapter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExportTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

export function ExportTPOSDialog({ open, onOpenChange, items, onSuccess }: ExportTPOSDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(item => item.id)));
  const [imageFilter, setImageFilter] = useState<"all" | "with-images" | "without-images" | "uploaded-tpos" | "not-uploaded-tpos">("all");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);

  // Filter items based on image filter
  const filteredItems = useMemo(() => {
    switch (imageFilter) {
      case "with-images":
        return items.filter(item => item.product_images && item.product_images.length > 0);
      case "without-images":
        return items.filter(item => !item.product_images || item.product_images.length === 0);
      case "uploaded-tpos":
        return items.filter(item => item.tpos_product_id);
      case "not-uploaded-tpos":
        return items.filter(item => !item.tpos_product_id);
      default:
        return items;
    }
  }, [items, imageFilter]);

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const itemsWithImages = items.filter(
    (item) => item.product_images && item.product_images.length > 0
  );
  const itemsWithoutImages = items.filter(
    (item) => !item.product_images || item.product_images.length === 0
  );
  const itemsUploadedToTPOS = items.filter(item => item.tpos_product_id);
  const itemsNotUploadedToTPOS = items.filter(item => !item.tpos_product_id);

  // Toggle individual item
  const toggleItem = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Toggle all filtered items
  const toggleAll = () => {
    const allFilteredIds = filteredItems.map(item => item.id);
    const allSelected = allFilteredIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all filtered items
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        // Select all filtered items
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id));
  const isSomeSelected = selectedItems.length > 0 && !isAllSelected;

  const handleDownloadExcel = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }

    // Check if any selected items already have TPOS ID
    const itemsWithTPOS = selectedItems.filter(item => item.tpos_product_id);
    if (itemsWithTPOS.length > 0) {
      toast({
        title: "⚠️ Cảnh báo",
        description: `${itemsWithTPOS.length} sản phẩm đã có TPOS ID. Bạn có chắc muốn tải lại?`,
      });
    }

    try {
      const excelBlob = generateTPOSExcel(selectedItems);
      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TPOS_Export_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "📥 Tải xuống thành công",
        description: `Đã tạo file Excel với ${selectedItems.length} sản phẩm`,
      });
    } catch (error) {
      toast({
        title: "❌ Lỗi",
        description: "Không thể tạo file Excel",
        variant: "destructive",
      });
    }
  };

  /**
   * Create product entries in inventory
   * - If multiple variants (comma-separated): split into separate products with unique codes
   * - Quantity is divided equally among variants
   * - Example: TEST with variants "Trắng, Đen, Tím" & quantity 3 → TESTT (Trắng, qty 1), TESTD (Đen, qty 1), TESTT1 (Tím, qty 1)
   * - Example: M900 with variants "Xanh Đậu, Đỏ, Đen, Xanh Đen" & quantity 4 → 4 products, each with qty 1
   */
  const createVariantProductsInInventory = async (
    rootProductCode: string,
    variants: Array<{ variant: string | null; item: TPOSProductItem }>,
    tposProductId: number | null
  ): Promise<number> => {
    let createdCount = 0;
    
    // Get all existing variant codes for this root product to avoid duplicates
    const { data: existingVariants } = await supabase
      .from("products")
      .select("product_code, variant")
      .like("product_code", `${rootProductCode}%`);
    
    const usedCodes = new Set<string>();
    existingVariants?.forEach(p => {
      const suffix = p.product_code.substring(rootProductCode.length);
      if (suffix) usedCodes.add(suffix);
    });
    
    console.log(`📦 ${rootProductCode}: Existing codes: ${Array.from(usedCodes).join(', ') || 'none'}`);
    
    // Collect ALL variants that need to be created with their quantities
    const allVariantsToCreate: Array<{ variantName: string; item: TPOSProductItem; quantity: number }> = [];
    
    for (const { variant, item } of variants) {
      if (!variant || !variant.trim()) {
        // No variant - add as single product with original quantity
        allVariantsToCreate.push({ variantName: '', item, quantity: item.quantity || 1 });
        continue;
      }
      
      // Split variants by comma
      const variantList = variant.split(',').map(v => v.trim()).filter(Boolean);
      const totalQuantity = item.quantity || 1;
      
      // Detect all variants and categorize them by type
      const sizeTextVariants: string[] = [];
      const sizeNumberVariants: string[] = [];
      const colorVariants: string[] = [];
      
      for (const v of variantList) {
        const detection = detectVariantsFromText(v);
        
        if (detection.sizeText.length > 0) {
          sizeTextVariants.push(v);
        } else if (detection.sizeNumber.length > 0) {
          sizeNumberVariants.push(v);
        } else if (detection.colors.length > 0) {
          colorVariants.push(v);
        }
      }
      
      // Count how many attribute types we have (ignore unknown)
      const hasMultipleTypes = 
        [sizeTextVariants.length > 0, sizeNumberVariants.length > 0, colorVariants.length > 0]
          .filter(Boolean).length > 1;
      
      console.log(`  Detected: ${sizeTextVariants.length} size text, ${colorVariants.length} colors, ${sizeNumberVariants.length} size numbers`);
      
      if (hasMultipleTypes) {
        // Create cartesian product of all attribute types
        console.log(`  🔄 Creating cartesian product: ${sizeTextVariants.length} size text × ${colorVariants.length} colors × ${sizeNumberVariants.length} size numbers`);
        
        // Start with base combinations
        let combinations: string[] = [''];
        
        // Add size text combinations
        if (sizeTextVariants.length > 0) {
          const newCombinations: string[] = [];
          for (const base of combinations) {
            for (const size of sizeTextVariants) {
              newCombinations.push(base ? `${base}, ${size}` : size);
            }
          }
          combinations = newCombinations;
        }
        
        // Add color combinations
        if (colorVariants.length > 0) {
          const newCombinations: string[] = [];
          for (const base of combinations) {
            for (const color of colorVariants) {
              newCombinations.push(base ? `${base}, ${color}` : color);
            }
          }
          combinations = newCombinations;
        }
        
        // Add size number combinations
        if (sizeNumberVariants.length > 0) {
          const newCombinations: string[] = [];
          for (const base of combinations) {
            for (const sizeNum of sizeNumberVariants) {
              newCombinations.push(base ? `${base}, ${sizeNum}` : sizeNum);
            }
          }
          combinations = newCombinations;
        }
        
        const quantityPerVariant = Math.floor(totalQuantity / combinations.length);
        console.log(`  ✅ Created ${combinations.length} combinations, ${quantityPerVariant} qty each:`, combinations);
        
        for (const combo of combinations) {
          allVariantsToCreate.push({ variantName: combo, item, quantity: quantityPerVariant });
        }
      } else {
        // Single type - just split normally
        const quantityPerVariant = Math.floor(totalQuantity / variantList.length);
        console.log(`  📦 Single type: ${variantList.length} variants, total qty ${totalQuantity} → ${quantityPerVariant} per variant`);
        
        for (const variantItem of variantList) {
          allVariantsToCreate.push({ variantName: variantItem, item, quantity: quantityPerVariant });
        }
      }
    }
    
    console.log(`  Total variants to create: ${allVariantsToCreate.length}`);
    
    // Now create each variant as a separate product
    if (allVariantsToCreate.length === 1 && !allVariantsToCreate[0].variantName) {
      // Single product without variant
      const { item, quantity } = allVariantsToCreate[0];
      console.log(`  Creating single product: ${rootProductCode} (qty: ${quantity})`);
      
      // Check if exists
      const { data: existing } = await supabase
        .from("products")
        .select("product_code, stock_quantity")
        .eq("product_code", rootProductCode)
        .maybeSingle();
      
      if (existing) {
        // Update stock
        const { error } = await supabase
          .from("products")
          .update({
            stock_quantity: (existing.stock_quantity || 0) + quantity,
            purchase_price: item.unit_price || 0,
            selling_price: item.selling_price || 0,
            tpos_product_id: tposProductId
          })
          .eq("product_code", rootProductCode);
        
        if (!error) {
          createdCount++;
          // Update purchase_order_items
          await supabase
            .from('purchase_order_items')
            .update({ tpos_product_id: tposProductId })
            .eq('product_code', rootProductCode);
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: rootProductCode,
            product_name: item.product_name,
            variant: null,
            purchase_price: item.unit_price || 0,
            selling_price: item.selling_price || 0,
            supplier_name: item.supplier_name || '',
            product_images: item.product_images?.length > 0 ? item.product_images : null,
            price_images: item.price_images?.length > 0 ? item.price_images : null,
            stock_quantity: quantity,
            unit: 'Cái',
            tpos_product_id: tposProductId
          });
        
        if (!error) createdCount++;
      }
    } else if (allVariantsToCreate.length === 1) {
      // Single variant
      const { variantName, item, quantity } = allVariantsToCreate[0];
      console.log(`  Creating single variant: ${rootProductCode} (${variantName}, qty: ${quantity})`);
      
      // Check if exists
      const { data: existing } = await supabase
        .from("products")
        .select("product_code, stock_quantity")
        .eq("product_code", rootProductCode)
        .maybeSingle();
      
      if (existing) {
        // Update stock
        const { error } = await supabase
          .from("products")
          .update({
            stock_quantity: (existing.stock_quantity || 0) + quantity,
            purchase_price: item.unit_price || 0,
            selling_price: item.selling_price || 0,
            tpos_product_id: tposProductId
          })
          .eq("product_code", rootProductCode);
        
        if (!error) {
          createdCount++;
          // Update purchase_order_items
          await supabase
            .from('purchase_order_items')
            .update({ tpos_product_id: tposProductId })
            .eq('product_code', rootProductCode);
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: rootProductCode,
            product_name: item.product_name,
            variant: variantName,
            purchase_price: item.unit_price || 0,
            selling_price: item.selling_price || 0,
            supplier_name: item.supplier_name || '',
            product_images: item.product_images?.length > 0 ? item.product_images : null,
            price_images: item.price_images?.length > 0 ? item.price_images : null,
            stock_quantity: quantity,
            unit: 'Cái',
            tpos_product_id: tposProductId
          });
        
        if (!error) {
          createdCount++;
          // Update purchase_order_items
          await supabase
            .from('purchase_order_items')
            .update({ tpos_product_id: tposProductId })
            .eq('product_code', rootProductCode);
        }
      }
    } else {
      // Multiple variants - create separate products with unique codes
      console.log(`  Splitting ${allVariantsToCreate.length} variants for ${rootProductCode}`);
      
      // FIRST: Create base product (without variant) as required
      const firstItem = allVariantsToCreate[0].item;
      const { data: baseProduct } = await supabase
        .from("products")
        .select("product_code, stock_quantity")
        .eq("product_code", rootProductCode)
        .maybeSingle();
      
      if (baseProduct) {
        console.log(`    Base product ${rootProductCode} already exists`);
      } else {
        // Create base product without variant
        console.log(`    Creating base product: ${rootProductCode} (no variant)`);
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: rootProductCode,
            product_name: firstItem.product_name,
            variant: null,
            purchase_price: firstItem.unit_price || 0,
            selling_price: firstItem.selling_price || 0,
            supplier_name: firstItem.supplier_name || '',
            product_images: firstItem.product_images?.length > 0 ? firstItem.product_images : null,
            price_images: firstItem.price_images?.length > 0 ? firstItem.price_images : null,
            stock_quantity: 0, // Base product has 0 stock, variants hold the stock
            unit: 'Cái',
            tpos_product_id: tposProductId
          });
        
        if (!error) {
          console.log(`    ✅ Created base product: ${rootProductCode}`);
          createdCount++;
          // Update purchase_order_items
          await supabase
            .from('purchase_order_items')
            .update({ tpos_product_id: tposProductId })
            .eq('product_code', rootProductCode);
        } else {
          console.error(`    ❌ Failed to create base product ${rootProductCode}:`, error);
        }
      }
      
      // THEN: Create variant products with unique codes using generateAllVariants
      
      // Step 1: Collect all unique attributes from variants
      const sizeTexts: string[] = [];
      const colors: string[] = [];
      const sizeNumbers: string[] = [];
      
      for (const { variantName } of allVariantsToCreate) {
        const variantParts = variantName.split(',').map(v => v.trim()).filter(Boolean);
        
        for (const part of variantParts) {
          const detection = detectVariantsFromText(part);
          
          if (detection.sizeText.length > 0) {
            const value = detection.sizeText[0].value;
            if (!sizeTexts.includes(value)) sizeTexts.push(value);
          }
          if (detection.colors.length > 0) {
            const value = detection.colors[0].value;
            if (!colors.includes(value)) colors.push(value);
          }
          if (detection.sizeNumber.length > 0) {
            const value = detection.sizeNumber[0].value;
            if (!sizeNumbers.includes(value)) sizeNumbers.push(value);
          }
        }
      }
      
      console.log(`    📦 Detected attributes - Size text: [${sizeTexts.join(', ')}], Colors: [${colors.join(', ')}], Size numbers: [${sizeNumbers.join(', ')}]`);
      
      // Step 2: Generate ALL variants using the standard generator
      const generatedVariants = generateAllVariants({
        productCode: rootProductCode,
        productName: firstItem.product_name,
        sizeTexts,
        colors,
        sizeNumbers
      });
      
      console.log(`    ✅ Generated ${generatedVariants.length} variants using standard generator`);
      
      // Step 3: Match each local variant to generated variant and create products
      for (const { variantName, item, quantity } of allVariantsToCreate) {
        // Parse variant parts to match with generated variants
        const variantParts = variantName.split(',').map(v => v.trim()).filter(Boolean);
        
        let sizeText: string | null = null;
        let color: string | null = null;
        let sizeNumber: string | null = null;
        
        for (const part of variantParts) {
          const detection = detectVariantsFromText(part);
          
          if (detection.sizeText.length > 0 && !sizeText) {
            sizeText = detection.sizeText[0].value;
          }
          if (detection.colors.length > 0 && !color) {
            color = detection.colors[0].value;
          }
          if (detection.sizeNumber.length > 0 && !sizeNumber) {
            sizeNumber = detection.sizeNumber[0].value;
          }
        }
        
        // Find matching generated variant by comparing variant text
        const normalizeVariant = (v: string) => v.split(',').map(s => s.trim()).sort().join(',');
        const targetVariant = normalizeVariant(variantName);
        
        const matchedVariant = generatedVariants.find(gv => {
          const gvNormalized = normalizeVariant(gv.variantText);
          return gvNormalized === targetVariant;
        });
        
        if (!matchedVariant) {
          console.error(`    ❌ Could not match variant: ${variantName} (size: ${sizeText}, color: ${color}, num: ${sizeNumber})`);
          continue;
        }
        
        const variantProductCode = matchedVariant.fullCode;
        const fullProductName = matchedVariant.productName;
        
        console.log(`    Creating: ${variantProductCode} (${variantName} -> ${fullProductName}, qty: ${quantity})`);
        
        // Check if product already exists
        const { data: existing } = await supabase
          .from("products")
          .select("product_code, stock_quantity")
          .eq("product_code", variantProductCode)
          .maybeSingle();
        
        if (existing) {
          // Update existing product - add to stock quantity
          const { error } = await supabase
            .from("products")
            .update({
              stock_quantity: (existing.stock_quantity || 0) + quantity,
              purchase_price: item.unit_price || 0,
              selling_price: item.selling_price || 0,
              product_images: item.product_images?.length > 0 ? item.product_images : null,
              price_images: item.price_images?.length > 0 ? item.price_images : null,
              tpos_product_id: tposProductId
            })
            .eq("product_code", variantProductCode);
          
          if (!error) {
            createdCount++;
            console.log(`    ✅ Updated: ${variantProductCode} (${variantName}, added qty: ${quantity})`);
            // Update purchase_order_items
            await supabase
              .from('purchase_order_items')
              .update({ tpos_product_id: tposProductId })
              .eq('product_code', variantProductCode);
          } else {
            console.error(`    ❌ Failed to update ${variantProductCode}:`, error);
          }
        } else {
          // Insert new product
          const { error } = await supabase
            .from("products")
            .insert({
              product_code: variantProductCode,
              product_name: fullProductName,
              variant: variantName,
              purchase_price: item.unit_price || 0,
              selling_price: item.selling_price || 0,
              supplier_name: item.supplier_name || '',
              product_images: item.product_images?.length > 0 ? item.product_images : null,
              price_images: item.price_images?.length > 0 ? item.price_images : null,
              stock_quantity: quantity,
              unit: 'Cái',
              tpos_product_id: tposProductId
            });
          
          if (!error) {
            createdCount++;
            console.log(`    ✅ Created: ${variantProductCode} (${variantName}, qty: ${quantity})`);
            // Update purchase_order_items
            await supabase
              .from('purchase_order_items')
              .update({ tpos_product_id: tposProductId })
              .eq('product_code', variantProductCode);
          } else {
            console.error(`    ❌ Failed to create ${variantProductCode}:`, error);
          }
        }
      }
    }
    
    return createdCount;
  };

  const handleUploadToTPOS = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }

    // Check if any selected items already have TPOS ID
    const itemsWithTPOS = selectedItems.filter(item => item.tpos_product_id);
    if (itemsWithTPOS.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Cảnh báo: ${itemsWithTPOS.length} sản phẩm đã có TPOS ID.\n\nBạn có chắc muốn upload lại không?`
      );
      if (!confirmed) return;
    }

    setIsUploading(true);
    setProgress(0);
    setCurrentStep("Đang bắt đầu...");

    try {
      console.log(`📦 Processing ${selectedItems.length} selected items...`);
      
      // Prepare items for upload - use product_code and variant from each item directly
      const itemsToUpload: TPOSProductItem[] = selectedItems.map(item => ({
        ...item,
        product_code: item.product_code, // Use exact product code from item
        variant: item.variant || null,   // Use exact variant from item
      }));

      console.log(`📤 Uploading ${itemsToUpload.length} items to TPOS...`);
      setCurrentStep(`Đang upload ${itemsToUpload.length} sản phẩm...`);

      // Upload to TPOS
      const uploadResult = await uploadToTPOS(
        itemsToUpload,
        (step, total, message) => {
          setProgress((step / total) * 100);
          setCurrentStep(message);
        }
      );

      setProgress(100);
      setCurrentStep("Hoàn thành!");

      // Save result for JSON display
      const finalResult = {
        totalSuccess: uploadResult.successCount,
        totalFailed: uploadResult.failedCount,
        errors: uploadResult.errors,
        timestamp: new Date().toISOString()
      };
      setUploadResult(finalResult);

      // Show toast
      toast({
        title: uploadResult.failedCount === 0 ? "🎉 Upload thành công!" : "⚠️ Upload hoàn tất",
        description: (
          <div className="space-y-2">
            <div className="font-semibold">Kết quả upload:</div>
            <div className="space-y-1 text-sm">
              <p>✅ Thành công: {uploadResult.successCount} sản phẩm</p>
              {uploadResult.failedCount > 0 && (
                <p className="text-destructive">❌ Thất bại: {uploadResult.failedCount} sản phẩm</p>
              )}
            </div>
            {uploadResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-destructive font-semibold">
                  ❌ Xem {uploadResult.errors.length} lỗi
                </summary>
                <div className="mt-2 space-y-1 text-xs max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((error, i) => (
                    <div key={i} className="border-l-2 border-destructive pl-2">
                      <p className="font-medium">{error.productName}</p>
                      <p className="text-destructive">{error.errorMessage}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ),
        duration: 10000,
      });

      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Upload error:", errorMessage);
      
      toast({
        title: "❌ Lỗi upload lên TPOS",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export & Upload lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Đã chọn</p>
              <p className="text-2xl font-bold text-primary">{selectedItems.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Có hình ảnh</p>
              <p className="text-2xl font-bold text-green-600">{itemsWithImages.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Đã upload TPOS</p>
              <p className="text-2xl font-bold text-blue-600">{itemsUploadedToTPOS.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Chưa upload</p>
              <p className="text-2xl font-bold text-orange-600">{itemsNotUploadedToTPOS.length}</p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Lọc sản phẩm:</span>
            <Select value={imageFilter} onValueChange={(value: any) => setImageFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả ({items.length})</SelectItem>
                <SelectItem value="with-images">Có hình ảnh ({itemsWithImages.length})</SelectItem>
                <SelectItem value="without-images">Không có ảnh ({itemsWithoutImages.length})</SelectItem>
                <SelectItem value="uploaded-tpos">Đã upload TPOS ({itemsUploadedToTPOS.length})</SelectItem>
                <SelectItem value="not-uploaded-tpos">Chưa upload TPOS ({itemsNotUploadedToTPOS.length})</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="ml-auto"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Bỏ chọn tất cả
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Chọn tất cả
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{currentStep}</span>
                    <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⏳ Đang xử lý {selectedItems.length} sản phẩm. Vui lòng không đóng cửa sổ này...
              </p>
            </div>
          )}

          {/* Upload Result JSON */}
          {uploadResult && (
            <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
              <Card className="border-dashed border-green-600">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                      {isJsonOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Upload Result:</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(uploadResult, null, 2));
                          toast({
                            title: "Đã sao chép",
                            description: "JSON đã được sao chép vào clipboard",
                          });
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <ScrollArea className="h-[300px] w-full rounded-md border bg-muted p-4">
                      <pre className="text-xs">
                        {JSON.stringify(uploadResult, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Preview Table */}
          <div className="border rounded-lg">
            <div className="p-3 bg-muted border-b">
              <h3 className="font-semibold">
                Danh sách sản phẩm ({filteredItems.length} sản phẩm)
              </h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Chọn tất cả"
                      />
                    </TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead>Hình ảnh</TableHead>
                    <TableHead>TPOS Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow 
                      key={item.id}
                      className={selectedIds.has(item.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                          aria-label={`Chọn ${item.product_code}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.product_code}
                      </TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>
                        {item.variant ? (
                          <Badge variant="secondary" className="text-xs">
                            {item.variant}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatVND(item.selling_price || 0)}
                      </TableCell>
                      <TableCell>
                        {item.product_images && item.product_images.length > 0 ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ {item.product_images.length}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Không có</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.tpos_product_id ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ ID: {item.tpos_product_id}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Chưa upload</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Hủy
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadExcel}
            disabled={isUploading || selectedItems.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Chỉ tải Excel ({selectedItems.length})
          </Button>
          <Button
            onClick={handleUploadToTPOS}
            disabled={isUploading || selectedItems.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload lên TPOS ({selectedItems.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
