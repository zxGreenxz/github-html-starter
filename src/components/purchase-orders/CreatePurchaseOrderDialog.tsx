import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTPOSProcessingProgress, ProgressState } from "@/hooks/use-tpos-processing-progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Truck, Edit, Check, Pencil, ChevronLeft, ChevronRight, ArrowDown, ArrowDownToLine, Search, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { 
  generateProductCodeFromMax, 
  incrementProductCode, 
  extractBaseProductCode,
  getMaxNumberFromProductsDB,
  getMaxNumberFromPurchaseOrderItemsDB,
  getMaxNumberFromItems,
  detectProductCategory,
  isProductCodeExists
} from "@/lib/product-code-generator";
import { searchTPOSProduct } from "@/lib/tpos-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/AuthContext";

// Helper: Get product image with priority: product_images > tpos_image_url > parent image
const getProductImages = async (product: any): Promise<string[]> => {
  // Priority 1: product_images array
  if (product.product_images && product.product_images.length > 0) {
    return product.product_images;
  }
  
  // Priority 2: tpos_image_url
  if (product.tpos_image_url) {
    return [product.tpos_image_url];
  }
  
  // Priority 3: Parent image (if child variant)
  if (product.base_product_code && product.product_code !== product.base_product_code) {
    const { data: parentProduct } = await supabase
      .from("products")
      .select("product_images, tpos_image_url")
      .eq("product_code", product.base_product_code)
      .maybeSingle();
    
    if (parentProduct) {
      if (parentProduct.product_images && parentProduct.product_images.length > 0) {
        return parentProduct.product_images;
      }
      if (parentProduct.tpos_image_url) {
        return [parentProduct.tpos_image_url];
      }
    }
  }
  
  // No image found
  return [];
};

