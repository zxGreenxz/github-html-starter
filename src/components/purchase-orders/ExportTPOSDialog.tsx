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
import { getVariantType, generateColorCode } from "@/lib/variant-attributes";
import { detectVariantsFromText } from "@/lib/variant-detector";
import { generateAllVariants } from "@/lib/variant-code-generator";
import { useQuery } from "@tanstack/react-query";
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

  // Get unique base product codes from filtered items
  const baseProductCodes = useMemo(() => {
    const codes = new Set<string>();
    filteredItems.forEach(item => {
      const baseCode = item.base_product_code || item.product_code?.match(/^[A-Z]+\d+/)?.[0] || item.product_code || 'AUTO';
      codes.add(baseCode);
    });
    return Array.from(codes);
  }, [filteredItems]);

  // Query base products to get their variant field and product name
  const { data: baseProductVariants = [] } = useQuery({
    queryKey: ["base-product-variants", baseProductCodes],
    queryFn: async () => {
      if (baseProductCodes.length === 0) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("product_code, product_name, variant")
        .in("product_code", baseProductCodes)
        .not("variant", "is", null);
      
      if (error) {
        console.error("Error fetching base product variants:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: baseProductCodes.length > 0
  });

  // Group items by base_product_code
  const groupedItems = useMemo(() => {
    const groups = new Map<string, {
      baseProductCode: string;
      variants: string[];
      items: TPOSProductItem[];
      baseItem: TPOSProductItem;
      allSelected: boolean;
    }>();

    for (const item of filteredItems) {
      const baseCode = item.base_product_code || item.product_code?.match(/^[A-Z]+\d+/)?.[0] || item.product_code || 'AUTO';
      
      if (!groups.has(baseCode)) {
        groups.set(baseCode, {
          baseProductCode: baseCode,
          variants: [],
          items: [],
          baseItem: item,
          allSelected: false
        });
      }

      const group = groups.get(baseCode)!;
      group.items.push(item);

      // Use item with base_product_code as baseItem, or first item with images
      if (item.base_product_code === baseCode || 
          (item.product_images && item.product_images.length > 0 && !group.baseItem.product_images)) {
        group.baseItem = item;
      }
    }

    // Add variant from base product (single variant string from inventory)
    groups.forEach(group => {
      const baseProduct = baseProductVariants.find(pv => pv.product_code === group.baseProductCode);
      if (baseProduct?.variant) {
        // Store as single string, not split into array
        group.variants = [baseProduct.variant];
      } else {
        group.variants = [];
      }
    });

    // Check if all items in each group are selected
    groups.forEach(group => {
      group.allSelected = group.items.every(item => selectedIds.has(item.id));
    });

    return Array.from(groups.values());
  }, [filteredItems, selectedIds, baseProductVariants]);

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

  // Toggle group (all items in the group)
  const toggleGroup = (group: typeof groupedItems[0]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (group.allSelected) {
        // Deselect all items in group
        group.items.forEach(item => next.delete(item.id));
      } else {
        // Select all items in group
        group.items.forEach(item => next.add(item.id));
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
        
        if (!error) createdCount++;
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
        
        if (!error) createdCount++;
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
        
        if (!error) createdCount++;
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
        
        // Find matching generated variant
        const matchedVariant = generatedVariants.find(gv => 
          gv.sizeText === sizeText &&
          gv.color === color &&
          gv.sizeNumber === sizeNumber
        );
        
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
        `⚠️ Cảnh báo: ${itemsWithTPOS.length} sản phẩm đã có TPOS ID.\n\nBạn có chắc muốn upload lại không? Điều này có thể tạo duplicate trên TPOS.`
      );
      if (!confirmed) return;
    }

    // Split items into two groups: with variants and without variants
    const itemsWithoutVariants = selectedItems.filter(item => !item.variant || item.variant.trim() === '');
    const itemsWithVariants = selectedItems.filter(item => item.variant && item.variant.trim() !== '');

    console.log(`📦 Total selected: ${selectedItems.length}`);
    console.log(`   - Without variants: ${itemsWithoutVariants.length}`);
    console.log(`   - With variants: ${itemsWithVariants.length}`);

    setIsUploading(true);
    setProgress(0);
    setCurrentStep("Đang bắt đầu...");

    try {
      let totalSuccess = 0;
      let totalFailed = 0;
      let allErrors: any[] = [];

      // ========== PART 1: Upload simple products (no variants) ==========
      if (itemsWithoutVariants.length > 0) {
        console.log(`\n🔷 UPLOADING ${itemsWithoutVariants.length} SIMPLE PRODUCTS (no variants)`);
        setCurrentStep(`Đang upload ${itemsWithoutVariants.length} sản phẩm đơn giản...`);

        const simpleResult = await uploadToTPOS(itemsWithoutVariants, (step, total, message) => {
          setProgress((step / (total + itemsWithVariants.length)) * 50); // First 50%
          setCurrentStep(message);
        });

        totalSuccess += simpleResult.successCount;
        totalFailed += simpleResult.failedCount;
        allErrors = [...allErrors, ...simpleResult.errors];

        // Save TPOS IDs for simple products
        if (simpleResult.productIds.length > 0) {
          setCurrentStep("Đang lưu TPOS IDs cho sản phẩm đơn giản...");
          for (const { itemId, tposId } of simpleResult.productIds) {
            await supabase
              .from("purchase_order_items")
              .update({ tpos_product_id: tposId })
              .eq("id", itemId);
          }
        }

        console.log(`✅ Simple products: ${simpleResult.successCount} success, ${simpleResult.failedCount} failed`);
      }

      // ========== PART 2: Upload products with variants (existing logic) ==========
      if (itemsWithVariants.length > 0) {
        console.log(`\n🔶 UPLOADING ${itemsWithVariants.length} PRODUCTS WITH VARIANTS`);
        setCurrentStep(`Đang xử lý ${itemsWithVariants.length} sản phẩm có biến thể...`);
        setProgress(50);

        // Group items by base_product_code (use this for TPOS upload)
        const groupedByProductCode = new Map<string, TPOSProductItem[]>();
        itemsWithVariants.forEach(item => {
          const code = item.base_product_code || item.product_code || 'NO_CODE';
          if (!groupedByProductCode.has(code)) {
            groupedByProductCode.set(code, []);
          }
          groupedByProductCode.get(code)!.push(item);
        });

        console.log(`📦 Grouped ${itemsWithVariants.length} items into ${groupedByProductCode.size} product codes`);
        groupedByProductCode.forEach((items, code) => {
          const variants = items.map(i => i.variant).filter(Boolean);
          console.log(`  - ${code}: ${items.length} items, variants: ${variants.join(', ')}`);
        });

        // Check existing products and variants in database using base_product_code
        setCurrentStep("Đang kiểm tra sản phẩm trong kho...");
        const productCodes = Array.from(groupedByProductCode.keys()).filter(code => code !== 'NO_CODE');
        
        const { data: existingProducts } = await supabase
          .from("products")
          .select("product_code, variant, tpos_product_id")
          .in("product_code", productCodes);

        // Map ALL existing variants by product_code
        const existingVariantsByCode = new Map<string, Array<{ variant: string | null; tpos_product_id: number | null }>>();
        const existingTPOSIds = new Map<string, number>();
        
        existingProducts?.forEach(p => {
          if (!existingVariantsByCode.has(p.product_code)) {
            existingVariantsByCode.set(p.product_code, []);
          }
          existingVariantsByCode.get(p.product_code)!.push({
            variant: p.variant,
            tpos_product_id: p.tpos_product_id
          });
          if (p.tpos_product_id) {
            existingTPOSIds.set(p.product_code, p.tpos_product_id);
          }
        });

        // Prepare items for upload
        const itemsToUpload: TPOSProductItem[] = [];
        const variantMapping = new Map<string, { 
          items: TPOSProductItem[], 
          allVariants: string[],
          variantString: string,
          existingTPOSId?: number 
        }>();

        // Get selected groups from groupedItems (which has variants from inventory)
        const selectedGroups = groupedItems.filter(group => 
          group.items.some(item => selectedIds.has(item.id) && item.variant && item.variant.trim() !== '')
        );

        selectedGroups.forEach((group) => {
          const productCode = group.baseProductCode;
          const existingTPOSId = existingTPOSIds.get(productCode);
          
          const baseProduct = baseProductVariants.find(pv => pv.product_code === productCode);
          const variantString = group.variants.length > 0 ? group.variants[0] : '';
          const productName = baseProduct?.product_name;
          
          if (!variantString) {
            if (!existingTPOSId) {
              const representative = { ...group.baseItem };
              representative.variant = null;
              representative.product_code = productCode;
              representative.product_name = productName;
              itemsToUpload.push(representative);
            }
            return;
          }

          const representative = { ...group.baseItem };
          
          if (existingTPOSId) {
            variantMapping.set(productCode, {
              items: group.items,
              allVariants: [variantString],
              variantString: variantString,
              existingTPOSId: existingTPOSId
            });
          } else {
            variantMapping.set(productCode, {
              items: group.items,
              allVariants: [variantString],
              variantString: variantString
            });
            representative.variant = null;
            representative.product_code = productCode;
            representative.product_name = productName;
            itemsToUpload.push(representative);
          }
        });

        // Upload products with variants
        if (itemsToUpload.length > 0 || variantMapping.size > 0) {
          let variantResult: any = {
            success: false,
            totalProducts: itemsToUpload.length,
            successCount: 0,
            failedCount: 0,
            savedIds: 0,
            errors: [],
            imageUploadWarnings: [],
            productIds: [],
          };

          if (itemsToUpload.length > 0) {
            variantResult = await uploadToTPOS(itemsToUpload, (step, total, message) => {
              setProgress(50 + (step / total) * 25); // 50-75%
              setCurrentStep(message);
            });
          } else {
            variantResult.success = true;
          }

          // Save TPOS IDs and create variants
          if (variantResult.productIds.length > 0) {
            setCurrentStep("Đang lưu TPOS IDs...");
            const allItemUpdates: Array<{ itemId: string; tposId: number }> = [];
            
            for (const { itemId, tposId } of variantResult.productIds) {
              const representative = itemsToUpload.find(i => i.id === itemId);
              if (!representative || !representative.product_code) continue;
              
              const variantInfo = variantMapping.get(representative.product_code);
              if (!variantInfo) continue;
              
              for (const groupItem of variantInfo.items) {
                allItemUpdates.push({ itemId: groupItem.id, tposId });
                await supabase
                  .from("purchase_order_items")
                  .update({ tpos_product_id: tposId })
                  .eq("id", groupItem.id);
              }
            }
            
            console.log(`💾 Saved TPOS IDs to ${allItemUpdates.length} items for variant products`);
            totalSuccess += variantResult.successCount;
            totalFailed += variantResult.failedCount;
            allErrors = [...allErrors, ...variantResult.errors];
          }

          // Create variants on TPOS for products with variants
          setCurrentStep("Đang tạo biến thể trên TPOS...");
          setProgress(75);
          
          for (const { itemId, tposId } of variantResult.productIds) {
            const representative = itemsToUpload.find(i => i.id === itemId);
            if (!representative?.product_code) continue;
            
            const variantInfo = variantMapping.get(representative.product_code);
            if (!variantInfo) continue;
            
            const { variantString } = variantInfo;

            try {
              console.log(`🎨 Creating variants for: ${representative.product_name} (TPOS ID: ${tposId})`);
              setCurrentStep(`Đang tạo biến thể cho: ${representative.product_name}...`);
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              await createTPOSVariants(
                tposId,
                variantString,
                (msg) => {
                  console.log(`  → ${msg}`);
                  setCurrentStep(`${representative.product_name}: ${msg}`);
                }
              );
              
              console.log(`✅ Variants created for ${representative.product_name}`);
            } catch (error) {
              console.error(`❌ Failed to create variants for ${representative.product_name}:`, error);
              allErrors.push({
                productName: representative.product_name,
                productCode: representative.product_code || 'N/A',
                errorMessage: error instanceof Error ? error.message : String(error)
              });
            }
          }

          // Handle products that already exist on TPOS - add new variants only
          const existingTPOSProducts = Array.from(variantMapping.entries())
            .filter(([_, info]) => info.existingTPOSId !== undefined);

          if (existingTPOSProducts.length > 0) {
            setCurrentStep("Đang thêm biến thể vào sản phẩm có sẵn...");
            console.log(`🔗 Adding variants to ${existingTPOSProducts.length} existing TPOS products`);

            for (const [productCode, variantInfo] of existingTPOSProducts) {
              const { existingTPOSId, variantString, items } = variantInfo;
              if (!existingTPOSId) continue;

              try {
                console.log(`🎨 Adding variants to: ${productCode} (TPOS ID: ${existingTPOSId})`);
                setCurrentStep(`Đang thêm biến thể cho: ${productCode}...`);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                await createTPOSVariants(
                  existingTPOSId,
                  variantString,
                  (msg) => {
                    console.log(`  → ${msg}`);
                    setCurrentStep(`${productCode}: ${msg}`);
                  }
                );
                
                console.log(`✅ Variants added to ${productCode}`);

                // Update purchase_order_items with TPOS ID
                for (const item of items) {
                  await supabase
                    .from("purchase_order_items")
                    .update({ tpos_product_id: existingTPOSId })
                    .eq("id", item.id);
                }
              } catch (error) {
                console.error(`❌ Failed to add variants for ${productCode}:`, error);
                allErrors.push({
                  productName: productCode,
                  productCode: productCode,
                  errorMessage: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        }
      }

      setProgress(100);
      setCurrentStep("Hoàn thành!");

      // Save upload result for display
      const finalResult = {
        totalSuccess,
        totalFailed,
        itemsWithoutVariants: itemsWithoutVariants.length,
        itemsWithVariants: itemsWithVariants.length,
        errors: allErrors,
        timestamp: new Date().toISOString()
      };
      setUploadResult(finalResult);

      // Show results
      toast({
        title: totalFailed === 0 ? "🎉 Upload thành công!" : "⚠️ Upload hoàn tất",
        description: (
          <div className="space-y-2">
            <div className="font-semibold">
              Kết quả upload:
            </div>
            <div className="space-y-1 text-sm">
              <p>✅ Thành công: {totalSuccess} sản phẩm</p>
              {totalFailed > 0 && (
                <p className="text-destructive">❌ Thất bại: {totalFailed} sản phẩm</p>
              )}
              {itemsWithoutVariants.length > 0 && (
                <p className="text-blue-600">🔷 Sản phẩm đơn giản: {itemsWithoutVariants.length}</p>
              )}
              {itemsWithVariants.length > 0 && (
                <p className="text-purple-600">🔶 Sản phẩm có biến thể: {itemsWithVariants.length}</p>
              )}
            </div>
            {allErrors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-destructive font-semibold">
                  ❌ Xem {allErrors.length} lỗi
                </summary>
                <div className="mt-2 space-y-1 text-xs max-h-40 overflow-y-auto">
                  {allErrors.map((error, i) => (
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
                Danh sách sản phẩm ({groupedItems.length} nhóm, {filteredItems.length} sản phẩm)
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
                    <TableHead>Mã SP gốc</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead>Hình ảnh</TableHead>
                    <TableHead>TPOS Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedItems.map((group) => (
                    <TableRow 
                      key={group.baseProductCode}
                      className={group.allSelected ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={group.allSelected}
                          onCheckedChange={() => toggleGroup(group)}
                          aria-label={`Chọn ${group.baseProductCode}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {group.baseProductCode}
                      </TableCell>
                      <TableCell className="font-medium">{group.baseProductCode}</TableCell>
                      <TableCell>
                        {group.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {group.variants.map((variant, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {variant}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Không có</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatVND(group.baseItem.selling_price || 0)}
                      </TableCell>
                      <TableCell>
                        {group.baseItem.product_images && group.baseItem.product_images.length > 0 ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ {group.baseItem.product_images.length}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Không có</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.baseItem.tpos_product_id ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ ID: {group.baseItem.tpos_product_id}
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
