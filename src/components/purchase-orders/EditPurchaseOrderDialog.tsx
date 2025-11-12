import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Truck, Edit, Check, ChevronLeft, ChevronRight, ArrowDown, ArrowDownToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { detectProductCategory, getMaxNumberFromItems, getMaxNumberFromProductsDB, getMaxNumberFromPurchaseOrderItemsDB, isProductCodeExists } from "@/lib/product-code-generator";
import { searchTPOSProduct } from "@/lib/tpos-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/AuthContext";


interface PurchaseOrderItem {
  id?: string;
  quantity: number;
  notes: string;
  position?: number;
  
  // Primary fields from database (renamed from snapshot fields)
  product_code: string;
  product_name: string;
  variant?: string | null;
  purchase_price: number;
  selling_price: number;
  product_images?: string[];
  price_images?: string[];
  selected_attribute_value_ids?: string[];
  
  // Temporary UI fields
  _tempProductName: string;
  _tempProductCode: string;
  _tempVariant: string;
  _tempUnitPrice: number | string;
  _tempSellingPrice: number | string;
  _tempTotalPrice: number;
  _tempProductImages: string[];
  _tempPriceImages: string[];
  _manualCodeEdit?: boolean;
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  invoice_amount: number;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  supplier_name: string | null;
  notes: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
}

interface EditPurchaseOrderDialogProps {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationSettings {
  minPurchasePrice: number;
  maxPurchasePrice: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  minMargin: number;
  enableRequireProductName: boolean;
  enableRequireProductCode: boolean;
  enableRequireProductImages: boolean;
  enableRequirePositivePurchasePrice: boolean;
  enableRequirePositiveSellingPrice: boolean;
  enableRequireSellingGreaterThanPurchase: boolean;
  enableRequireAtLeastOneItem: boolean;
}

const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  minPurchasePrice: 0,
  maxPurchasePrice: 0,
  minSellingPrice: 0,
  maxSellingPrice: 0,
  minMargin: 0,
  enableRequireProductName: true,
  enableRequireProductCode: true,
  enableRequireProductImages: true,
  enableRequirePositivePurchasePrice: true,
  enableRequirePositiveSellingPrice: true,
  enableRequireSellingGreaterThanPurchase: true,
  enableRequireAtLeastOneItem: true,
};

