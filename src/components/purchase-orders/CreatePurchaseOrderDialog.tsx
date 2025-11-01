import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Truck, Edit, Check, Pencil, ChevronLeft, ChevronRight, ArrowDown, ArrowDownToLine, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { generateProductCodeFromMax, incrementProductCode, extractBaseProductCode, cleanupReservations } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/AuthContext";
import { exportPurchaseOrderToExcel } from "@/lib/purchase-order-excel-exporter";
import { Loader2 } from "lucide-react";

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

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any | null;
}

export function CreatePurchaseOrderDialog({ open, onOpenChange, initialData }: CreatePurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  const [formData, setFormData] = useState({
    supplier_name: "",
    order_date: new Date().toISOString(),
    notes: "",
    invoice_images: [] as string[],
    invoice_amount: 0,
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
  const [isProcessing, setIsProcessing] = useState(false);

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
      }
      
      setShowShippingFee((initialData.shipping_fee || 0) > 0);
    }
  }, [open, initialData]);

  // Auto-generate product code when product name changes (with debounce)
  useEffect(() => {
    items.forEach(async (item, index) => {
      // Only auto-generate if user hasn't manually focused on the product_code field
      if (item.product_name.trim() && !item.product_code.trim() && !manualProductCodes.has(index)) {
        try {
          const tempItems = items.map(i => ({ product_name: i.product_name, product_code: i.product_code }));
          const code = await generateProductCodeFromMax(item.product_name, tempItems, user?.id);
          setItems(prev => {
            const newItems = [...prev];
            if (newItems[index] && !newItems[index].product_code.trim() && !manualProductCodes.has(index)) {
              newItems[index] = { ...newItems[index], product_code: code };
            }
            return newItems;
          });
        } catch (error) {
          console.error("Error generating product code:", error);
        }
      }
    });
  }, [debouncedProductNames, manualProductCodes, user?.id]);

  // Validation function - check if all items have required fields
  const validateItems = (): { isValid: boolean; invalidFields: string[] } => {
    const invalidFields: string[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check required fields
      if (!item.product_name?.trim()) {
        invalidFields.push(`Dòng ${i + 1}: Thiếu tên sản phẩm`);
      }
      if (!item.product_code?.trim()) {
        invalidFields.push(`Dòng ${i + 1}: Thiếu mã sản phẩm`);
      }
      if (!item.purchase_price || Number(item.purchase_price) <= 0) {
        invalidFields.push(`Dòng ${i + 1}: Giá mua phải > 0`);
      }
      if (!item.selling_price || Number(item.selling_price) <= 0) {
        invalidFields.push(`Dòng ${i + 1}: Giá bán phải > 0`);
      }
      // Check selling price > purchase price
      if (Number(item.selling_price) <= Number(item.purchase_price)) {
        invalidFields.push(`Dòng ${i + 1}: Giá bán (${formatVND(Number(item.selling_price) * 1000)}) phải lớn hơn giá mua (${formatVND(Number(item.purchase_price) * 1000)})`);
      }
      if (!item.product_images || item.product_images.length === 0) {
        invalidFields.push(`Dòng ${i + 1}: Thiếu hình ảnh sản phẩm`);
      }
    }
    
    return {
      isValid: invalidFields.length === 0,
      invalidFields
    };
  };

  // Real-time validation state
  const { isValid: isItemsValid, invalidFields } = useMemo(() => validateItems(), [items]);

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
      // Cleanup reservations
      if (user?.id) {
        const codes = items.map(i => i.product_code).filter(Boolean);
        await cleanupReservations(codes, user.id);
      }
      
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
      setIsProcessing(true);

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
        
        // Kiểm tra Tên sản phẩm
        if (!item.product_name?.trim()) {
          validationErrors.push(`Dòng ${itemNumber}: Thiếu Tên sản phẩm`);
        }
        
        // Kiểm tra Mã sản phẩm
        if (!item.product_code?.trim()) {
          validationErrors.push(`Dòng ${itemNumber}: Thiếu Mã sản phẩm`);
        }
        
        // Kiểm tra Hình ảnh sản phẩm
        if (!item.product_images || item.product_images.length === 0) {
          validationErrors.push(`Dòng ${itemNumber}: Thiếu Hình ảnh sản phẩm`);
        }
        
        // Kiểm tra Giá mua
        if (!item.purchase_price || Number(item.purchase_price) <= 0) {
          validationErrors.push(`Dòng ${itemNumber}: Thiếu hoặc không hợp lệ Giá mua`);
        }
        
        // Kiểm tra Giá bán
        if (!item.selling_price || Number(item.selling_price) <= 0) {
          validationErrors.push(`Dòng ${itemNumber}: Thiếu hoặc không hợp lệ Giá bán`);
        }
        
        // Kiểm tra Giá bán > Giá mua
        if (Number(item.selling_price) <= Number(item.purchase_price)) {
          validationErrors.push(`Dòng ${itemNumber}: Giá bán (${formatVND(Number(item.selling_price) * 1000)}) phải lớn hơn giá mua (${formatVND(Number(item.purchase_price) * 1000)})`);
        }
      });

      // Hiển thị tất cả lỗi nếu có
      if (validationErrors.length > 0) {
        const errorMessage = "❌ Vui lòng điền đầy đủ thông tin:\n\n" + validationErrors.join("\n");
        throw new Error(errorMessage);
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

        // Step 3: AWAIT TPOS sync (SYNCHRONOUS)
        const toastId = sonnerToast.loading('⏳ Đang upload lên TPOS...', {
          duration: Infinity,
        });

        try {
          const { data: tposResult, error: tposError } = await supabase.functions.invoke(
            'process-purchase-order-background',
            { body: { purchase_order_id: order.id } }
          );

          if (tposError) {
            throw new Error(`Upload TPOS thất bại: ${tposError.message}`);
          }

          const { succeeded, failed } = tposResult;

          if (failed > 0) {
            throw new Error(`Upload TPOS thất bại: ${failed}/${items.filter(i => i.product_name.trim()).length} sản phẩm lỗi`);
          }

          sonnerToast.success('✅ Upload TPOS thành công!', {
            id: toastId,
            description: `Đã xử lý ${succeeded} sản phẩm`,
          });
        } catch (error: any) {
          sonnerToast.error('❌ Upload TPOS thất bại', {
            id: toastId,
            description: error.message,
            duration: 5000
          });
          throw error;
        }

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

        const parentProducts: any[] = [];
        for (const [productCode, { variants, data }] of parentProductsMap) {
          const { data: existing } = await supabase
            .from("products")
            .select("product_code")
            .eq("product_code", productCode)
            .maybeSingle();
          
          if (!existing) {
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

      // Step 3: AWAIT TPOS sync (SYNCHRONOUS)
      const toastId = sonnerToast.loading('⏳ Đang upload lên TPOS...', {
        duration: Infinity,
      });

      try {
        const { data: tposResult, error: tposError } = await supabase.functions.invoke(
          'process-purchase-order-background',
          { body: { purchase_order_id: order.id } }
        );

        if (tposError) {
          throw new Error(`Upload TPOS thất bại: ${tposError.message}`);
        }

        const { succeeded, failed } = tposResult;

        if (failed > 0) {
          throw new Error(`Upload TPOS thất bại: ${failed}/${items.filter(i => i.product_name.trim()).length} sản phẩm lỗi`);
        }

        sonnerToast.loading('⏳ Đang xuất Excel...', { id: toastId });

        // Step 3.5: Auto-export Excel
        try {
          await exportPurchaseOrderToExcel({ 
            id: order.id, 
            supplier_name: formData.supplier_name,
            items: items.filter(i => i.product_name.trim()).map(item => ({
              ...item,
              purchase_price: Number(item.purchase_price || 0) * 1000,
              selling_price: Number(item.selling_price || 0) * 1000,
            }))
          });

          sonnerToast.success('✅ Hoàn thành!', {
            id: toastId,
            description: `Đã tạo đơn hàng, upload TPOS và xuất Excel`,
            duration: 3000
          });
        } catch (exportError: any) {
          console.error('Auto export failed:', exportError);
          sonnerToast.warning('⚠️ Upload TPOS thành công nhưng xuất Excel thất bại', {
            id: toastId,
            description: exportError.message,
            duration: 5000
          });
        }
      } catch (error: any) {
        sonnerToast.error('❌ Lỗi xử lý đơn hàng', {
          id: toastId,
          description: error.message,
          duration: 5000
        });
        throw error;
      }

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

      // Create parent products with aggregated variants
      const parentProducts: any[] = [];
      for (const [productCode, { variants, data }] of parentProductsMap) {
        // Check if parent product exists
        const { data: existing } = await supabase
          .from("products")
          .select("product_code")
          .eq("product_code", productCode)
          .maybeSingle();
        
        if (!existing) {
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
      setIsProcessing(false);

      // Cleanup reservations
      if (user?.id) {
        const codes = items.map(i => i.product_code).filter(Boolean);
        await cleanupReservations(codes, user.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      
      toast({
        title: "Lỗi tạo đơn hàng",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
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

  // Handle dialog close with confirmation
  const handleClose = async () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      // No unsaved changes - close directly
      if (user?.id) {
        const codes = items.map(i => i.product_code).filter(Boolean);
        await cleanupReservations(codes, user.id);
      }
      onOpenChange(false);
      resetForm();
    }
  };

  const updateItem = async (index: number, field: keyof PurchaseOrderItem, value: any) => {
    // 🧹 Cleanup old reservation when manually changing product_code
    if (field === 'product_code' && user?.id) {
      const oldCode = items[index].product_code;
      const newCode = value as string;
      
      if (oldCode && oldCode !== newCode && oldCode.trim()) {
        await cleanupReservations([oldCode], user.id);
        console.log(`🧹 Cleaned old code: ${oldCode} → ${newCode}`);
      }
    }
    
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
    
    // Generate product code using generateProductCodeFromMax logic
    if (itemToCopy.product_name.trim()) {
      try {
        const tempItems = items.map(i => ({ product_name: i.product_name, product_code: i.product_code }));
        const newCode = await generateProductCodeFromMax(itemToCopy.product_name, tempItems);
        itemToCopy.product_code = newCode;
        toast({
          title: "Đã sao chép và tạo mã SP mới",
          description: `Mã mới: ${newCode}`,
        });
      } catch (error) {
        console.error("Error generating product code:", error);
      }
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
    
    // 🧹 Cleanup reservation
    if (user?.id && codeToCleanup?.trim()) {
      await cleanupReservations([codeToCleanup], user.id);
      console.log(`🧹 Cleaned reservation: ${codeToCleanup}`);
    }
  };

  /**
   * Determine tpos_sync_status based on product metadata
   * 
   * Type 1 (Has TPOS ID): tpos_product_id !== null
   *   → 'success' - Skip all processing (đã có trên TPOS)
   * 
   * Type 2 (New Variant): tpos_product_id === null && variant !== ''
   *   → 'pending' - Needs upload to TPOS + matching với products table
   * 
   * Type 3 (Simple Product): tpos_product_id === null && variant === ''
   *   → 'pending_no_match' - Needs upload to TPOS only, không cần matching
   */
  const determineSyncStatus = (
    tposProductId: number | null, 
    variant: string
  ): string => {
    if (tposProductId !== null) {
      return 'success'; // ✅ Type 1: Already on TPOS
    }
    
    if (variant && variant.trim() !== '') {
      return 'pending'; // ⚠️ Type 2: Needs matching after upload
    }
    
    return 'pending_no_match'; // ⚠️ Type 3: Upload only, no matching
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
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 relative">
        <DialogTitle className="sr-only">
          {initialData ? 'Chỉnh sửa đơn hàng' : 'Tạo đơn đặt hàng mới'}
        </DialogTitle>
        
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-lg">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg font-semibold">Đang xử lý đơn hàng...</p>
            </div>
          </div>
        )}

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
              <TableHead className="w-[70px]">Mã sản phẩm</TableHead>
              <TableHead className="w-[150px]">Biến thể</TableHead>
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
                  maxLength={10}
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
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-center"
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
              // Cleanup reservations
              if (user?.id) {
                const codes = items.map(i => i.product_code).filter(Boolean);
                await cleanupReservations(codes, user.id);
              }
              
              // Clear form and close
              resetForm();
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