// Helper: Convert image URL to base64
const convertUrlToBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}`);
      return null;
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove the data:image/...;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

interface PurchaseOrderItem {
  quantity: number;
  notes: string;
  position?: number;
  
  // Primary fields (saved directly to DB)
  product_code: string;
  product_name: string;
  variant: string;
  base_product_code?: string;
  purchase_price: number | string;
  selling_price: number | string;
  product_images: string[];
  price_images: string[];
  
  // NEW: Variant generation data
  selectedAttributeValueIds?: string[]; // UUIDs for TPOS API call
  hasVariants?: boolean; // Flag to know if this item has variants
  
  // TPOS metadata
  tpos_product_id?: number | null;
  tpos_sync_status?: string;
  
  // UI only
  _tempTotalPrice: number;
  _manualCodeEdit?: boolean;
}

interface ValidationSettings {
  minPurchasePrice: number;    // Giá mua tối thiểu (đơn vị: 1000 VNĐ)
  maxPurchasePrice: number;    // Giá mua tối đa (đơn vị: 1000 VNĐ)
  minSellingPrice: number;     // Giá bán tối thiểu (đơn vị: 1000 VNĐ)
  maxSellingPrice: number;     // Giá bán tối đa (đơn vị: 1000 VNĐ)
  minMargin: number;           // Chênh lệch tối thiểu (đơn vị: 1000 VNĐ)
  
  // Boolean flags for validation rules
  enableRequireProductName: boolean;
  enableRequireProductCode: boolean;
  enableRequireProductImages: boolean;
  enableRequirePositivePurchasePrice: boolean;
  enableRequirePositiveSellingPrice: boolean;
  enableRequireSellingGreaterThanPurchase: boolean;
  enableRequireAtLeastOneItem: boolean;
}

// Default validation settings
const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  minPurchasePrice: 0,      // 0đ - không giới hạn
  maxPurchasePrice: 0,      // 0 = không giới hạn
  minSellingPrice: 0,       // 0đ - không giới hạn
  maxSellingPrice: 0,       // 0 = không giới hạn
  minMargin: 0,             // 0đ - giá bán phải > giá mua
  // Default to TRUE (giữ behavior hiện tại)
  enableRequireProductName: true,
  enableRequireProductCode: true,
  enableRequireProductImages: true,
  enableRequirePositivePurchasePrice: true,
  enableRequirePositiveSellingPrice: true,
  enableRequireSellingGreaterThanPurchase: true,
  enableRequireAtLeastOneItem: true,
};

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any | null;
}

export function CreatePurchaseOrderDialog({ open, onOpenChange, initialData }: CreatePurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ✅ REALTIME: Track active order processing
  const [activeOrderProcessing, setActiveOrderProcessing] = useState<{
    orderId: string;
    totalItems: number;
    toastId: string;
  } | null>(null);

  // State for validation settings dialog
  const [showValidationSettings, setShowValidationSettings] = useState(false);

  // Load validation settings from database
  const { data: dbValidationSettings } = useQuery({
    queryKey: ['purchase-order-validation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_validation_settings')
        .select('*')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const [validationSettings, setValidationSettings] = useState<ValidationSettings>(DEFAULT_VALIDATION_SETTINGS);
  
  // Update validationSettings when data is loaded
  useEffect(() => {
    if (dbValidationSettings) {
      setValidationSettings({
        minPurchasePrice: dbValidationSettings.min_purchase_price,
        maxPurchasePrice: dbValidationSettings.max_purchase_price,
        minSellingPrice: dbValidationSettings.min_selling_price,
        maxSellingPrice: dbValidationSettings.max_selling_price,
        minMargin: dbValidationSettings.min_margin,
        // NEW: Boolean validation flags
        enableRequireProductName: dbValidationSettings.enable_require_product_name ?? true,
        enableRequireProductCode: dbValidationSettings.enable_require_product_code ?? true,
        enableRequireProductImages: dbValidationSettings.enable_require_product_images ?? true,
        enableRequirePositivePurchasePrice: dbValidationSettings.enable_require_positive_purchase_price ?? true,
        enableRequirePositiveSellingPrice: dbValidationSettings.enable_require_positive_selling_price ?? true,
        enableRequireSellingGreaterThanPurchase: dbValidationSettings.enable_require_selling_greater_than_purchase ?? true,
        enableRequireAtLeastOneItem: dbValidationSettings.enable_require_at_least_one_item ?? true,
      });
    }
  }, [dbValidationSettings]);

  // Temporary state for editing (only saved when user clicks "Lưu")
  const [tempValidationSettings, setTempValidationSettings] = useState<ValidationSettings>(validationSettings);

  // Sync tempValidationSettings when validationSettings changes
  useEffect(() => {
    setTempValidationSettings(validationSettings);
  }, [validationSettings]);

  // Mutation to save validation settings to database
  const saveValidationSettingsMutation = useMutation({
    mutationFn: async (settings: ValidationSettings) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('purchase_order_validation_settings')
        .upsert({
          user_id: user.id,
          min_purchase_price: settings.minPurchasePrice,
          max_purchase_price: settings.maxPurchasePrice,
          min_selling_price: settings.minSellingPrice,
          max_selling_price: settings.maxSellingPrice,
          min_margin: settings.minMargin,
          // NEW: Boolean validation flags
          enable_require_product_name: settings.enableRequireProductName,
          enable_require_product_code: settings.enableRequireProductCode,
          enable_require_product_images: settings.enableRequireProductImages,
          enable_require_positive_purchase_price: settings.enableRequirePositivePurchasePrice,
          enable_require_positive_selling_price: settings.enableRequirePositiveSellingPrice,
          enable_require_selling_greater_than_purchase: settings.enableRequireSellingGreaterThanPurchase,
          enable_require_at_least_one_item: settings.enableRequireAtLeastOneItem,
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update local state
      setValidationSettings({
        minPurchasePrice: data.min_purchase_price,
        maxPurchasePrice: data.max_purchase_price,
        minSellingPrice: data.min_selling_price,
        maxSellingPrice: data.max_selling_price,
        minMargin: data.min_margin,
        enableRequireProductName: data.enable_require_product_name,
        enableRequireProductCode: data.enable_require_product_code,
        enableRequireProductImages: data.enable_require_product_images,
        enableRequirePositivePurchasePrice: data.enable_require_positive_purchase_price,
        enableRequirePositiveSellingPrice: data.enable_require_positive_selling_price,
        enableRequireSellingGreaterThanPurchase: data.enable_require_selling_greater_than_purchase,
        enableRequireAtLeastOneItem: data.enable_require_at_least_one_item,
      });
      
      // Invalidate query to refresh
      queryClient.invalidateQueries({ queryKey: ['purchase-order-validation-settings'] });
      
      setShowValidationSettings(false);
      toast({
        title: "✅ Đã lưu cài đặt",
        description: "Validation settings đã được lưu vào database",
      });
    },
    onError: (error) => {
      console.error('Error saving validation settings:', error);
      toast({
        title: "❌ Lỗi lưu cài đặt",
        description: "Không thể lưu validation settings. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  // Helper: Validate prices based on validation settings
  const validatePriceSettings = (purchasePrice: number, sellingPrice: number, itemNumber: number, settings: ValidationSettings): string[] => {
    const errors: string[] = [];
    
    // Validate giá mua tối thiểu
    if (settings.minPurchasePrice > 0 && purchasePrice < settings.minPurchasePrice) {
      errors.push(
        `Dòng ${itemNumber}: Giá mua (${formatVND(purchasePrice * 1000)}) thấp hơn giá mua tối thiểu (${formatVND(settings.minPurchasePrice * 1000)})`
      );
    }
    
    // Validate giá mua tối đa
    if (settings.maxPurchasePrice > 0 && purchasePrice > settings.maxPurchasePrice) {
      errors.push(
        `Dòng ${itemNumber}: Giá mua (${formatVND(purchasePrice * 1000)}) vượt quá giá mua tối đa (${formatVND(settings.maxPurchasePrice * 1000)})`
      );
    }
    
    // Validate giá bán tối thiểu
    if (settings.minSellingPrice > 0 && sellingPrice < settings.minSellingPrice) {
      errors.push(
        `Dòng ${itemNumber}: Giá bán (${formatVND(sellingPrice * 1000)}) thấp hơn giá bán tối thiểu (${formatVND(settings.minSellingPrice * 1000)})`
      );
    }
    
    // Validate giá bán tối đa
    if (settings.maxSellingPrice > 0 && sellingPrice > settings.maxSellingPrice) {
      errors.push(
        `Dòng ${itemNumber}: Giá bán (${formatVND(sellingPrice * 1000)}) vượt quá giá bán tối đa (${formatVND(settings.maxSellingPrice * 1000)})`
      );
    }
    
    // Validate chênh lệch tối thiểu
    const margin = sellingPrice - purchasePrice;
    if (settings.minMargin > 0 && margin < settings.minMargin) {
      errors.push(
        `Dòng ${itemNumber}: Chênh lệch giá bán - giá mua (${formatVND(margin * 1000)}) thấp hơn mức tối thiểu (${formatVND(settings.minMargin * 1000)})`
      );
    }
    
    return errors;
  };

  const [formData, setFormData] = useState({
    supplier_name: "",
    order_date: new Date().toISOString(),
    notes: "",
    invoice_images: [] as string[],
    invoice_amount: 0, // Store in thousands VND for user input
    discount_amount: 0,
    shipping_fee: 0
  });

  const [showShippingFee, setShowShippingFee] = useState(false);

  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { 
      quantity: 1,
      notes: "",
      product_code: "",
      product_name: "",
      variant: "",
      purchase_price: 0,
      selling_price: 0,
      product_images: [],
      price_images: [],
      _tempTotalPrice: 0,
    }
  ]);

  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [isVariantGeneratorOpen, setIsVariantGeneratorOpen] = useState(false);
  const [variantGeneratorIndex, setVariantGeneratorIndex] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [manualProductCodes, setManualProductCodes] = useState<Set<number>>(new Set());
  const [showDebugColumn, setShowDebugColumn] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // ✅ Image cache state - Map<url, base64>
  const [imageCache] = useState<Map<string, string>>(new Map());

  // Debounce product names for auto-generating codes
  const debouncedProductNames = useDebounce(
    items.map(i => i.product_name).join('|'),
    500
  );

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const hasData = 
      formData.supplier_name.trim() !== "" ||
      items.some(i => i.product_name.trim() || i.product_code.trim());
    return hasData;
  }, [formData, items]);

  // Load initial data when dialog opens with draft
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        supplier_name: initialData.supplier_name || "",
        order_date: initialData.order_date || new Date().toISOString(),
        notes: initialData.notes || "",
        invoice_images: initialData.invoice_images || [],
        invoice_amount: initialData.invoice_amount || 0,
        discount_amount: (initialData.discount_amount || 0) / 1000,
        shipping_fee: (initialData.shipping_fee || 0) / 1000
      });

      if (initialData.items && initialData.items.length > 0) {
        const loadedItems = initialData.items.map((item: any) => ({
          quantity: item.quantity || 1,
          notes: item.notes || "",
          product_code: item.product_code || "",
          product_name: item.product_name || "",
          variant: item.variant || "",
          purchase_price: (item.purchase_price || 0) / 1000,
          selling_price: (item.selling_price || 0) / 1000,
          product_images: item.product_images || [],
          price_images: item.price_images || [],
          selectedAttributeValueIds: item.selected_attribute_value_ids || undefined,
          hasVariants: item.selected_attribute_value_ids && item.selected_attribute_value_ids.length > 0,
          _tempTotalPrice: (item.quantity || 1) * ((item.purchase_price || 0) / 1000),
        }));
        setItems(loadedItems);

        // ✅ Pre-cache all product_images from draft
        const draftImageUrls = loadedItems
          .flatMap((item: PurchaseOrderItem) => item.product_images || [])
          .filter((url: string) => url);

        const uniqueUrls = [...new Set(draftImageUrls)];

        if (uniqueUrls.length > 0) {
          console.log(`🔄 Pre-caching ${uniqueUrls.length} images from draft...`);

          Promise.all(
            uniqueUrls.map(async (url: string) => {
              if (!imageCache.has(url)) {
                const base64 = await convertUrlToBase64(url);
                if (base64) {
                  imageCache.set(url, base64);
                  console.log(`✅ Cached: ${url.substring(0, 50)}...`);
                }
              }
            })
          ).then(() => {
            console.log(`✅ Draft images pre-cached: ${imageCache.size} URLs`);
          }).catch((error) => {
            console.error('Error pre-caching draft images:', error);
          });
        }
      }

      setShowShippingFee((initialData.shipping_fee || 0) > 0);
    }
  }, [open, initialData, imageCache]);

  // Auto-generate product code when product name changes (with debounce)
  // ✅ NEW: Query DB mỗi lần (không dùng cache)
  useEffect(() => {
    const generateCodes = async () => {
      // Check if any item needs code generation
      const needsGeneration = items.some(
        (item, index) => item.product_name.trim() && !item.product_code.trim() && !manualProductCodes.has(index)
      );
      
      if (!needsGeneration) return;

      // Get current snapshot of form items for duplicate check
      const currentFormItems = items.map(i => ({ product_code: i.product_code }));

      // Sequential generation (avoid race conditions)
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        
        // Skip if already has code or user edited manually
        if (!item.product_name.trim() || item.product_code.trim() || manualProductCodes.has(index)) {
          continue;
        }
        
        try {
          // Detect category
          const category = detectProductCategory(item.product_name);
          if (!category) continue; // Skip if can't detect category
          
          console.log(`🔄 [Item ${index + 1}] Generating code for category ${category}...`);
          
          // ✅ Query DB mỗi lần (RPC function - very fast ~20ms per query)
          const [maxFromProducts, maxFromPurchaseOrderItems] = await Promise.all([
            getMaxNumberFromProductsDB(category),
            getMaxNumberFromPurchaseOrderItemsDB(category)
          ]);
          
          // Get max from form items
          const maxFromForm = getMaxNumberFromItems(currentFormItems, category);
          
          // Calculate next number from ALL 3 sources
          const maxNumber = Math.max(maxFromProducts, maxFromPurchaseOrderItems, maxFromForm);
          let nextNumber = maxNumber + 1;
          let candidateCode = `${category}${nextNumber}`;
          
          console.log(`📊 [Item ${index + 1}] Max numbers: Products=${maxFromProducts}, PO Items=${maxFromPurchaseOrderItems}, Form=${maxFromForm} → Next=${nextNumber}`);
          
          // Check liên tục: FORM + DB + TPOS
          let attempts = 0;
          const MAX_ATTEMPTS = 30;
          let codeFound = false;

          while (attempts < MAX_ATTEMPTS) {
            // ✅ STEP 1: Check if exists in FORM + DB
            const existsInDB = await isProductCodeExists(candidateCode, currentFormItems);
            
            if (existsInDB) {
              // Code exists in form or DB - try next
              console.log(`⚠️ [Item ${index + 1}] Mã ${candidateCode} đã tồn tại (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
              nextNumber++;
              candidateCode = `${category}${nextNumber}`;
              attempts++;
              continue;
            }
            
            // ✅ STEP 2: Check TPOS
            const tposProduct = await searchTPOSProduct(candidateCode);
            
            if (!tposProduct) {
              // ✅ Code available everywhere - assign it
              console.log(`✅ [Item ${index + 1}] Mã ${candidateCode} khả dụng! Assigning...`);
              
              setItems(prev => {
                const newItems = [...prev];
                
                // Triple-check before assigning:
                // 1. Code still empty
                // 2. Not manually edited
                // 3. Code NOT duplicate in current form
                if (newItems[index] && 
                    !newItems[index].product_code.trim() && 
                    !manualProductCodes.has(index)) {
                  
                  // Check if code already assigned to another item in THIS state update
                  const isDuplicate = newItems.some((item, i) => 
                    i !== index && item.product_code.trim().toUpperCase() === candidateCode.toUpperCase()
                  );
                  
                  if (!isDuplicate) {
                    newItems[index] = { ...newItems[index], product_code: candidateCode };
                    
                    // Add to currentFormItems snapshot to prevent race condition
                    currentFormItems.push({ product_code: candidateCode });
                    
                    console.log(`✅ [Item ${index + 1}] Đã assign mã ${candidateCode}`);
                  }
                }
                return newItems;
              });
              codeFound = true;
              break;
            }
            
            // ⚠️ Code exists on TPOS - try next
            console.log(`⚠️ [Item ${index + 1}] Mã ${candidateCode} tồn tại trên TPOS (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
            nextNumber++;
            candidateCode = `${category}${nextNumber}`;
            attempts++;
          }

          // 🔴 Nếu vượt quá 30 lần - thông báo đỏ
          if (!codeFound && attempts >= MAX_ATTEMPTS) {
            toast({
              title: "⚠️ Mã trùng trên TPOS hơn 30 mã",
              description: "Vào TPOS tìm mã lớn nhất điền tay cho mã sản phẩm đầu tiên",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error(`❌ [Item ${index + 1}] Error generating code:`, error);
          // Silent fail - user can input manually
        }
      }
    };
    
    generateCodes();
  }, [debouncedProductNames, manualProductCodes]);

  // ✅ REALTIME: Completion handler
  // Cleanup is handled by hook's handleCompletion callback - no need for manual cleanup
  const handleTPOSProcessingComplete = useCallback((state: ProgressState) => {
    console.log('✅ [Order Creation] TPOS processing completed:', state);
    // Clear active processing
    setActiveOrderProcessing(null);
  }, []);

  // ✅ REALTIME: Use hook to monitor progress
  // Hook is always called but internally handles null case
  useTPOSProcessingProgress({
    orderId: activeOrderProcessing?.orderId || '',
    totalItems: activeOrderProcessing?.totalItems || 0,
    toastId: activeOrderProcessing?.toastId || '',
    onComplete: handleTPOSProcessingComplete,
    skipInitialQuery: true
  });

  // Validation function - check if all items have required fields
  const validateItems = (): { isValid: boolean; invalidFields: string[] } => {
    const invalidFields: string[] = [];
    
    // CHECK: At least one item (if enabled)
    if (validationSettings.enableRequireAtLeastOneItem && items.length === 0) {
      invalidFields.push("Phải có ít nhất 1 sản phẩm");
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNumber = i + 1;
      
      // CHECK: Product name (if enabled)
      if (validationSettings.enableRequireProductName && !item.product_name?.trim()) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu tên sản phẩm`);
      }
      
      // CHECK: Product code (if enabled)
      if (validationSettings.enableRequireProductCode && !item.product_code?.trim()) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu mã sản phẩm`);
      }
      
      // CHECK: Purchase price > 0 (if enabled)
      if (validationSettings.enableRequirePositivePurchasePrice && 
          (!item.purchase_price || Number(item.purchase_price) <= 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Giá mua phải > 0`);
      }
      
      // CHECK: Selling price > 0 (if enabled)
      if (validationSettings.enableRequirePositiveSellingPrice && 
          (!item.selling_price || Number(item.selling_price) <= 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Giá bán phải > 0`);
      }
      
      // CHECK: Selling > Purchase (if enabled)
      if (validationSettings.enableRequireSellingGreaterThanPurchase && 
          Number(item.selling_price) <= Number(item.purchase_price)) {
        invalidFields.push(
          `Dòng ${itemNumber}: Giá bán (${formatVND(Number(item.selling_price) * 1000)}) phải lớn hơn giá mua (${formatVND(Number(item.purchase_price) * 1000)})`
        );
      }
      
      // CHECK: Product images (if enabled)
      if (validationSettings.enableRequireProductImages && 
          (!item.product_images || item.product_images.length === 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu hình ảnh sản phẩm`);
      }
    }
    
    return {
      isValid: invalidFields.length === 0,
      invalidFields
    };
  };

  // Real-time validation state
  const { isValid: isItemsValid, invalidFields } = useMemo(() => validateItems(), [items, validationSettings]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0) * 1000;
      const discountAmount = formData.discount_amount * 1000;
      const shippingFee = formData.shipping_fee * 1000;
      const finalAmount = totalAmount - discountAmount + shippingFee;

      // If editing existing draft, update it
      if (initialData?.id) {
        const { data: order, error: orderError } = await supabase
          .from("purchase_orders")
          .update({
            supplier_name: formData.supplier_name.trim().toUpperCase() || null,
            order_date: formData.order_date,
            total_amount: totalAmount,
            final_amount: finalAmount,
            discount_amount: discountAmount,
            shipping_fee: shippingFee,
            invoice_images: formData.invoice_images.length > 0 ? formData.invoice_images : null,
            notes: formData.notes.trim().toUpperCase() || null,
            status: 'draft'
          })
          .eq("id", initialData.id)
          .select()
          .single();

        if (orderError) throw orderError;

        // Delete existing items and re-insert
        await supabase
          .from("purchase_order_items")
          .delete()
          .eq("purchase_order_id", initialData.id);

        if (items.some(item => item.product_name.trim())) {
          const orderItems = items
            .filter(item => item.product_name.trim())
            .map((item, index) => ({
              purchase_order_id: order.id,
              quantity: item.quantity,
              position: index + 1,
              notes: item.notes.trim().toUpperCase() || null,
              product_code: item.product_code.trim().toUpperCase() || null,
              product_name: item.product_name.trim().toUpperCase(),
              variant: item.variant?.trim().toUpperCase() || null,
              purchase_price: Number(item.purchase_price || 0) * 1000,
              selling_price: Number(item.selling_price || 0) * 1000,
              product_images: Array.isArray(item.product_images) ? item.product_images : [],
              price_images: Array.isArray(item.price_images) ? item.price_images : [],
              selected_attribute_value_ids: item.selectedAttributeValueIds || null
            }));

          const { error: itemsError } = await supabase
            .from("purchase_order_items")
            .insert(orderItems);

          if (itemsError) throw itemsError;
        }

        return order;
      }

      // Create new draft
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_name: formData.supplier_name.trim().toUpperCase() || null,
          order_date: formData.order_date,
          invoice_amount: formData.invoice_amount * 1000,
          total_amount: totalAmount,
          final_amount: finalAmount,
          discount_amount: discountAmount,
          shipping_fee: shippingFee,
          invoice_images: formData.invoice_images.length > 0 ? formData.invoice_images : null,
          notes: formData.notes.trim().toUpperCase() || null,
          status: 'draft'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create items if any
      if (items.some(item => item.product_name.trim())) {
        const orderItems = items
          .filter(item => item.product_name.trim())
          .map((item, index) => ({
            purchase_order_id: order.id,
            quantity: item.quantity,
            position: index + 1,
            notes: item.notes.trim().toUpperCase() || null,
            product_code: item.product_code.trim().toUpperCase() || null,
            product_name: item.product_name.trim().toUpperCase(),
            variant: item.variant?.trim().toUpperCase() || null,
            purchase_price: Number(item.purchase_price || 0) * 1000,
            selling_price: Number(item.selling_price || 0) * 1000,
            product_images: Array.isArray(item.product_images) ? item.product_images : [],
            price_images: Array.isArray(item.price_images) ? item.price_images : [],
            selected_attribute_value_ids: item.selectedAttributeValueIds || null
          }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: async () => {
      toast({ title: "Đã lưu nháp!" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi lưu nháp",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // ============= VALIDATION TRIỆT ĐỂ =============
      
      // 1. Validate Nhà cung cấp
      if (!formData.supplier_name?.trim()) {
        throw new Error("❌ Vui lòng nhập tên nhà cung cấp");
      }

      // 2. Validate có ít nhất 1 sản phẩm
      if (items.length === 0) {
        throw new Error("❌ Vui lòng thêm ít nhất một sản phẩm");
      }

      // 3. Validate từng sản phẩm phải có đầy đủ thông tin
      const validationErrors: string[] = [];
      
      items.forEach((item, index) => {
        const itemNumber = index + 1;
        
        // Validate theo settings (price ranges)
        const priceErrors = validatePriceSettings(
          Number(item.purchase_price),
          Number(item.selling_price),
          itemNumber,
          validationSettings
        );
        validationErrors.push(...priceErrors);
      });

      // Hiển thị tất cả lỗi nếu có
      if (validationErrors.length > 0) {
        const errorMessage = "❌ Vui lòng điền đầy đủ thông tin:\n\n" + validationErrors.join("\n");
        throw new Error(errorMessage);
      }

      // ✅ PRE-CONVERT: Ensure 100% product_images are cached before creating order
      const allProductImageUrls = items
        .flatMap(item => item.product_images || [])
        .filter(url => url); // Remove empty strings

      const uniqueUrls = [...new Set(allProductImageUrls)];
      const uncachedUrls = uniqueUrls.filter(url => !imageCache.has(url));

      if (uncachedUrls.length > 0) {
        console.log(`🔄 Pre-converting ${uncachedUrls.length} remaining images...`);

        // Show progress toast
        sonnerToast.info(`⏳ Đang chuẩn bị ${uncachedUrls.length} ảnh...`, { duration: 2000 });

        // Convert in parallel
        await Promise.all(
          uncachedUrls.map(async url => {
            const base64 = await convertUrlToBase64(url);
            if (base64) {
              imageCache.set(url, base64);
            }
          })
        );

        console.log(`✅ All images cached: ${imageCache.size} total`);
      } else {
        console.log(`✅ All images already cached: ${imageCache.size} total`);
      }

      const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0) * 1000;
      const discountAmount = formData.discount_amount * 1000;
      const shippingFee = formData.shipping_fee * 1000;
      const finalAmount = totalAmount - discountAmount + shippingFee;

      // If editing draft, update and change status to pending
      if (initialData?.id && initialData?.status === 'draft') {
        const { data: order, error: orderError } = await supabase
          .from("purchase_orders")
          .update({
            supplier_name: formData.supplier_name.trim().toUpperCase(),
            order_date: formData.order_date,
            invoice_amount: formData.invoice_amount * 1000,
            total_amount: totalAmount,
            final_amount: finalAmount,
            discount_amount: discountAmount,
            shipping_fee: shippingFee,
            invoice_images: formData.invoice_images.length > 0 ? formData.invoice_images : null,
            notes: formData.notes.trim().toUpperCase(),
            status: 'awaiting_export'
          })
          .eq("id", initialData.id)
          .select()
          .single();

        if (orderError) throw orderError;

        // Delete and recreate items
        await supabase
          .from("purchase_order_items")
          .delete()
          .eq("purchase_order_id", initialData.id);

        const orderItems = items
          .filter(item => item.product_name.trim())
          .map((item, index) => ({
            purchase_order_id: order.id,
            quantity: item.quantity,
            position: index + 1,
            notes: item.notes.trim().toUpperCase() || null,
            product_code: item.product_code.trim().toUpperCase(),
            product_name: item.product_name.trim().toUpperCase(),
            variant: item.variant?.trim().toUpperCase() || null,
            purchase_price: Number(item.purchase_price || 0) * 1000,
            selling_price: Number(item.selling_price || 0) * 1000,
            product_images: Array.isArray(item.product_images) 
              ? item.product_images 
              : (item.product_images ? [item.product_images] : []),
            price_images: Array.isArray(item.price_images) 
              ? item.price_images 
              : (item.price_images ? [item.price_images] : []),
            selected_attribute_value_ids: item.selectedAttributeValueIds || null
          }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // Step 3: Invoke background TPOS processing (same as create flow)
        console.log('🚀 Starting background TPOS product creation (from draft)...');

        const totalDraftItems = items.filter(i => i.product_name.trim()).length;

        // ✅ Convert Map to plain object for passing to edge function
        const cacheObject = Object.fromEntries(imageCache);
        console.log(`📤 Passing cache with ${Object.keys(cacheObject).length} images to edge function (draft)`);

        // Invoke background function without awaiting (fire-and-forget)
        supabase.functions.invoke(
          'process-purchase-order-background',
          {
            body: {
              purchase_order_id: order.id,
              imageCache: cacheObject // ✅ Pass cache
            }
          }
        ).catch(error => {
          console.error('Failed to invoke background process:', error);
          sonnerToast.error("Không thể bắt đầu xử lý. Vui lòng thử lại.");
        });

        // Show loading toast
        const toastId = `tpos-processing-${order.id}`;
        sonnerToast.loading(
          `Đang xử lý 0/${totalDraftItems} sản phẩm...`,
          { id: toastId, duration: Infinity }
        );

        // ✅ REALTIME: Start monitoring progress
        setActiveOrderProcessing({
          orderId: order.id,
          totalItems: totalDraftItems,
          toastId
        });

        console.log('✅ Background processing initiated (from draft)');

        // Create parent products (same logic as before)
        const parentProductsMap = new Map<string, { variants: Set<string>, data: any }>();

        for (const item of items.filter(i => i.product_name.trim())) {
          const productCode = item.product_code.trim().toUpperCase();
          const variantText = item.variant?.trim().toUpperCase();
          
          if (!parentProductsMap.has(productCode)) {
            parentProductsMap.set(productCode, {
              variants: new Set(),
              data: {
                product_code: productCode,
                base_product_code: productCode,
                product_name: item.product_name.trim().toUpperCase(),
                purchase_price: Number(item.purchase_price || 0) * 1000,
                selling_price: Number(item.selling_price || 0) * 1000,
                supplier_name: formData.supplier_name.trim().toUpperCase(),
                product_images: Array.isArray(item.product_images) 
                  ? item.product_images 
                  : (item.product_images ? [item.product_images] : []),
                price_images: Array.isArray(item.price_images) 
                  ? item.price_images 
                  : (item.price_images ? [item.price_images] : []),
                stock_quantity: 0,
                unit: 'Cái'
              }
            });
          }
          
          if (variantText) {
            parentProductsMap.get(productCode)!.variants.add(variantText);
          }
        }

        // ✅ OPTIMIZATION #1: Batch query instead of sequential queries
        // OLD: 10 products = 10 sequential queries (~500ms)
        // NEW: 10 products = 1 batch query (~50ms) - 90% faster
        const productCodes = Array.from(parentProductsMap.keys());
        const { data: existingProducts } = await supabase
          .from("products")
          .select("product_code")
          .in("product_code", productCodes);

        const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);

        const parentProducts: any[] = [];
        for (const [productCode, { variants, data }] of parentProductsMap) {
          if (!existingCodes.has(productCode)) {
            data.variant = variants.size > 0 ? Array.from(variants).join(', ') : null;
            parentProducts.push(data);
          }
        }

        if (parentProducts.length > 0) {
          const { error: productsError } = await supabase
            .from("products")
            .insert(parentProducts);
          
          if (productsError) {
            console.error("Error creating parent products:", productsError);
          } else {
            console.log(`✅ Created ${parentProducts.length} parent products`);
          }
        }

        return order;
      }

      // Step 1: Create purchase_order (new order)
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_name: formData.supplier_name.trim().toUpperCase(),
          order_date: formData.order_date,
          invoice_amount: formData.invoice_amount * 1000,
          total_amount: totalAmount,
          final_amount: finalAmount,
          discount_amount: discountAmount,
          shipping_fee: shippingFee,
          invoice_images: formData.invoice_images.length > 0 ? formData.invoice_images : null,
          notes: formData.notes.trim().toUpperCase(),
          status: 'awaiting_export'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Step 2: Create purchase_order_items with primary data
      const orderItems = items
        .filter(item => item.product_name.trim())
        .map((item, index) => ({
          purchase_order_id: order.id,
          quantity: item.quantity,
          position: index + 1,
          notes: item.notes.trim().toUpperCase() || null,
          // Primary data fields
          product_code: item.product_code.trim().toUpperCase(),
          product_name: item.product_name.trim().toUpperCase(),
          variant: item.variant?.trim().toUpperCase() || null,
          purchase_price: Number(item.purchase_price || 0) * 1000,
          selling_price: Number(item.selling_price || 0) * 1000,
          product_images: Array.isArray(item.product_images) 
            ? item.product_images 
            : (item.product_images ? [item.product_images] : []),
          price_images: Array.isArray(item.price_images) 
            ? item.price_images 
            : (item.price_images ? [item.price_images] : []),
          // NEW: Save selected_attribute_value_ids
          selected_attribute_value_ids: item.selectedAttributeValueIds || null,
          // Save TPOS metadata
          tpos_product_id: item.tpos_product_id || null,
          tpos_sync_status: item.tpos_product_id ? 'success' : 'pending',
          tpos_sync_completed_at: item.tpos_product_id ? new Date().toISOString() : null
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // Step 3: Invoke background TPOS processing
      console.log('🚀 Starting background TPOS product creation...');

      // ✅ Convert Map to plain object for passing to edge function
      const cacheObject = Object.fromEntries(imageCache);
      console.log(`📤 Passing cache with ${Object.keys(cacheObject).length} images to edge function`);

      const totalItems = items.filter(i => i.product_name.trim()).length;

      // Show loading toast immediately (will be updated via polling)
      const toastId = `tpos-processing-${order.id}`;
      sonnerToast.loading(
        `Đang xử lý 0/${totalItems} sản phẩm...`,
        { id: toastId, duration: Infinity }
      );

      // Invoke background function (fire-and-forget)
      supabase.functions.invoke(
        'process-purchase-order-background',
        {
          body: {
            purchase_order_id: order.id,
            imageCache: cacheObject // ✅ Pass cache
          }
        }
      ).then(({ error }) => {
        if (error) {
          console.error('Failed to invoke background process:', error);
          sonnerToast.error("Không thể bắt đầu xử lý. Vui lòng thử lại.");
        }
      }).catch(error => {
        console.error('Failed to invoke background process:', error);
        sonnerToast.error("Không thể bắt đầu xử lý. Vui lòng thử lại.");
      });

      // ✅ REALTIME: Start monitoring progress
      setActiveOrderProcessing({
        orderId: order.id,
        totalItems,
        toastId
      });

      console.log('✅ Background processing initiated');

      // Step 4: Create parent products in inventory
      const parentProductsMap = new Map<string, { variants: Set<string>, data: any }>();

      // Group items by product_code and collect all variants
      for (const item of items.filter(i => i.product_name.trim())) {
        const productCode = item.product_code.trim().toUpperCase();
        const variantText = item.variant?.trim().toUpperCase();
        
        if (!parentProductsMap.has(productCode)) {
          parentProductsMap.set(productCode, {
            variants: new Set(),
            data: {
              product_code: productCode,
              base_product_code: productCode,
              product_name: item.product_name.trim().toUpperCase(),
              purchase_price: Number(item.purchase_price || 0) * 1000,
              selling_price: Number(item.selling_price || 0) * 1000,
              supplier_name: formData.supplier_name.trim().toUpperCase(),
              product_images: Array.isArray(item.product_images) 
                ? item.product_images 
                : (item.product_images ? [item.product_images] : []),
              price_images: Array.isArray(item.price_images) 
                ? item.price_images 
                : (item.price_images ? [item.price_images] : []),
              stock_quantity: 0,
              unit: 'Cái'
            }
          });
        }
        
        // Collect variant if exists
        if (variantText) {
          parentProductsMap.get(productCode)!.variants.add(variantText);
        }
      }

      // ✅ OPTIMIZATION #1: Batch query instead of sequential queries
      // OLD: 10 products = 10 sequential queries (~500ms)
      // NEW: 10 products = 1 batch query (~50ms) - 90% faster
      const productCodes = Array.from(parentProductsMap.keys());
      const { data: existingProducts } = await supabase
        .from("products")
        .select("product_code")
        .in("product_code", productCodes);

      const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);

      const parentProducts: any[] = [];
      for (const [productCode, { variants, data }] of parentProductsMap) {
        if (!existingCodes.has(productCode)) {
          // Set variant to aggregated string or null
          data.variant = variants.size > 0 ? Array.from(variants).join(', ') : null;
          parentProducts.push(data);
        }
      }

      // Insert parent products if any
      if (parentProducts.length > 0) {
        const { error: productsError } = await supabase
          .from("products")
          .insert(parentProducts);
        
        if (productsError) {
          console.error("Error creating parent products:", productsError);
          // Don't throw - continue with order creation
        } else {
          console.log(`✅ Created ${parentProducts.length} parent products`);
        }
      }

      return order;
    },
    onSuccess: async () => {
      // ✅ OPTIMIZATION #9: Specific query invalidations instead of wildcards
      // OLD: Invalidate all purchase-orders, products (unnecessary refetches)
      // NEW: Only invalidate what's immediately needed (draft & awaiting_purchase tabs)
      // Products will be invalidated after background TPOS sync completes
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", "draft"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", "awaiting_purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders-stats"] });
      // Note: Removed products invalidations - will be done after TPOS sync in polling
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi tạo đơn hàng",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    // ✅ Clear image cache
    imageCache.clear();
    console.log('🧹 Image cache cleared (resetForm)');

    setFormData({
      supplier_name: "",
      order_date: new Date().toISOString(),
      notes: "",
      invoice_images: [],
      invoice_amount: 0,
      discount_amount: 0,
      shipping_fee: 0
    });
    setShowShippingFee(false);
    setManualProductCodes(new Set());
    setItems([
      {
        quantity: 1,
        notes: "",
        product_code: "",
        product_name: "",
        variant: "",
        purchase_price: 0,
        selling_price: 0,
        product_images: [],
        price_images: [],
        _tempTotalPrice: 0,
      }
    ]);
  };

  // ✅ Callback for auto-caching images
  const handleCacheUpdate = (url: string, base64: string) => {
    imageCache.set(url, base64);
  };

  // Handle dialog close with confirmation
  const handleClose = async () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      // No unsaved changes - close directly
      onOpenChange(false);
      resetForm();
    }
  };

  const updateItem = async (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field === "quantity" || field === "purchase_price") {
        newItems[index]._tempTotalPrice = newItems[index].quantity * Number(newItems[index].purchase_price || 0);
      }
      
      return newItems;
    });
  };

  // Update multiple fields at once (for variant generator)
  const updateItemMultiple = (index: number, updates: Partial<PurchaseOrderItem>) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], ...updates };
      
      if ('quantity' in updates || 'purchase_price' in updates) {
        newItems[index]._tempTotalPrice = newItems[index].quantity * Number(newItems[index].purchase_price || 0);
      }
      
      return newItems;
    });
  };

  const addItem = () => {
    setItems([...items, { 
      quantity: 1,
      notes: "",
      product_code: "",
      product_name: "",
      variant: "",
      purchase_price: 0,
      selling_price: 0,
      product_images: [],
      price_images: [],
      _tempTotalPrice: 0,
    }]);
  };

  const copyItem = async (index: number) => {
    const itemToCopy = { ...items[index] };
    // Deep copy the image arrays
    itemToCopy.product_images = [...itemToCopy.product_images];
    itemToCopy.price_images = [...itemToCopy.price_images];
    
    // ✅ Generate product code: Query DB mỗi lần (không dùng cache)
    if (itemToCopy.product_name.trim()) {
      try {
        const category = detectProductCategory(itemToCopy.product_name);
        
        if (!category) {
          throw new Error("⚠️ Chưa đủ thông tin để tạo mã SP. Vui lòng nhập thêm:\n• Loại SP (ÁO, TÚI, QUẦN...)\n• Hoặc NCC (Q5, A12...)");
        }
        
        console.log(`🔄 [Copy] Generating code for category ${category}...`);
        
        // ✅ Query DB mỗi lần (RPC function - very fast!)
        const currentFormItems = items.map(i => ({ product_code: i.product_code }));
        const [maxFromProducts, maxFromPurchaseOrderItems] = await Promise.all([
          getMaxNumberFromProductsDB(category),
          getMaxNumberFromPurchaseOrderItemsDB(category)
        ]);
        
        // Get max from form items
        const maxFromForm = getMaxNumberFromItems(currentFormItems, category);
        
        // Calculate next number from ALL 3 sources
        const maxNumber = Math.max(maxFromProducts, maxFromPurchaseOrderItems, maxFromForm);
        let nextNumber = maxNumber + 1;
        let candidateCode = `${category}${nextNumber}`;
        
        console.log(`📊 [Copy] Max numbers: Products=${maxFromProducts}, PO Items=${maxFromPurchaseOrderItems}, Form=${maxFromForm} → Next=${nextNumber}`);
        
        // Check liên tục với MAX_ATTEMPTS = 30
        let attempts = 0;
        const MAX_ATTEMPTS = 30;
        let codeFound = false;
        
        while (attempts < MAX_ATTEMPTS) {
          // ✅ STEP 1: Check if exists in FORM + DB
          const existsInDB = await isProductCodeExists(candidateCode, currentFormItems);
          
          if (existsInDB) {
            console.log(`⚠️ [Copy] Mã ${candidateCode} đã tồn tại (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
            nextNumber++;
            candidateCode = `${category}${nextNumber}`;
            attempts++;
            continue;
          }
          
          // ✅ STEP 2: Check TPOS
          const tposProduct = await searchTPOSProduct(candidateCode);
          
          if (!tposProduct) {
            // ✅ Code available - assign it
            itemToCopy.product_code = candidateCode;
            console.log(`✅ [Copy] Assigned code ${candidateCode}`);
            toast({
              title: "Đã sao chép và tạo mã SP mới",
              description: `Mã mới: ${candidateCode}`,
            });
            codeFound = true;
            break;
          }
          
          // ⚠️ Code exists on TPOS - try next
          console.log(`⚠️ [Copy] Mã ${candidateCode} tồn tại trên TPOS (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
          nextNumber++;
          candidateCode = `${category}${nextNumber}`;
          attempts++;
        }
        
        // 🔴 Nếu vượt quá 30 lần - thông báo đỏ
        if (!codeFound && attempts >= MAX_ATTEMPTS) {
          itemToCopy.product_code = ""; // Clear code để user nhập thủ công
          toast({
            title: "⚠️ Mã trùng trên TPOS hơn 30 mã",
            description: "Vào TPOS tìm mã lớn nhất điền tay cho mã sản phẩm đầu tiên",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ [Copy] Error generating product code:", error);
        itemToCopy.product_code = ""; // Clear code để user nhập thủ công
        toast({
          title: "⚠️ Không thể tạo mã tự động",
          description: error instanceof Error ? error.message : "Vui lòng nhập mã sản phẩm thủ công",
          variant: "destructive"
        });
      }
    }

    // ✅ Pre-cache product_images from copied item
    if (itemToCopy.product_images && itemToCopy.product_images.length > 0) {
      itemToCopy.product_images.forEach(async (url: string) => {
        if (url && !imageCache.has(url)) {
          const base64 = await convertUrlToBase64(url);
          if (base64) {
            imageCache.set(url, base64);
            console.log(`✅ Cached (copy): ${url.substring(0, 50)}...`);
          }
        }
      });
    }

    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const removeItem = async (index: number) => {
    // 🔥 Capture code BEFORE removing
    const itemToRemove = items[index];
    const codeToCleanup = itemToRemove.product_code;
    
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset the last item to empty state instead of removing
      setItems([{ 
        quantity: 1,
        notes: "",
        product_code: "",
        product_name: "",
        variant: "",
        purchase_price: 0,
        selling_price: 0,
        product_images: [],
        price_images: [],
        _tempTotalPrice: 0,
      }]);
    }
  };

  const handleSelectProduct = async (product: any) => {
    if (currentItemIndex !== null) {
      const newItems = [...items];
      
      // If currentItemIndex is beyond array, add a new blank row
      if (currentItemIndex >= newItems.length) {
        newItems.push({
          quantity: 1,
          notes: "",
          product_name: "",
          product_code: "",
          variant: "",
          purchase_price: 0,
          selling_price: 0,
          product_images: [],
          price_images: [],
          _tempTotalPrice: 0,
        });
      }
      
      // Fetch images with priority logic
      const productImages = await getProductImages(product);
      const tposProductId = product.tpos_product_id || product.productid_bienthe || null;
      const variant = product.variant || "";

      // ✅ Pre-cache product_images when selecting from inventory
      if (productImages && productImages.length > 0) {
        productImages.forEach(async (url: string) => {
          if (url && !imageCache.has(url)) {
            const base64 = await convertUrlToBase64(url);
            if (base64) {
              imageCache.set(url, base64);
              console.log(`✅ Cached (select): ${url.substring(0, 50)}...`);
            }
          }
        });
      }

      newItems[currentItemIndex] = {
        ...newItems[currentItemIndex],
        product_name: product.product_name,
        product_code: product.product_code,
        variant: variant,
        purchase_price: product.purchase_price / 1000,
        selling_price: product.selling_price / 1000,
        product_images: productImages,
        price_images: product.price_images || [],
        _tempTotalPrice: newItems[currentItemIndex].quantity * (product.purchase_price / 1000),
        tpos_product_id: tposProductId,
        tpos_sync_status: determineSyncStatus(tposProductId, variant)
      };
      setItems(newItems);
      
      // Auto-fill supplier name if empty
      if (!formData.supplier_name && product.supplier_name) {
        setFormData({ ...formData, supplier_name: product.supplier_name });
      }
    }
    setCurrentItemIndex(null);
  };

  // Helper function to determine initial sync status
  const determineSyncStatus = (
    tposProductId: number | null, 
    variant: string
  ): string => {
    if (tposProductId !== null) {
      return 'success'; // Already on TPOS
    }
    return 'pending'; // Needs TPOS creation
  };

  const handleSelectMultipleProducts = async (products: any[]) => {
    if (currentItemIndex === null || products.length === 0) return;

    const newItems = [...items];
    
    // If currentItemIndex is beyond array, add a new blank row
    if (currentItemIndex >= newItems.length) {
      newItems.push({
        quantity: 1,
        notes: "",
        product_name: "",
        product_code: "",
        variant: "",
        purchase_price: 0,
        selling_price: 0,
        product_images: [],
        price_images: [],
        _tempTotalPrice: 0,
      });
    }

    // Ensure current item has quantity property
    const currentItem = newItems[currentItemIndex];
    if (!currentItem || typeof currentItem.quantity !== 'number') {
      console.error('Invalid item at index:', currentItemIndex, currentItem);
      return;
    }
    
    // Fill first product into current line WITH IMAGE FETCH
    const firstProduct = products[0];
    const firstProductImages = await getProductImages(firstProduct);
    const firstTposProductId = firstProduct.tpos_product_id || firstProduct.productid_bienthe || null;
    const firstVariant = firstProduct.variant || "";

    // ✅ Pre-cache first product images
    if (firstProductImages && firstProductImages.length > 0) {
      firstProductImages.forEach(async (url: string) => {
        if (url && !imageCache.has(url)) {
          const base64 = await convertUrlToBase64(url);
          if (base64) {
            imageCache.set(url, base64);
            console.log(`✅ Cached (multi-select): ${url.substring(0, 50)}...`);
          }
        }
      });
    }

    newItems[currentItemIndex] = {
      ...currentItem,
      product_name: firstProduct.product_name,
      product_code: firstProduct.product_code,
      variant: firstVariant,
      purchase_price: firstProduct.purchase_price / 1000,
      selling_price: firstProduct.selling_price / 1000,
      product_images: firstProductImages,
      price_images: firstProduct.price_images || [],
      _tempTotalPrice: currentItem.quantity * (firstProduct.purchase_price / 1000),
      tpos_product_id: firstTposProductId,
      tpos_sync_status: determineSyncStatus(firstTposProductId, firstVariant)
    };

    // Add remaining products as new lines WITH IMAGE FETCH
    const additionalItems = await Promise.all(
      products.slice(1).map(async (product) => {
        const productImages = await getProductImages(product);
        const tposProductId = product.tpos_product_id || product.productid_bienthe || null;
        const variant = product.variant || "";

        // ✅ Pre-cache additional product images
        if (productImages && productImages.length > 0) {
          productImages.forEach(async (url: string) => {
            if (url && !imageCache.has(url)) {
              const base64 = await convertUrlToBase64(url);
              if (base64) {
                imageCache.set(url, base64);
                console.log(`✅ Cached (multi-select): ${url.substring(0, 50)}...`);
              }
            }
          });
        }

        return {
          quantity: 1,
          notes: "",
          product_name: product.product_name,
          product_code: product.product_code,
          variant: variant,
          purchase_price: product.purchase_price / 1000,
          selling_price: product.selling_price / 1000,
          product_images: productImages,
          price_images: product.price_images || [],
          _tempTotalPrice: product.purchase_price / 1000,
          tpos_product_id: tposProductId,
          tpos_sync_status: determineSyncStatus(tposProductId, variant)
        };
      })
    );

    newItems.splice(currentItemIndex + 1, 0, ...additionalItems);
    setItems(newItems);

    // Auto-fill supplier name if empty
    if (!formData.supplier_name && firstProduct.supplier_name) {
      setFormData({ ...formData, supplier_name: firstProduct.supplier_name });
    }

    toast({
      title: "Đã thêm sản phẩm",
      description: `Đã thêm ${products.length} sản phẩm vào đơn hàng`,
    });

    setCurrentItemIndex(null);
  };

  const openSelectProduct = (index: number) => {
    setCurrentItemIndex(index);
    setIsSelectProductOpen(true);
  };

  // ✅ Apply value to all variants with same product_code
  const applyToAllVariants = (productCode: string, fieldName: keyof PurchaseOrderItem, value: any) => {
    if (!productCode) return;
    
    const updatedItems = items.map(item => {
      if (item.product_code === productCode) {
        return { ...item, [fieldName]: value };
      }
      return item;
    });
    
    setItems(updatedItems);
    
    const affectedCount = updatedItems.filter(item => item.product_code === productCode).length;
    toast({
      title: "✅ Đã áp dụng",
      description: `Đã cập nhật ${affectedCount} dòng sản phẩm với mã ${productCode}`,
    });
  };

  // Check if should show apply button
  const shouldShowApplyButton = (productCode: string) => {
    return items.filter(item => item.product_code === productCode).length > 1;
  };

  // ✅ Apply ALL common fields to variants at once
  const applyAllFieldsToVariants = (sourceIndex: number) => {
    const sourceItem = items[sourceIndex];
    if (!sourceItem.product_code) return;

    const fieldsToApply: (keyof PurchaseOrderItem)[] = [
      'product_name',
      'purchase_price',
      'selling_price', 
      'product_images',
      'price_images'
    ];

    const updatedItems = items.map((item, idx) => {
      // Only update items with same product_code but different index
      if (item.product_code === sourceItem.product_code && idx !== sourceIndex) {
        const updated = { 
          ...item,
          product_name: sourceItem.product_name,
          purchase_price: sourceItem.purchase_price,
          selling_price: sourceItem.selling_price,
          product_images: [...(sourceItem.product_images || [])],
          price_images: [...(sourceItem.price_images || [])]
        };

        // ✅ Recalculate _tempTotalPrice
        updated._tempTotalPrice = updated.quantity * Number(updated.purchase_price || 0);
        
        return updated;
      }
      return item;
    });

    setItems(updatedItems);
    
    const variantCount = items.filter(i => i.product_code === sourceItem.product_code).length;
    toast({
      title: "✅ Đã áp dụng cho tất cả biến thể",
      description: `Đã cập nhật ${variantCount} dòng: tên, giá mua, giá bán, hình ảnh`,
    });
  };

  // Check if should show "Apply All" button
  const shouldShowApplyAllButton = (index: number) => {
    const item = items[index];
    if (!item.product_code) return false;
    
    const variantCount = items.filter(i => i.product_code === item.product_code).length;
    if (variantCount <= 1) return false;
    
    // At least ONE field must be filled
    return (
      Number(item.purchase_price) > 0 ||
      Number(item.selling_price) > 0 ||
      (item.product_images && item.product_images.length > 0) ||
      (item.price_images && item.price_images.length > 0)
    );
  };

  const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0);
  const finalAmount = totalAmount - formData.discount_amount + formData.shipping_fee;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
        {/* Fixed Header Section - Compact horizontal layout */}
        <div className="shrink-0 px-6 pt-6 space-y-3">
          {/* Row 1: Inline labels and inputs */}
          <div className="grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="supplier" className="whitespace-nowrap text-sm">
                Nhà cung cấp *
              </Label>
              <Input
                id="supplier"
                placeholder="Nhập tên nhà cung cấp"
                value={formData.supplier_name}
                onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="order_date" className="whitespace-nowrap text-sm">
                Ngày đặt hàng
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "flex-1 justify-start text-left font-normal h-10",
                      !formData.order_date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.order_date ? format(new Date(formData.order_date), "dd/MM/yyyy") : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.order_date ? new Date(formData.order_date) : undefined}
                    onSelect={(date) => setFormData({...formData, order_date: date ? date.toISOString() : new Date().toISOString()})}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="invoice_amount" className="whitespace-nowrap text-sm">
                Số tiền hóa đơn (VND)
              </Label>
              <Input
                id="invoice_amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số tiền VND"
                value={formData.invoice_amount || ""}
                onChange={(e) => setFormData({...formData, invoice_amount: parseNumberInput(e.target.value)})}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="invoice_images" className="whitespace-nowrap text-sm">
                Ảnh hóa đơn
              </Label>
              <div className="flex-1 h-10 flex items-center">
                <ImageUploadCell
                  images={formData.invoice_images}
                  onImagesChange={(images) => setFormData({...formData, invoice_images: images})}
                  itemIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Product list label, search, notes, and buttons */}
          <div className="flex items-center gap-3">
            <Label className="text-base font-medium whitespace-nowrap">
              Danh sách sản phẩm
            </Label>
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <Input
                placeholder="Tìm kiếm sản phẩm theo tên..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm cho đơn hàng..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={1}
              className="flex-1 min-h-[40px] h-10 resize-none py-2"
            />
            
            {/* Validation Settings Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowValidationSettings(true)}
                    className={cn(
                      "h-10 w-10 p-0 shrink-0 transition-all",
                      // Highlight nếu có validation settings active
                      (validationSettings.minPurchasePrice > 0 || 
                       validationSettings.maxPurchasePrice > 0 ||
                       validationSettings.minSellingPrice > 0 ||
                       validationSettings.maxSellingPrice > 0 ||
                       validationSettings.minMargin > 0)
                        ? "bg-primary/10 text-primary border-primary hover:bg-primary/20"
                        : "hover:bg-primary/10 hover:text-primary hover:border-primary"
                    )}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs font-medium">Cài đặt validation giá mua/bán</p>
                  {(validationSettings.minPurchasePrice > 0 || 
                    validationSettings.maxPurchasePrice > 0 ||
                    validationSettings.minSellingPrice > 0 ||
                    validationSettings.maxSellingPrice > 0 ||
                    validationSettings.minMargin > 0) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ✅ Validation đang hoạt động
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="flex items-center gap-2">
              <Button onClick={addItem} size="sm" variant="secondary">
                <Plus className="w-4 h-4 mr-2" />
                Thêm sản phẩm
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => openSelectProduct(items.length > 0 && items[items.length - 1].product_name ? items.length : items.length - 1)}
              >
                <Warehouse className="h-4 w-4 mr-2" />
                Chọn từ Kho SP
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Middle Section - Product Table */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">STT</TableHead>
              <TableHead className="w-[260px]">Tên sản phẩm</TableHead>
              <TableHead className="w-[150px]">Biến thể</TableHead>
              <TableHead className="w-[70px]">Mã sản phẩm</TableHead>
              <TableHead className="w-[60px]">SL</TableHead>
              <TableHead className="w-[90px]">Giá mua (VND)</TableHead>
              <TableHead className="w-[90px]">Giá bán (VND)</TableHead>
              <TableHead className="w-[130px]">Thành tiền (VND)</TableHead>
              <TableHead className="w-[100px]">Hình ảnh sản phẩm</TableHead>
              <TableHead className="w-[100px] border-l-2 border-primary/30">Hình ảnh Giá mua</TableHead>
              <TableHead className="w-16">Thao tác</TableHead>
              <TableHead className={`border-l-2 border-yellow-500/30 transition-all ${showDebugColumn ? 'w-[200px]' : 'w-8'}`}>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => setShowDebugColumn(!showDebugColumn)}
                    title="Toggle debug column"
                  >
                    {showDebugColumn ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  {showDebugColumn && <span className="text-xs text-muted-foreground whitespace-nowrap">Debug: Attr IDs</span>}
                </div>
              </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .map((item, originalIndex) => ({ item, originalIndex }))
                    .filter(({ item }) => 
                      !productSearchQuery || 
                      item.product_name.toLowerCase().includes(productSearchQuery.toLowerCase())
                    )
                    .map(({ item, originalIndex: index }, displayIndex) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-medium">
                        {displayIndex + 1}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          placeholder="Nhập tên sản phẩm"
                          value={item.product_name}
                          onChange={(e) => updateItem(index, "product_name", e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 min-h-[60px] resize-none"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-3"
                            onClick={() => {
                              setVariantGeneratorIndex(index);
                              setIsVariantGeneratorOpen(true);
                            }}
                          >
                            {item.variant ? (
                              <span className="font-medium text-xs">{item.variant}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                Nhấn để tạo biến thể
                              </span>
                            )}
                          </Button>
                          {item.selectedAttributeValueIds && item.selectedAttributeValueIds.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ {item.selectedAttributeValueIds.length} thuộc tính đã chọn
                            </Badge>
                          )}
                        </div>
                      </TableCell>
            <TableCell>
              <div className="flex gap-1 items-center">
                <Input
                  id={`product-code-${index}`}
                  placeholder="Mã SP"
                  value={item.product_code}
                  onChange={(e) => updateItem(index, "product_code", e.target.value)}
                  onFocus={() => {
                    setManualProductCodes(prev => new Set(prev).add(index));
                  }}
                  className="border-0 shadow-none focus-visible:ring-0 p-2 w-[70px] text-xs flex-1"
                  maxLength={20}
                  disabled={!item._manualCodeEdit}
                  readOnly={!item._manualCodeEdit}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-accent"
                  onClick={() => {
                    const newItems = [...items];
                    newItems[index]._manualCodeEdit = !newItems[index]._manualCodeEdit;
                    setItems(newItems);
                    if (newItems[index]._manualCodeEdit) {
                      setTimeout(() => {
                        document.getElementById(`product-code-${index}`)?.focus();
                      }, 0);
                    }
                  }}
                >
                  {item._manualCodeEdit ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                </Button>
                {item.tpos_product_id && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 whitespace-nowrap shrink-0">
                    ✓ TPOS
                  </Badge>
                )}
              </div>
            </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                          className="no-spinner border-0 shadow-none focus-visible:ring-0 p-2 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={item.purchase_price === 0 || item.purchase_price === "" ? "" : item.purchase_price}
                          onChange={(e) => updateItem(index, "purchase_price", parseNumberInput(e.target.value))}
                          className={`border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm ${
                            (item.purchase_price === 0 || item.purchase_price === "") 
                              ? 'ring-2 ring-red-500 ring-inset' 
                              : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={item.selling_price === 0 || item.selling_price === "" ? "" : item.selling_price}
                          onChange={(e) => updateItem(index, "selling_price", parseNumberInput(e.target.value))}
                          className={`border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm ${
                            (item.selling_price === 0 || item.selling_price === "") ||
                            (Number(item.selling_price) <= Number(item.purchase_price))
                              ? 'ring-2 ring-red-500 ring-inset' 
                              : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVND(item._tempTotalPrice * 1000)}
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item.product_images}
                          onImagesChange={(images) => updateItem(index, "product_images", images)}
                          itemIndex={index}
                          imageCache={imageCache}
                          onCacheUpdate={handleCacheUpdate}
                        />
                      </TableCell>
                      <TableCell className="border-l-2 border-primary/30">
                        <ImageUploadCell
                          images={item.price_images}
                          onImagesChange={(images) => updateItem(index, "price_images", images)}
                          itemIndex={index}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {shouldShowApplyAllButton(index) && (
                            <Button 
                              onClick={() => applyAllFieldsToVariants(index)} 
                              size="sm" 
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                              title="Áp dụng giá & hình ảnh cho tất cả biến thể"
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            onClick={() => openSelectProduct(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                            title="Chọn từ kho"
                          >
                            <Warehouse className="w-4 h-4" />
                          </Button>
                          <Button 
                            onClick={() => copyItem(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent"
                            title="Sao chép dòng"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button 
                            onClick={() => removeItem(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title="Xóa dòng"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      {showDebugColumn && (
                        <TableCell className="border-l-2 border-yellow-500/30 align-top">
                          {item.selectedAttributeValueIds && item.selectedAttributeValueIds.length > 0 ? (
                            <div className="space-y-1 max-h-[120px] overflow-y-auto text-xs">
                              {item.selectedAttributeValueIds.map((id, idx) => (
                                <div key={idx} className="font-mono text-[10px] bg-yellow-50 px-1 py-0.5 rounded border border-yellow-200">
                                  {id}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Fixed Footer Section - Horizontal layout */}
        <div className="shrink-0 px-6 pb-6 space-y-3 border-t pt-4">
          {/* Single horizontal row with all summary info */}
          <div className="flex items-center gap-4">
            {/* Left group: Tổng số lượng, Tổng tiền, Giảm giá, Tiền ship */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">Tổng số lượng:</span>
                <span className="text-sm font-semibold">
                  {items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">Tổng tiền:</span>
                <span className="text-sm font-semibold">
                  {formatVND(totalAmount * 1000)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">Giảm giá:</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-24 h-9 text-right text-sm"
                  placeholder="0"
                  value={formData.discount_amount || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    discount_amount: parseNumberInput(e.target.value)
                  })}
                />
              </div>
              
              {!showShippingFee ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShippingFee(true)}
                  className="gap-2 text-muted-foreground hover:text-foreground h-9"
                >
                  <Truck className="w-4 h-4" />
                  Thêm tiền ship
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm whitespace-nowrap">Tiền ship:</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="w-24 h-9 text-right text-sm"
                    placeholder="0"
                    value={formData.shipping_fee || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      shipping_fee: parseNumberInput(e.target.value)
                    })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowShippingFee(false);
                      setFormData({ ...formData, shipping_fee: 0 });
                    }}
                    className="h-7 w-7"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Right side: THÀNH TIỀN */}
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-lg font-bold whitespace-nowrap">THÀNH TIỀN:</span>
              <span className="text-lg font-bold">{formatVND(finalAmount * 1000)}</span>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button 
              variant="secondary"
              onClick={() => saveDraftMutation.mutate()}
              disabled={saveDraftMutation.isPending}
            >
              {saveDraftMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
            </Button>
            <Button 
              onClick={() => {
                // Show validation errors if any
                if (!isItemsValid) {
                  toast({
                    title: "Không thể tạo đơn hàng",
                    description: (
                      <div className="space-y-1">
                        <p className="font-medium">Vui lòng điền đầy đủ thông tin:</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {invalidFields.map((field, idx) => (
                            <li key={idx}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    ),
                    variant: "destructive",
                  });
                  return;
                }
                createOrderMutation.mutate();
              }}
              disabled={createOrderMutation.isPending || !isItemsValid}
              className={!isItemsValid ? "opacity-50 cursor-not-allowed" : ""}
            >
              {createOrderMutation.isPending ? "Đang tạo..." : "Tạo đơn hàng"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <SelectProductDialog
        open={isSelectProductOpen}
        onOpenChange={setIsSelectProductOpen}
        onSelect={handleSelectProduct}
        onSelectMultiple={handleSelectMultipleProducts}
      />

      <VariantGeneratorDialog
        open={isVariantGeneratorOpen}
        onOpenChange={setIsVariantGeneratorOpen}
        productCode={
          variantGeneratorIndex !== null 
            ? items[variantGeneratorIndex]?.product_code 
            : undefined
        }
        productInfo={
          variantGeneratorIndex !== null && items[variantGeneratorIndex]
            ? {
                productName: items[variantGeneratorIndex].product_name,
                purchasePrice: Number(items[variantGeneratorIndex].purchase_price),
                sellingPrice: Number(items[variantGeneratorIndex].selling_price),
                productImages: items[variantGeneratorIndex].product_images,
                supplierName: formData.supplier_name
              }
            : undefined
        }
        onSubmit={(result) => {
          if (variantGeneratorIndex !== null && result.hasVariants && result.combinations) {
            const sourceItem = items[variantGeneratorIndex];
            
            console.log('🔵 Creating variants from source item:', {
              sourceIndex: variantGeneratorIndex,
              sourceName: sourceItem.product_name,
              sourceCode: sourceItem.product_code,
              combinationsCount: result.combinations.length
            });
            
            // Create N new variant items
            const newVariantItems = result.combinations.map((combo, index) => ({
              product_name: sourceItem.product_name,
              product_code: sourceItem.product_code,
              variant: combo.combinationString,
              purchase_price: sourceItem.purchase_price,
              selling_price: sourceItem.selling_price,
              quantity: 1,
              product_images: [...(sourceItem.product_images || [])],
              price_images: [...(sourceItem.price_images || [])],
              selectedAttributeValueIds: combo.selectedAttributeValueIds,
              hasVariants: true,
              notes: sourceItem.notes || "",
              _tempTotalPrice: 1 * Number(sourceItem.purchase_price || 0),
              tempId: `variant-${Date.now()}-${index}`
            }));
            
            console.log('✅ Created variant items:', {
              count: newVariantItems.length,
              sample: newVariantItems[0]
            });
            
            // Remove source item and add new variant items
            setItems(prev => {
              const filtered = prev.filter((_, idx) => idx !== variantGeneratorIndex);
              return [...filtered, ...newVariantItems];
            });
            
            toast({
              title: "✅ Đã tạo biến thể",
              description: `Đã tạo ${newVariantItems.length} dòng sản phẩm từ các biến thể đã chọn`,
            });
          }
          
          setIsVariantGeneratorOpen(false);
          setVariantGeneratorIndex(null);
        }}
      />

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đóng đơn hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn hàng có {items.length} sản phẩm chưa được lưu.
              Tất cả dữ liệu sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              // Clear form and close
              resetForm();
              onOpenChange(false);
            }}>
              Đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Settings Dialog */}
      <Dialog open={showValidationSettings} onOpenChange={(open) => {
        if (!open) {
          // Reset temp settings khi đóng dialog
          setTempValidationSettings(validationSettings);
        }
        setShowValidationSettings(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Cài đặt validation giá mua/bán
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Giải thích */}
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">📋 Cách hoạt động:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Đặt giá trị <strong>0</strong> để <strong>không giới hạn</strong></li>
                <li>Hệ thống sẽ kiểm tra khi tạo/sửa đơn đặt hàng</li>
                <li>Nếu vi phạm, sẽ hiển thị cảnh báo chi tiết</li>
              </ul>
            </div>

            {/* Giá mua */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                💰 Giá mua
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Giá mua tối thiểu */}
                <div className="space-y-2">
                  <Label htmlFor="minPurchasePrice">
                    Giá mua tối thiểu (1000đ)
                  </Label>
                  <Input
                    id="minPurchasePrice"
                    type="number"
                    min="0"
                    value={tempValidationSettings.minPurchasePrice}
                    onChange={(e) => setTempValidationSettings({
                      ...tempValidationSettings,
                      minPurchasePrice: Math.max(0, parseInt(e.target.value) || 0)
                    })}
                    placeholder="0 = không giới hạn"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {formatVND(tempValidationSettings.minPurchasePrice * 1000)}
                  </p>
                </div>

                {/* Giá mua tối đa */}
                <div className="space-y-2">
                  <Label htmlFor="maxPurchasePrice">
                    Giá mua tối đa (1000đ)
                  </Label>
                  <Input
                    id="maxPurchasePrice"
                    type="number"
                    min="0"
                    value={tempValidationSettings.maxPurchasePrice}
                    onChange={(e) => setTempValidationSettings({
                      ...tempValidationSettings,
                      maxPurchasePrice: Math.max(0, parseInt(e.target.value) || 0)
                    })}
                    placeholder="0 = không giới hạn"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {formatVND(tempValidationSettings.maxPurchasePrice * 1000)}
                  </p>
                </div>
              </div>
            </div>

            {/* Giá bán */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                💵 Giá bán
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Giá bán tối thiểu */}
                <div className="space-y-2">
                  <Label htmlFor="minSellingPrice">
                    Giá bán tối thiểu (1000đ)
                  </Label>
                  <Input
                    id="minSellingPrice"
                    type="number"
                    min="0"
                    value={tempValidationSettings.minSellingPrice}
                    onChange={(e) => setTempValidationSettings({
                      ...tempValidationSettings,
                      minSellingPrice: Math.max(0, parseInt(e.target.value) || 0)
                    })}
                    placeholder="0 = không giới hạn"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {formatVND(tempValidationSettings.minSellingPrice * 1000)}
                  </p>
                </div>

                {/* Giá bán tối đa */}
                <div className="space-y-2">
                  <Label htmlFor="maxSellingPrice">
                    Giá bán tối đa (1000đ)
                  </Label>
                  <Input
                    id="maxSellingPrice"
                    type="number"
                    min="0"
                    value={tempValidationSettings.maxSellingPrice}
                    onChange={(e) => setTempValidationSettings({
                      ...tempValidationSettings,
                      maxSellingPrice: Math.max(0, parseInt(e.target.value) || 0)
                    })}
                    placeholder="0 = không giới hạn"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {formatVND(tempValidationSettings.maxSellingPrice * 1000)}
                  </p>
                </div>
              </div>
            </div>

            {/* Chênh lệch */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                📊 Chênh lệch (Margin)
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="minMargin">
                  Chênh lệch tối thiểu (Giá bán - Giá mua) (1000đ)
                </Label>
                <Input
                  id="minMargin"
                  type="number"
                  min="0"
                  value={tempValidationSettings.minMargin}
                  onChange={(e) => setTempValidationSettings({
                    ...tempValidationSettings,
                    minMargin: Math.max(0, parseInt(e.target.value) || 0)
                  })}
                  placeholder="0 = chỉ yêu cầu giá bán > giá mua"
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">
                  = {formatVND(tempValidationSettings.minMargin * 1000)}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Ví dụ: Đặt 50 nghĩa là giá bán phải cao hơn giá mua ít nhất 50.000đ
                </p>
              </div>
            </div>

            {/* NEW: Quy tắc kiểm tra */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-base flex items-center gap-2">
                ✅ Quy tắc kiểm tra
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireProductName" className="text-sm font-normal cursor-pointer">
                    Bắt buộc nhập tên sản phẩm
                  </Label>
                  <input
                    id="requireProductName"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequireProductName}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequireProductName: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireProductCode" className="text-sm font-normal cursor-pointer">
                    Bắt buộc nhập mã sản phẩm
                  </Label>
                  <input
                    id="requireProductCode"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequireProductCode}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequireProductCode: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireProductImages" className="text-sm font-normal cursor-pointer">
                    Bắt buộc có ít nhất 1 hình ảnh
                  </Label>
                  <input
                    id="requireProductImages"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequireProductImages}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequireProductImages: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requirePositivePurchasePrice" className="text-sm font-normal cursor-pointer">
                    Giá mua phải lớn hơn 0
                  </Label>
                  <input
                    id="requirePositivePurchasePrice"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequirePositivePurchasePrice}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequirePositivePurchasePrice: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requirePositiveSellingPrice" className="text-sm font-normal cursor-pointer">
                    Giá bán phải lớn hơn 0
                  </Label>
                  <input
                    id="requirePositiveSellingPrice"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequirePositiveSellingPrice}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequirePositiveSellingPrice: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireSellingGreaterThanPurchase" className="text-sm font-normal cursor-pointer">
                    Giá bán phải lớn hơn giá mua
                  </Label>
                  <input
                    id="requireSellingGreaterThanPurchase"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequireSellingGreaterThanPurchase}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequireSellingGreaterThanPurchase: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireAtLeastOneItem" className="text-sm font-normal cursor-pointer">
                    Phải có ít nhất 1 sản phẩm
                  </Label>
                  <input
                    id="requireAtLeastOneItem"
                    type="checkbox"
                    checked={tempValidationSettings.enableRequireAtLeastOneItem}
                    onChange={(e) => 
                      setTempValidationSettings(prev => ({...prev, enableRequireAtLeastOneItem: e.target.checked}))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
              </div>
            </div>

            {/* Preview/Example */}
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Ví dụ validation
              </p>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>• Giá mua = 100k → {
                  tempValidationSettings.minPurchasePrice > 0 && 100 < tempValidationSettings.minPurchasePrice
                    ? <span className="text-red-600">❌ Thấp hơn tối thiểu</span>
                    : tempValidationSettings.maxPurchasePrice > 0 && 100 > tempValidationSettings.maxPurchasePrice
                    ? <span className="text-red-600">❌ Cao hơn tối đa</span>
                    : <span className="text-green-600">✅ Hợp lệ</span>
                }</p>
                <p>• Giá bán = 150k → {
                  tempValidationSettings.minSellingPrice > 0 && 150 < tempValidationSettings.minSellingPrice
                    ? <span className="text-red-600">❌ Thấp hơn tối thiểu</span>
                    : tempValidationSettings.maxSellingPrice > 0 && 150 > tempValidationSettings.maxSellingPrice
                    ? <span className="text-red-600">❌ Cao hơn tối đa</span>
                    : tempValidationSettings.minMargin > 0 && (150 - 100) < tempValidationSettings.minMargin
                    ? <span className="text-red-600">❌ Chênh lệch không đủ</span>
                    : <span className="text-green-600">✅ Hợp lệ</span>
                }</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTempValidationSettings(DEFAULT_VALIDATION_SETTINGS);
              }}
            >
              Đặt lại mặc định
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTempValidationSettings(validationSettings);
                  setShowValidationSettings(false);
                }}
              >
                Hủy
              </Button>
              <Button
                type="button"
                onClick={() => {
                  saveValidationSettingsMutation.mutate(tempValidationSettings);
                }}
                disabled={saveValidationSettingsMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                {saveValidationSettingsMutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}