export function EditPurchaseOrderDialog({ order, open, onOpenChange }: EditPurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString());
  const [notes, setNotes] = useState("");
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [showShippingFee, setShowShippingFee] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({});
  const [variantsMap, setVariantsMap] = useState<Record<string, any[]>>({});
  const [parentProductVariant, setParentProductVariant] = useState<string>("");
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { 
      product_code: "",
      product_name: "",
      variant: "",
      purchase_price: 0,
      selling_price: 0,
      product_images: [],
      price_images: [],
      quantity: 1,
      notes: "",
      _tempProductName: "",
      _tempProductCode: "",
      _tempVariant: "",
      _tempUnitPrice: "",
      _tempSellingPrice: "",
      _tempTotalPrice: 0,
      _tempProductImages: [],
      _tempPriceImages: []
    }
  ]);
  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [isVariantGeneratorOpen, setIsVariantGeneratorOpen] = useState(false);
  const [variantGeneratorIndex, setVariantGeneratorIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDebugColumn, setShowDebugColumn] = useState(false);

  // Debounce product names for auto-generating codes
  const debouncedProductNames = useDebounce(
    items.map(i => i._tempProductName).join('|'),
    500
  );

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!order || !open) return false;
    
    const formChanged = 
      supplierName !== (order.supplier_name || "") ||
      notes !== (order.notes || "");
    
    const itemsChanged = items.some(i => i._tempProductName.trim() || i._tempProductCode.trim());
    
    return formChanged || itemsChanged;
  }, [supplierName, notes, items, order, open]);

  // Auto-generate product code when product name changes (with debounce)
  // ✅ NEW: Query DB mỗi lần (không dùng cache)
  useEffect(() => {
    const generateCodes = async () => {
      // Get current snapshot of form items for duplicate check
      const currentFormItems = items.map(i => ({ product_code: i._tempProductCode }));

      // Sequential generation (avoid race conditions)
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        
        // Skip if already has code or user edited manually
        if (item._tempProductCode.trim() || item._manualCodeEdit) {
          continue;
        }
        
        if (!item._tempProductName.trim()) continue;
        
        try {
          const category = detectProductCategory(item._tempProductName);
          
          if (!category) {
            continue;
          }
          
          console.log(`🔄 [Edit Item ${index + 1}] Generating code for category ${category}...`);
          
          // ✅ Query DB mỗi lần (RPC function - very fast!)
          const [maxFromProducts, maxFromPurchaseOrderItems] = await Promise.all([
            getMaxNumberFromProductsDB(category),
            getMaxNumberFromPurchaseOrderItemsDB(category)
          ]);
          
          // Get max from form items
          const maxFromForm = getMaxNumberFromItems(
            currentFormItems.map(c => ({ product_code: c.product_code })),
            category
          );
          
          // Calculate next number from ALL 3 sources
          const maxNumber = Math.max(maxFromProducts, maxFromPurchaseOrderItems, maxFromForm);
          let nextNumber = maxNumber + 1;
          let candidateCode = `${category}${nextNumber}`;
          
          console.log(`📊 [Edit Item ${index + 1}] Max numbers: Products=${maxFromProducts}, PO Items=${maxFromPurchaseOrderItems}, Form=${maxFromForm} → Next=${nextNumber}`);
          
          let attempts = 0;
          const MAX_ATTEMPTS = 30;
          let codeFound = false;
          
          while (attempts < MAX_ATTEMPTS) {
            // ✅ STEP 1: Check if exists in FORM + DB
            const existsInDB = await isProductCodeExists(
              candidateCode, 
              currentFormItems.map(c => ({ product_code: c.product_code }))
            );
            
            if (existsInDB) {
              console.log(`⚠️ [Edit Item ${index + 1}] Mã ${candidateCode} đã tồn tại (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
              nextNumber++;
              candidateCode = `${category}${nextNumber}`;
              attempts++;
              continue;
            }
            
            // ✅ STEP 2: Check TPOS
            const tposProduct = await searchTPOSProduct(candidateCode);
            
            if (!tposProduct) {
              setItems(prev => {
                const newItems = [...prev];
                if (newItems[index] && 
                    !newItems[index]._tempProductCode.trim() && 
                    !newItems[index]._manualCodeEdit) {
                  
                  // Check duplicate in current state
                  const isDuplicate = newItems.some((item, i) => 
                    i !== index && item._tempProductCode.trim().toUpperCase() === candidateCode.toUpperCase()
                  );
                  
                  if (!isDuplicate) {
                    newItems[index] = { ...newItems[index], _tempProductCode: candidateCode };
                    
                    // Add to snapshot
                    currentFormItems.push({ product_code: candidateCode });
                    
                    console.log(`✅ [Edit Item ${index + 1}] Đã assign mã ${candidateCode}`);
                  }
                }
                return newItems;
              });
              codeFound = true;
              break;
            }
            
            console.log(`⚠️ [Edit Item ${index + 1}] Mã ${candidateCode} tồn tại trên TPOS (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
            nextNumber++;
            candidateCode = `${category}${nextNumber}`;
            attempts++;
          }
          
          if (!codeFound && attempts >= MAX_ATTEMPTS) {
            console.warn(`❌ [Edit Item ${index + 1}] Không tìm được mã khả dụng sau ${MAX_ATTEMPTS} lần thử`);
          }
        } catch (error) {
          console.error(`❌ [Edit Item ${index + 1}] Error generating product code:`, error);
        }
      }
    };
    
    generateCodes();
  }, [debouncedProductNames, items]);

  // Helper: Validate prices based on validation settings
  const validatePriceSettings = (item: PurchaseOrderItem, itemNumber: number): string[] => {
    const errors: string[] = [];
    const settings = validationSettings;
    
    const purchasePrice = Number(item._tempUnitPrice);
    const sellingPrice = Number(item._tempSellingPrice);
    
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
      if (validationSettings.enableRequireProductName && !item._tempProductName?.trim()) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu tên sản phẩm`);
      }
      
      // CHECK: Product code (if enabled)
      if (validationSettings.enableRequireProductCode && !item._tempProductCode?.trim()) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu mã sản phẩm`);
      }
      
      // CHECK: Purchase price > 0 (if enabled)
      if (validationSettings.enableRequirePositivePurchasePrice && 
          (!item._tempUnitPrice || Number(item._tempUnitPrice) <= 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Giá mua phải > 0`);
      }
      
      // CHECK: Selling price > 0 (if enabled)
      if (validationSettings.enableRequirePositiveSellingPrice && 
          (!item._tempSellingPrice || Number(item._tempSellingPrice) <= 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Giá bán phải > 0`);
      }
      
      // CHECK: Selling > Purchase (if enabled)
      if (validationSettings.enableRequireSellingGreaterThanPurchase && 
          Number(item._tempSellingPrice) <= Number(item._tempUnitPrice)) {
        invalidFields.push(
          `Dòng ${itemNumber}: Giá bán (${formatVND(Number(item._tempSellingPrice) * 1000)}) phải lớn hơn giá mua (${formatVND(Number(item._tempUnitPrice) * 1000)})`
        );
      }
      
      // CHECK: Product images (if enabled)
      if (validationSettings.enableRequireProductImages && 
          (!item._tempProductImages || item._tempProductImages.length === 0)) {
        invalidFields.push(`Dòng ${itemNumber}: Thiếu hình ảnh sản phẩm`);
      }
      
      // CHECK: Price settings (min/max ranges)
      const priceErrors = validatePriceSettings(item, itemNumber);
      invalidFields.push(...priceErrors);
    }
    
    return {
      isValid: invalidFields.length === 0,
      invalidFields
    };
  };

  // Real-time validation state
  const { isValid: isItemsValid, invalidFields } = useMemo(() => validateItems(), [items, validationSettings]);

  // Fetch existing items (no JOIN needed - all data is in purchase_order_items)
  const { data: existingItems } = useQuery({
    queryKey: ["purchaseOrderItems", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", order.id)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  // Load order data when dialog opens
  useEffect(() => {
    if (order && open) {
      setSupplierName(order.supplier_name || "");
      setOrderDate(order.order_date || new Date().toISOString());
      setNotes(order.notes || "");
      setInvoiceImages(order.invoice_images || []);
      setInvoiceAmount(order.invoice_amount ? String(order.invoice_amount / 1000) : "");
      setDiscountAmount(order.discount_amount ? String(order.discount_amount / 1000) : "");
      const orderShippingFee = (order as any).shipping_fee ? (order as any).shipping_fee / 1000 : 0;
      setShippingFee(String(orderShippingFee));
      setShowShippingFee(orderShippingFee > 0);
    }
  }, [order, open]);

  // Load items when existingItems change
  useEffect(() => {
    if (!open) return;
    
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        id: item.id,
        product_code: item.product_code,
        product_name: item.product_name,
        variant: item.variant || "",
        purchase_price: item.purchase_price,
        selling_price: item.selling_price,
        product_images: item.product_images || [],
        price_images: item.price_images || [],
        quantity: item.quantity || 1,
        notes: item.notes || "",
        position: item.position,
        selected_attribute_value_ids: item.selected_attribute_value_ids || [],
        _tempProductName: item.product_name,
        _tempProductCode: item.product_code,
        _tempVariant: item.variant || "",
        _tempUnitPrice: Number(item.purchase_price) / 1000,
        _tempSellingPrice: Number(item.selling_price) / 1000,
        _tempTotalPrice: (item.quantity * Number(item.purchase_price)) / 1000,
        _tempProductImages: item.product_images || [],
        _tempPriceImages: item.price_images || [],
      })));
    } else if (existingItems !== undefined) {
      // Query completed but no items, start with one empty row
      setItems([{
        product_code: "",
        product_name: "",
        variant: "",
        purchase_price: 0,
        selling_price: 0,
        product_images: [],
        price_images: [],
        quantity: 1,
        notes: "",
        _tempProductName: "",
        _tempProductCode: "",
        _tempVariant: "",
        _tempUnitPrice: "",
        _tempSellingPrice: "",
        _tempTotalPrice: 0,
        _tempProductImages: [],
        _tempPriceImages: [],
      }]);
    }
  }, [existingItems, open]);

  const resetForm = () => {
    setSupplierName("");
    setOrderDate(new Date().toISOString());
    setNotes("");
    setInvoiceImages([]);
    setInvoiceAmount("");
    setDiscountAmount("");
    setShippingFee("");
    setShowShippingFee(false);
    setItems([{
      product_code: "",
      product_name: "",
      variant: "",
      purchase_price: 0,
      selling_price: 0,
      product_images: [],
      price_images: [],
      quantity: 1,
      notes: "",
      _tempProductName: "",
      _tempProductCode: "",
      _tempVariant: "",
      _tempUnitPrice: "",
      _tempSellingPrice: "",
      _tempTotalPrice: 0,
      _tempProductImages: [],
      _tempPriceImages: [],
    }]);
  };

  const updateItem = async (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field === 'quantity' || field === '_tempUnitPrice') {
        const qty = field === 'quantity' ? value : newItems[index].quantity;
        const price = field === '_tempUnitPrice' ? value : newItems[index]._tempUnitPrice;
        newItems[index]._tempTotalPrice = qty * Number(price || 0);
      }
      
      return newItems;
    });
  };

  // Update multiple fields at once (for variant generator)
  const updateItemMultiple = (index: number, updates: Partial<PurchaseOrderItem>) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], ...updates };
      
      if ('quantity' in updates || '_tempUnitPrice' in updates) {
        const qty = 'quantity' in updates ? updates.quantity : newItems[index].quantity;
        const price = '_tempUnitPrice' in updates ? updates._tempUnitPrice : newItems[index]._tempUnitPrice;
        newItems[index]._tempTotalPrice = (qty || 0) * Number(price || 0);
      }
      
      return newItems;
    });
  };

  const toggleExpandVariants = (index: number, open: boolean) => {
    setExpandedVariants(prev => ({
      ...prev,
      [index]: open
    }));
  };

  // Load variants when product codes change
  useEffect(() => {
    const loadVariantsForItems = async () => {
      const productCodes = items
        .map(item => item._tempProductCode)
        .filter(code => code && code.trim().length > 0);
      
      if (productCodes.length === 0) return;
      
      const uniqueCodes = Array.from(new Set(productCodes));
      const newVariantsMap: Record<string, any[]> = {};
      
      for (const code of uniqueCodes) {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_code, product_name, variant")
          .eq("base_product_code", code)
          .not("variant", "is", null)
          .neq("variant", "")
          .neq("product_code", code);
        
        if (!error && data) {
          newVariantsMap[code] = data;
        }
      }
      
      setVariantsMap(newVariantsMap);
    };
    
    loadVariantsForItems();
  }, [items.map(i => i._tempProductCode).join(',')]);

  const addItem = () => {
    setItems([...items, {
      product_code: "",
      product_name: "",
      variant: "",
      purchase_price: 0,
      selling_price: 0,
      product_images: [],
      price_images: [],
      quantity: 1,
      notes: "",
      _tempProductName: "",
      _tempProductCode: "",
      _tempVariant: "",
      _tempUnitPrice: "",
      _tempSellingPrice: "",
      _tempTotalPrice: 0,
      _tempProductImages: [],
      _tempPriceImages: [],
    }]);
  };

  const copyItem = async (index: number) => {
    const itemToCopy = { ...items[index] };
    delete itemToCopy.id;
    itemToCopy._tempProductImages = [...itemToCopy._tempProductImages];
    itemToCopy._tempPriceImages = [...itemToCopy._tempPriceImages];
    
    if (itemToCopy._tempProductName.trim()) {
      try {
        const category = detectProductCategory(itemToCopy._tempProductName);
        
        if (!category) {
          throw new Error("⚠️ Chưa đủ thông tin để tạo mã SP. Vui lòng nhập thêm:\n• Loại SP (ÁO, TÚI, QUẦN...)\n• Hoặc NCC (Q5, A12...)");
        }
        
        console.log(`🔄 [Edit Copy] Generating code for category ${category}...`);
        
        // ✅ Query DB mỗi lần
        const currentFormItems = items.map(i => ({ product_code: i._tempProductCode }));
        const [maxFromProducts, maxFromPurchaseOrderItems] = await Promise.all([
          getMaxNumberFromProductsDB(category),
          getMaxNumberFromPurchaseOrderItemsDB(category)
        ]);
        
        const maxFromForm = getMaxNumberFromItems(
          currentFormItems.map(c => ({ product_code: c.product_code })),
          category
        );
        
        const maxNumber = Math.max(maxFromProducts, maxFromPurchaseOrderItems, maxFromForm);
        let nextNumber = maxNumber + 1;
        let candidateCode = `${category}${nextNumber}`;
        
        console.log(`📊 [Edit Copy] Max numbers: Products=${maxFromProducts}, PO Items=${maxFromPurchaseOrderItems}, Form=${maxFromForm} → Next=${nextNumber}`);
        
        let attempts = 0;
        const MAX_ATTEMPTS = 30;
        let codeFound = false;
        
        while (attempts < MAX_ATTEMPTS) {
          // ✅ STEP 1: Check if exists in FORM + DB
          const existsInDB = await isProductCodeExists(
            candidateCode,
            currentFormItems.map(c => ({ product_code: c.product_code }))
          );
          
          if (existsInDB) {
            console.log(`⚠️ [Edit Copy] Mã ${candidateCode} đã tồn tại (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
            nextNumber++;
            candidateCode = `${category}${nextNumber}`;
            attempts++;
            continue;
          }
          
          // ✅ STEP 2: Check TPOS
          const tposProduct = await searchTPOSProduct(candidateCode);
          
          if (!tposProduct) {
            itemToCopy._tempProductCode = candidateCode;
            console.log(`✅ [Edit Copy] Assigned code ${candidateCode}`);
            toast({
              title: "Đã sao chép và tạo mã SP mới",
              description: `Mã mới: ${candidateCode}`,
            });
            codeFound = true;
            break;
          }
          
          console.log(`⚠️ [Edit Copy] Mã ${candidateCode} tồn tại trên TPOS (lần ${attempts + 1}/${MAX_ATTEMPTS}), thử mã tiếp theo...`);
          nextNumber++;
          candidateCode = `${category}${nextNumber}`;
          attempts++;
        }
        
        if (!codeFound && attempts >= MAX_ATTEMPTS) {
          itemToCopy._tempProductCode = "";
          toast({
            title: "⚠️ Mã trùng trên TPOS hơn 30 mã",
            description: "Vào TPOS tìm mã lớn nhất điền tay cho mã sản phẩm đầu tiên",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ [Edit Copy] Error generating product code:", error);
        itemToCopy._tempProductCode = "";
        toast({
          title: "⚠️ Không thể tạo mã tự động",
          description: error instanceof Error ? error.message : "Vui lòng nhập mã sản phẩm thủ công",
          variant: "destructive"
        });
      }
    }
    
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const removeItem = async (index: number) => {
    // 🔥 Capture code BEFORE removing
    const itemToRemove = items[index];
    const codeToCleanup = itemToRemove._tempProductCode;
    
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset the last item to empty state instead of removing
      setItems([{ 
        product_code: "",
        product_name: "",
        variant: "",
        purchase_price: 0,
        selling_price: 0,
        product_images: [],
        price_images: [],
        quantity: 1,
        notes: "",
        _tempProductName: "",
        _tempProductCode: "",
        _tempVariant: "",
        _tempUnitPrice: "",
        _tempSellingPrice: "",
        _tempTotalPrice: 0,
        _tempProductImages: [],
        _tempPriceImages: []
      }]);
    }
  };

  const handleSelectProduct = (product: any) => {
    if (currentItemIndex !== null) {
      const newItems = [...items];
      newItems[currentItemIndex] = {
        ...newItems[currentItemIndex],
        product_code: product.product_code,
        product_name: product.product_name,
        variant: product.variant || "",
        purchase_price: product.purchase_price,
        selling_price: product.selling_price,
        product_images: product.product_images || [],
        price_images: product.price_images || [],
        _tempProductName: product.product_name,
        _tempProductCode: product.product_code,
        _tempVariant: product.variant || "",
        _tempUnitPrice: product.purchase_price / 1000,
        _tempSellingPrice: product.selling_price / 1000,
        _tempProductImages: product.product_images || [],
        _tempPriceImages: product.price_images || [],
        _tempTotalPrice: newItems[currentItemIndex].quantity * (product.purchase_price / 1000)
      };
      setItems(newItems);
      
      // Auto-fill supplier name if empty
      if (!supplierName && product.supplier_name) {
        setSupplierName(product.supplier_name);
      }
    }
    setCurrentItemIndex(null);
  };

  const handleSelectMultipleProducts = (products: any[]) => {
    if (currentItemIndex === null || products.length === 0) return;

    const newItems = [...items];
    
    // Fill first product into current line
    const firstProduct = products[0];
    newItems[currentItemIndex] = {
      ...newItems[currentItemIndex],
      product_code: firstProduct.product_code,
      product_name: firstProduct.product_name,
      variant: firstProduct.variant || "",
      purchase_price: firstProduct.purchase_price,
      selling_price: firstProduct.selling_price,
      product_images: firstProduct.product_images || [],
      price_images: firstProduct.price_images || [],
      _tempProductName: firstProduct.product_name,
      _tempProductCode: firstProduct.product_code,
      _tempVariant: firstProduct.variant || "",
      _tempUnitPrice: firstProduct.purchase_price / 1000,
      _tempSellingPrice: firstProduct.selling_price / 1000,
      _tempProductImages: firstProduct.product_images || [],
      _tempPriceImages: firstProduct.price_images || [],
      _tempTotalPrice: newItems[currentItemIndex].quantity * (firstProduct.purchase_price / 1000)
    };

    // Add remaining products as new lines after current line
    const additionalItems = products.slice(1).map(product => ({
      id: undefined,
      product_code: product.product_code,
      product_name: product.product_name,
      variant: product.variant || "",
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      product_images: product.product_images || [],
      price_images: product.price_images || [],
      quantity: 1,
      notes: "",
      position: undefined,
      _tempProductName: product.product_name,
      _tempProductCode: product.product_code,
      _tempVariant: product.variant || "",
      _tempUnitPrice: product.purchase_price / 1000,
      _tempSellingPrice: product.selling_price / 1000,
      _tempTotalPrice: product.purchase_price / 1000,
      _tempProductImages: product.product_images || [],
      _tempPriceImages: product.price_images || []
    }));

    newItems.splice(currentItemIndex + 1, 0, ...additionalItems);
    setItems(newItems);

    // Auto-fill supplier name if empty
    if (!supplierName && firstProduct.supplier_name) {
      setSupplierName(firstProduct.supplier_name);
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
  const applyToAllVariants = (productCode: string, fieldName: string, value: any) => {
    if (!productCode) return;
    
    const updatedItems = items.map(item => {
      if (item._tempProductCode === productCode) {
        return { ...item, [fieldName]: value };
      }
      return item;
    });
    
    setItems(updatedItems);
    
    const affectedCount = updatedItems.filter(item => item._tempProductCode === productCode).length;
    toast({
      title: "✅ Đã áp dụng",
      description: `Đã cập nhật ${affectedCount} dòng sản phẩm với mã ${productCode}`,
    });
  };

  // Check if should show apply button
  const shouldShowApplyButton = (productCode: string) => {
    return items.filter(item => item._tempProductCode === productCode).length > 1;
  };

  // ✅ Apply ALL common fields to variants at once
  const applyAllFieldsToVariants = (sourceIndex: number) => {
    const sourceItem = items[sourceIndex];
    if (!sourceItem._tempProductCode) return;

    const fieldsToApply: (keyof PurchaseOrderItem)[] = [
      '_tempProductName',
      '_tempUnitPrice',
      '_tempSellingPrice', 
      '_tempProductImages',
      '_tempPriceImages'
    ];

    const updatedItems = items.map((item, idx) => {
      // Only update items with same product_code but different index
      if (item._tempProductCode === sourceItem._tempProductCode && idx !== sourceIndex) {
        const updated = { 
          ...item,
          _tempProductName: sourceItem._tempProductName,
          _tempUnitPrice: sourceItem._tempUnitPrice,
          _tempSellingPrice: sourceItem._tempSellingPrice,
          _tempProductImages: [...(sourceItem._tempProductImages || [])],
          _tempPriceImages: [...(sourceItem._tempPriceImages || [])]
        };

        // ✅ Recalculate _tempTotalPrice
        updated._tempTotalPrice = updated.quantity * Number(updated._tempUnitPrice || 0);
        
        return updated;
      }
      return item;
    });

    setItems(updatedItems);
    
    const variantCount = items.filter(i => i._tempProductCode === sourceItem._tempProductCode).length;
    toast({
      title: "✅ Đã áp dụng cho tất cả biến thể",
      description: `Đã cập nhật ${variantCount} dòng: tên, giá mua, giá bán, hình ảnh`,
    });
  };

  // Check if should show "Apply All" button
  const shouldShowApplyAllButton = (index: number) => {
    const item = items[index];
    if (!item._tempProductCode || item.id) return false; // Don't show for saved items
    
    const variantCount = items.filter(i => i._tempProductCode === item._tempProductCode).length;
    if (variantCount <= 1) return false;
    
    // At least ONE field must be filled
    return (
      Number(item._tempUnitPrice) > 0 ||
      Number(item._tempSellingPrice) > 0 ||
      (item._tempProductImages && item._tempProductImages.length > 0) ||
      (item._tempPriceImages && item._tempPriceImages.length > 0)
    );
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      // ✅ VALIDATION: Check all items before submitting
      const validation = validateItems();
      if (!validation.isValid) {
        const errorMessage = "❌ Vui lòng điền đầy đủ thông tin:\n\n" + validation.invalidFields.join("\n");
        throw new Error(errorMessage);
      }
      
      if (!order?.id) throw new Error("Order ID is required");
      if (!supplierName.trim()) {
        throw new Error("Vui lòng nhập tên nhà cung cấp");
      }

      const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0) * 1000;
      const discountAmountValue = parseNumberInput(discountAmount) * 1000;
      const shippingFeeValue = parseNumberInput(shippingFee) * 1000;
      const finalAmount = totalAmount - discountAmountValue + shippingFeeValue;

      // Step 1: Update purchase order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          order_date: orderDate,
          supplier_name: supplierName.trim().toUpperCase(),
          notes: notes.trim().toUpperCase() || null,
          invoice_images: invoiceImages.length > 0 ? invoiceImages : null,
          invoice_amount: parseNumberInput(invoiceAmount) * 1000,
          total_amount: totalAmount,
          discount_amount: discountAmountValue,
          shipping_fee: shippingFeeValue,
          final_amount: finalAmount,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Step 2: Get IDs of items to delete
      const existingItemIds = existingItems?.map(item => item.id) || [];
      const currentItemIds = items.filter(item => item.id).map(item => item.id);
      const deletedItemIds = existingItemIds.filter(id => !currentItemIds.includes(id));

      // Delete removed items
      if (deletedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("purchase_order_items")
          .delete()
          .in("id", deletedItemIds);

        if (deleteError) throw deleteError;
      }

      // Step 3: Update existing items and insert new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemData = {
          purchase_order_id: order.id,
          quantity: item.quantity,
          notes: item.notes.trim().toUpperCase() || null,
          position: item.position || (i + 1),
          // Primary data fields (renamed from snapshot)
          product_code: item._tempProductCode.trim().toUpperCase(),
          product_name: item._tempProductName.trim().toUpperCase(),
          variant: item._tempVariant.trim().toUpperCase() || null,
          purchase_price: Number(item._tempUnitPrice || 0) * 1000,
          selling_price: Number(item._tempSellingPrice || 0) * 1000,
          product_images: item._tempProductImages || [],
          price_images: item._tempPriceImages || []
        };

        if (item.id) {
          // Update existing item
          const { error: updateError } = await supabase
            .from("purchase_order_items")
            .update(itemData)
            .eq("id", item.id);

          if (updateError) throw updateError;
        } else {
          // Insert new item
          const { error: insertError } = await supabase
            .from("purchase_order_items")
            .insert(itemData);

          if (insertError) throw insertError;
        }
      }

      return order.id;
    },
    onSuccess: async () => {
      // Invalidate queries to refetch fresh data from database
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrderItems", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
      
      toast({
        title: "Cập nhật đơn hàng thành công!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi cập nhật đơn hàng",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    updateOrderMutation.mutate();
  };

  const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0);
  const finalAmount = totalAmount - parseNumberInput(discountAmount) + parseNumberInput(shippingFee);

  // Handle dialog close with confirmation
  const handleClose = async () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pr-10">
          <DialogTitle>Chỉnh sửa đơn hàng #{order?.id.slice(0, 8)}</DialogTitle>
          <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 border border-destructive/30 hover:border-destructive/50">
                <RotateCcw className="w-4 h-4" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa toàn bộ dữ liệu?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc muốn xóa toàn bộ dữ liệu đã nhập? Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  resetForm();
                  setShowClearConfirm(false);
                }}>
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Nhà cung cấp *</Label>
              <Input
                id="supplier"
                placeholder="Nhập tên nhà cung cấp"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_date">Ngày đặt hàng</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !orderDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {orderDate ? format(new Date(orderDate), "dd/MM/yyyy") : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={orderDate ? new Date(orderDate) : undefined}
                    onSelect={(date) => setOrderDate(date ? date.toISOString() : new Date().toISOString())}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_amount">Số tiền hóa đơn (VND)</Label>
              <Input
                id="invoice_amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số tiền VND"
                value={invoiceAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*$/.test(value)) {
                    setInvoiceAmount(value);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_images">Ảnh hóa đơn</Label>
              <div className="border rounded-md p-2 min-h-[42px] bg-background">
                <ImageUploadCell
                  images={invoiceImages}
                  onImagesChange={setInvoiceImages}
                  itemIndex={-1}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-medium">Danh sách sản phẩm</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openSelectProduct(items.length > 0 && items[items.length - 1]._tempProductName ? items.length : items.length - 1)}
              >
                <Warehouse className="h-4 w-4 mr-2" />
                Chọn từ Kho SP
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">STT</TableHead>
                    <TableHead className="w-[260px]">Tên sản phẩm</TableHead>
                    <TableHead className="w-[70px]">Mã sản phẩm</TableHead>
                    <TableHead className="w-[150px]">Biến thể</TableHead>
                    <TableHead className="w-[60px]">SL</TableHead>
                    <TableHead className="w-[90px]">Giá mua (VND)</TableHead>
                    <TableHead className="w-[90px]">Giá bán (VND)</TableHead>
                    <TableHead className="w-[130px]">Thành tiền (VND)</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh sản phẩm</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh Giá mua</TableHead>
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
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          disabled={!!item.id}
                          placeholder="Nhập tên sản phẩm"
                          value={item._tempProductName}
                          onChange={(e) => updateItem(index, "_tempProductName", e.target.value)}
                          className={cn(
                            "border-0 shadow-none focus-visible:ring-0 p-2 min-h-[60px] resize-none",
                            item.id && "bg-muted/50 cursor-not-allowed opacity-70"
                          )}
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Input
                            id={`temp-product-code-${index}`}
                            disabled={!!item.id}
                            placeholder="Mã SP"
                            value={item._tempProductCode}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateItem(index, "_tempProductCode", value);
                              if (value.trim()) {
                                const newItems = [...items];
                                newItems[index]._manualCodeEdit = true;
                                setItems(newItems);
                              }
                            }}
                            className={cn(
                              "border-0 shadow-none focus-visible:ring-0 p-2 w-[70px] text-xs flex-1",
                              item.id && "bg-muted/50 cursor-not-allowed opacity-70"
                            )}
                            maxLength={10}
                            readOnly={!item._manualCodeEdit}
                          />
                          {!item.id && (
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
                                    document.getElementById(`temp-product-code-${index}`)?.focus();
                                  }, 0);
                                }
                              }}
                            >
                              {item._manualCodeEdit ? <Check className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left h-auto py-2 px-3"
                          disabled={!!item.id}
                          onClick={() => {
                            if (!item.id) {
                              setVariantGeneratorIndex(index);
                              setIsVariantGeneratorOpen(true);
                            }
                          }}
                        >
                          {item._tempVariant ? (
                            <span className="font-medium text-xs">{item._tempVariant}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">
                              {item.id ? "Không có biến thể" : "Nhấn để tạo biến thể"}
                            </span>
                          )}
                        </Button>
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
                          disabled={!!item.id}
                          type="text"
                          inputMode="numeric"
                          placeholder=""
                          value={item._tempUnitPrice === 0 || item._tempUnitPrice === "" ? "" : item._tempUnitPrice}
                          onChange={(e) => updateItem(index, "_tempUnitPrice", parseNumberInput(e.target.value))}
                          className={cn(
                            "border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm",
                            item.id && "bg-muted/50 cursor-not-allowed opacity-70"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={!!item.id}
                          type="text"
                          inputMode="numeric"
                          placeholder=""
                          value={item._tempSellingPrice === 0 || item._tempSellingPrice === "" ? "" : item._tempSellingPrice}
                          onChange={(e) => updateItem(index, "_tempSellingPrice", parseNumberInput(e.target.value))}
                          className={cn(
                            "border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm",
                            item.id && "bg-muted/50 cursor-not-allowed opacity-70"
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVND(item._tempTotalPrice * 1000)}
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item._tempProductImages}
                          onImagesChange={(images) => updateItem(index, "_tempProductImages", images)}
                          itemIndex={index}
                          disabled={!!item.id}
                        />
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item._tempPriceImages}
                          onImagesChange={(images) => updateItem(index, "_tempPriceImages", images)}
                          itemIndex={index}
                          disabled={!!item.id}
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
                          {item.selected_attribute_value_ids && item.selected_attribute_value_ids.length > 0 ? (
                            <div className="space-y-1 max-h-[120px] overflow-y-auto text-xs">
                              {item.selected_attribute_value_ids.map((id, idx) => (
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
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="text-right font-semibold">
                      Tổng số lượng:
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </TableCell>
                    <TableCell colSpan={showDebugColumn ? 8 : 7}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center">
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Thêm sản phẩm
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm cho đơn hàng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Tổng tiền:</span>
                <span>{formatVND(totalAmount * 1000)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-medium">Giảm giá:</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-40 text-right"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*$/.test(value)) {
                      setDiscountAmount(value);
                    }
                  }}
                />
              </div>
              
              {!showShippingFee ? (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShippingFee(true)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Truck className="w-4 h-4" />
                    Thêm tiền ship
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Tiền ship:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="w-40 text-right"
                      placeholder="0"
                      value={shippingFee}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d*$/.test(value)) {
                          setShippingFee(value);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowShippingFee(false);
                        setShippingFee("");
                      }}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Thành tiền:</span>
                <span>{formatVND(finalAmount * 1000)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button 
              onClick={() => {
                // Show validation errors if any
                if (!isItemsValid) {
                  toast({
                    title: "Không thể cập nhật đơn hàng",
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
                handleSubmit();
              }}
              disabled={updateOrderMutation.isPending || !isItemsValid}
              className={!isItemsValid ? "opacity-50 cursor-not-allowed" : ""}
            >
              {updateOrderMutation.isPending ? "Đang cập nhật..." : "Cập nhật đơn hàng"}
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
            ? items[variantGeneratorIndex]?._tempProductCode 
            : undefined
        }
        onSubmit={(result) => {
          if (variantGeneratorIndex !== null && result.hasVariants && result.combinations) {
            const sourceItem = items[variantGeneratorIndex];
            
            console.log('🔵 Creating variants from source item:', {
              sourceIndex: variantGeneratorIndex,
              sourceName: sourceItem._tempProductName,
              sourceCode: sourceItem._tempProductCode,
              combinationsCount: result.combinations.length
            });
            
            // Create N new variant items
            const newVariantItems = result.combinations.map((combo, index) => ({
              ...sourceItem,
              _tempProductName: sourceItem._tempProductName,
              _tempProductCode: sourceItem._tempProductCode,
              _tempVariant: combo.combinationString,
              quantity: 1,
              _tempUnitPrice: sourceItem._tempUnitPrice,
              _tempSellingPrice: sourceItem._tempSellingPrice,
              _tempTotalPrice: 1 * Number(sourceItem._tempUnitPrice || 0),
              _tempProductImages: [...(sourceItem._tempProductImages || [])],
              _tempPriceImages: [...(sourceItem._tempPriceImages || [])],
              selected_attribute_value_ids: combo.selectedAttributeValueIds,
              variant: combo.combinationString,
              product_name: sourceItem._tempProductName,
              product_code: sourceItem._tempProductCode,
              purchase_price: Number(sourceItem._tempUnitPrice || 0),
              selling_price: Number(sourceItem._tempSellingPrice || 0),
              product_images: [...(sourceItem._tempProductImages || [])],
              price_images: [...(sourceItem._tempPriceImages || [])],
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
              Các thay đổi chưa lưu sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              onOpenChange(false);
            }}>
              Đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}