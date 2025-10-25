import { useState, useEffect } from "react";
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
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Truck, Edit, Check, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { generateProductCodeFromMax, incrementProductCode, extractBaseProductCode } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";

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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [manualProductCodes, setManualProductCodes] = useState<Set<number>>(new Set());

  // Debounce product names for auto-generating codes
  const debouncedProductNames = useDebounce(
    items.map(i => i.product_name).join('|'),
    500
  );

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
          const code = await generateProductCodeFromMax(item.product_name, tempItems);
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
  }, [debouncedProductNames, manualProductCodes]);


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
              price_images: Array.isArray(item.price_images) ? item.price_images : []
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
            price_images: Array.isArray(item.price_images) ? item.price_images : []
          }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: () => {
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
            status: 'pending'
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
              : (item.price_images ? [item.price_images] : [])
          }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

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
          notes: formData.notes.trim().toUpperCase()
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
            : (item.price_images ? [item.price_images] : [])
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // Step 3: Create parent products in inventory
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
    onSuccess: () => {
      toast({ title: "Tạo đơn đặt hàng thành công!" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
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

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
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

  const removeItem = (index: number) => {
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
      
      // Fetch images with priority logic
      const productImages = await getProductImages(product);
      
      newItems[currentItemIndex] = {
        ...newItems[currentItemIndex],
        product_name: product.product_name,
        product_code: product.product_code,
        variant: product.variant || "",
        purchase_price: product.purchase_price / 1000,
        selling_price: product.selling_price / 1000,
        product_images: productImages,
        price_images: product.price_images || [],
        _tempTotalPrice: newItems[currentItemIndex].quantity * (product.purchase_price / 1000)
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
    
    // Validate currentItemIndex is within bounds
    if (currentItemIndex >= newItems.length || currentItemIndex < 0) {
      console.error('Invalid currentItemIndex:', currentItemIndex, 'items length:', newItems.length);
      return;
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
    
    newItems[currentItemIndex] = {
      ...currentItem,
      product_name: firstProduct.product_name,
      product_code: firstProduct.product_code,
      variant: firstProduct.variant || "",
      purchase_price: firstProduct.purchase_price / 1000,
      selling_price: firstProduct.selling_price / 1000,
      product_images: firstProductImages,
      price_images: firstProduct.price_images || [],
      _tempTotalPrice: currentItem.quantity * (firstProduct.purchase_price / 1000)
    };

    // Add remaining products as new lines WITH IMAGE FETCH
    const additionalItems = await Promise.all(
      products.slice(1).map(async (product) => {
        const productImages = await getProductImages(product);
        
        return {
          quantity: 1,
          notes: "",
          product_name: product.product_name,
          product_code: product.product_code,
          variant: product.variant || "",
          purchase_price: product.purchase_price / 1000,
          selling_price: product.selling_price / 1000,
          product_images: productImages,
          price_images: product.price_images || [],
          _tempTotalPrice: product.purchase_price / 1000,
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

  const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0);
  const finalAmount = totalAmount - formData.discount_amount + formData.shipping_fee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pr-10">
          <DialogTitle>Tạo đơn đặt hàng mới</DialogTitle>
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
                <AlertDialogAction onClick={() => {
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
                value={formData.supplier_name}
                onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
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

            <div className="space-y-2">
              <Label htmlFor="invoice_amount">Số tiền hóa đơn (VND)</Label>
              <Input
                id="invoice_amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số tiền VND"
                value={formData.invoice_amount || ""}
                onChange={(e) => setFormData({...formData, invoice_amount: parseNumberInput(e.target.value)})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_images">Ảnh hóa đơn</Label>
              <div className="border rounded-md p-2 min-h-[42px] bg-background">
                <ImageUploadCell
                  images={formData.invoice_images}
                  onImagesChange={(images) => setFormData({...formData, invoice_images: images})}
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
                onClick={() => openSelectProduct(items.length > 0 && items[items.length - 1].product_name ? items.length : items.length - 1)}
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
              <TableHead className="w-[100px] border-l-2 border-primary/30">Hình ảnh Giá mua</TableHead>
              <TableHead className="w-16">Thao tác</TableHead>
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
              </div>
            </TableCell>
                      <TableCell>
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
                            (item.selling_price === 0 || item.selling_price === "") 
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
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="text-right font-semibold">
                      Tổng số lượng:
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </TableCell>
                    <TableCell colSpan={7}></TableCell>
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
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
                  value={formData.discount_amount || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    discount_amount: parseNumberInput(e.target.value)
                  })}
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending}
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
        onSubmit={(result) => {
          if (variantGeneratorIndex !== null) {
            // Update both variant and quantity in a single batch
            updateItemMultiple(variantGeneratorIndex, {
              variant: result.variantString,
              quantity: result.totalQuantity,
            });

            toast({
              title: "Đã tạo biến thể",
              description: `Tạo ${result.totalQuantity} biến thể: ${result.variantString}`,
            });
          }
          setIsVariantGeneratorOpen(false);
          setVariantGeneratorIndex(null);
        }}
      />
    </Dialog>
  );
}