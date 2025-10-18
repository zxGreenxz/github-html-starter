import { useState, useEffect } from "react";
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
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Sparkles, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantDropdownSelector } from "./VariantDropdownSelector";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { useCreateVariantProducts } from "@/hooks/use-create-variant-products";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { generateProductCodeFromMax, incrementProductCode } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";


interface PurchaseOrderItem {
  id?: string;
  product_id: string | null;
  quantity: number;
  notes: string;
  position?: number;
  
  // Product data from JOIN
  product?: {
    id: string;
    product_code: string;
    product_name: string;
    variant: string | null;
    purchase_price: number;
    selling_price: number;
    product_images: string[] | null;
    price_images: string[] | null;
  };
  
  // Temporary UI fields
  _tempProductName: string;
  _tempProductCode: string;
  _tempVariant: string;
  _tempUnitPrice: number | string;
  _tempSellingPrice: number | string;
  _tempTotalPrice: number;
  _tempProductImages: string[];
  _tempPriceImages: string[];
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  invoice_number: string | null;
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

export function EditPurchaseOrderDialog({ order, open, onOpenChange }: EditPurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [showShippingFee, setShowShippingFee] = useState(false);
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { 
      product_id: null,
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [variantGeneratorIndex, setVariantGeneratorIndex] = useState<number | null>(null);

  const createVariantProducts = useCreateVariantProducts();

  // Debounce product names for auto-generating codes
  const debouncedProductNames = useDebounce(
    items.map(i => i._tempProductName).join('|'),
    500
  );

  // Auto-generate product code when product name changes (with debounce)
  useEffect(() => {
    items.forEach(async (item, index) => {
      if (item._tempProductName.trim() && !item._tempProductCode.trim()) {
        try {
          const tempItems = items.map(i => ({ product_name: i._tempProductName, product_code: i._tempProductCode }));
          const code = await generateProductCodeFromMax(item._tempProductName, tempItems);
          setItems(prev => {
            const newItems = [...prev];
            if (newItems[index] && !newItems[index]._tempProductCode.trim()) {
              newItems[index] = { ...newItems[index], _tempProductCode: code };
            }
            return newItems;
          });
        } catch (error) {
          console.error("Error generating product code:", error);
        }
      }
    });
  }, [debouncedProductNames]);

  // Fetch existing items when order changes (with JOIN to products)
  const { data: existingItems } = useQuery({
    queryKey: ["purchaseOrderItems", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(`
          *,
          product:products(*)
        `)
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
      setInvoiceNumber(order.invoice_number || "");
      setNotes(order.notes || "");
      setInvoiceImages(order.invoice_images || []);
      setInvoiceAmount(order.total_amount ? order.total_amount / 1000 : 0);
      setDiscountAmount(order.discount_amount ? order.discount_amount / 1000 : 0);
      const orderShippingFee = (order as any).shipping_fee ? (order as any).shipping_fee / 1000 : 0;
      setShippingFee(orderShippingFee);
      setShowShippingFee(orderShippingFee > 0);
    }
  }, [order, open]);

  // Load items when existingItems change
  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product: item.product,
        quantity: item.quantity || 1,
        notes: item.notes || "",
        position: item.position,
        _tempProductName: item.product?.product_name || "",
        _tempProductCode: item.product?.product_code || "",
        _tempVariant: item.product?.variant || "",
        _tempUnitPrice: item.product ? Number(item.product.purchase_price) / 1000 : 0,
        _tempSellingPrice: item.product ? Number(item.product.selling_price) / 1000 : 0,
        _tempTotalPrice: item.product ? (item.quantity * Number(item.product.purchase_price) / 1000) : 0,
        _tempProductImages: item.product?.product_images || [],
        _tempPriceImages: item.product?.price_images || [],
      })));
    } else if (open && existingItems) {
      // If no existing items, add one empty row
      setItems([{
        product_id: null,
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
    setInvoiceNumber("");
    setNotes("");
    setInvoiceImages([]);
    setInvoiceAmount(0);
    setDiscountAmount(0);
    setShippingFee(0);
    setShowShippingFee(false);
    setItems([{
      product_id: null,
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

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === '_tempUnitPrice') {
      const qty = field === 'quantity' ? value : newItems[index].quantity;
      const price = field === '_tempUnitPrice' ? value : newItems[index]._tempUnitPrice;
      newItems[index]._tempTotalPrice = qty * Number(price || 0);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_id: null,
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
    delete itemToCopy.id; // Remove id so it will be inserted as new
    itemToCopy.product_id = null; // Clear product_id for new item
    // Deep copy the image arrays
    itemToCopy._tempProductImages = [...itemToCopy._tempProductImages];
    itemToCopy._tempPriceImages = [...itemToCopy._tempPriceImages];
    
    // Generate product code using generateProductCodeFromMax logic
    if (itemToCopy._tempProductName.trim()) {
      try {
        const tempItems = items.map(i => ({ product_name: i._tempProductName, product_code: i._tempProductCode }));
        const newCode = await generateProductCodeFromMax(itemToCopy._tempProductName, tempItems);
        itemToCopy._tempProductCode = newCode;
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
        product_id: null,
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
        product_id: product.id,
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
      product_id: firstProduct.id,
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
      product_id: product.id,
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

  const handleVariantsGenerated = (
    index: number,
    variants: Array<{
      fullCode: string;
      variantCode: string;
      productName: string;
      variantText: string;
      hasCollision: boolean;
    }>,
    selectedIndices: number[]
  ) => {
    const baseItem = items[index];

    // Extract all individual variant parts from all child variants
    // IMPORTANT: Keep original order, do NOT sort
    const allVariantParts: string[] = [];
    const seenParts = new Set<string>();
    
    for (const v of variants) {
      const parts = v.variantText.split(',').map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (!seenParts.has(part)) {
          seenParts.add(part);
          allVariantParts.push(part);
        }
      }
    }
    
    const mergedVariant = allVariantParts.join(', ');

    // Prepare base product data
    const baseProductData = {
      product_code: baseItem._tempProductCode.trim().toUpperCase(),
      product_name: baseItem._tempProductName.trim().toUpperCase(),
      variant: mergedVariant || null,
      purchase_price: Number(baseItem._tempUnitPrice) * 1000,
      selling_price: Number(baseItem._tempSellingPrice) * 1000,
      supplier_name: supplierName || undefined,
      stock_quantity: 0,
      product_images: [...baseItem._tempProductImages],
      price_images: [...baseItem._tempPriceImages]
    };

    // Prepare child variants data
    const childVariantsData = variants.map(v => ({
      product_code: v.fullCode.toUpperCase(),
      base_product_code: baseItem._tempProductCode.trim().toUpperCase(),
      product_name: v.productName.toUpperCase(),
      variant: v.variantText,
      purchase_price: Number(baseItem._tempUnitPrice) * 1000,
      selling_price: Number(baseItem._tempSellingPrice) * 1000,
      supplier_name: supplierName || undefined,
      product_images: baseItem._tempProductImages,
      price_images: baseItem._tempPriceImages
    }));

    // Call mutation to upsert base product and create child variants
    createVariantProducts.mutate({ 
      baseProduct: baseProductData,
      childVariants: childVariantsData,
      onSuccessCallback: () => {
        // New logic based on selectedIndices
        if (selectedIndices.length === 0) {
          // No checkboxes selected → Clear the line
          const emptyItem: PurchaseOrderItem = {
            id: undefined,
            product_id: null,
            quantity: 1,
            notes: "",
            position: items[index].position,
            _tempProductName: "",
            _tempVariant: "",
            _tempProductCode: "",
            _tempUnitPrice: "",
            _tempSellingPrice: "",
            _tempTotalPrice: 0,
            _tempProductImages: [],
            _tempPriceImages: []
          };
          
          setItems(prev => {
            const newItems = [...prev];
            newItems[index] = emptyItem;
            return newItems;
          });
        } else if (selectedIndices.length === 1) {
          // 1 checkbox selected → Fill current line
          const selectedVariant = variants[selectedIndices[0]];
          
          setItems(prev => {
            const newItems = [...prev];
            newItems[index] = {
              ...newItems[index],
              _tempProductCode: selectedVariant.fullCode,
              _tempProductName: selectedVariant.productName,
              _tempVariant: selectedVariant.variantText,
            };
            return newItems;
          });
          
          toast({
            title: "Đã điền thông tin biến thể",
            description: `Mã sản phẩm: ${selectedVariant.fullCode}`,
          });
        } else {
          // Multiple checkboxes selected → Fill first line + add new lines
          const selectedVariants = selectedIndices.map(i => variants[i]);
          
          setItems(prev => {
            const newItems = [...prev];
            
            // Fill first line
            const firstVariant = selectedVariants[0];
            newItems[index] = {
              ...newItems[index],
              _tempProductCode: firstVariant.fullCode,
              _tempProductName: firstVariant.productName,
              _tempVariant: firstVariant.variantText,
            };
            
            // Add additional lines
            const additionalItems = selectedVariants.slice(1).map(variant => ({
              id: undefined,
              product_id: null,
              quantity: 1,
              notes: "",
              position: undefined,
              _tempProductName: variant.productName,
              _tempVariant: variant.variantText,
              _tempProductCode: variant.fullCode,
              _tempUnitPrice: baseItem._tempUnitPrice,
              _tempSellingPrice: baseItem._tempSellingPrice,
              _tempTotalPrice: Number(baseItem._tempUnitPrice) * 1,
              _tempProductImages: [...baseItem._tempProductImages],
              _tempPriceImages: [...baseItem._tempPriceImages]
            }));
            
            // Insert after current line
            newItems.splice(index + 1, 0, ...additionalItems);
            
            return newItems;
          });
          
          toast({
            title: "Đã thêm biến thể",
            description: `Đã thêm ${selectedVariants.length} biến thể vào đơn hàng`,
          });
        }
      }
    });
  };

  const openVariantGenerator = (index: number) => {
    const item = items[index];
    
    // Validation: Check all required fields
    const missingFields = [];
    
    if (!item._tempProductName.trim()) missingFields.push("Tên sản phẩm");
    if (!item._tempProductCode.trim()) missingFields.push("Mã sản phẩm");
    if (!item._tempUnitPrice || Number(item._tempUnitPrice) <= 0) missingFields.push("Giá mua");
    if (!item._tempSellingPrice || Number(item._tempSellingPrice) <= 0) missingFields.push("Giá bán");
    if (!item._tempProductImages || item._tempProductImages.length === 0) missingFields.push("Hình ảnh sản phẩm");
    
    if (missingFields.length > 0) {
      toast({
        title: "Thiếu thông tin",
        description: `Vui lòng điền: ${missingFields.join(", ")}`,
        variant: "destructive"
      });
      return;
    }
    
    setVariantGeneratorIndex(index);
    setIsVariantDialogOpen(true);
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order?.id) throw new Error("Order ID is required");
      if (!supplierName.trim()) {
        throw new Error("Vui lòng nhập tên nhà cung cấp");
      }

      const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0) * 1000;
      const finalAmount = totalAmount - (discountAmount * 1000) + (shippingFee * 1000);

      // Step 1: Create/update products first
      const productIds: (string | null)[] = [];
      
      for (const item of items) {
        if (!item._tempProductCode.trim()) {
          productIds.push(null);
          continue;
        }
        
        if (item.product_id) {
          // Update existing product
          await supabase
            .from("products")
            .update({
              product_name: item._tempProductName.trim().toUpperCase(),
              purchase_price: Number(item._tempUnitPrice || 0) * 1000,
              selling_price: Number(item._tempSellingPrice || 0) * 1000,
              variant: item._tempVariant.trim().toUpperCase() || null,
              product_images: item._tempProductImages,
              price_images: item._tempPriceImages
            })
            .eq("id", item.product_id);
          
          productIds.push(item.product_id);
        } else {
          // Check if product exists by code
          const { data: existingProduct } = await supabase
            .from("products")
            .select("id")
            .eq("product_code", item._tempProductCode.trim().toUpperCase())
            .maybeSingle();
          
          if (existingProduct) {
            productIds.push(existingProduct.id);
          } else {
            // Create new product
            const { data: newProduct } = await supabase
              .from("products")
              .insert({
                product_code: item._tempProductCode.trim().toUpperCase(),
                base_product_code: item._tempProductCode.trim().toUpperCase(),
                product_name: item._tempProductName.trim().toUpperCase(),
                variant: item._tempVariant.trim().toUpperCase() || null,
                purchase_price: Number(item._tempUnitPrice || 0) * 1000,
                selling_price: Number(item._tempSellingPrice || 0) * 1000,
                supplier_name: supplierName.trim().toUpperCase(),
                stock_quantity: 0,
                product_images: item._tempProductImages || [],
                price_images: item._tempPriceImages || []
              })
              .select("id")
              .single();
            
            productIds.push(newProduct?.id || null);
          }
        }
      }

      // Step 2: Update purchase order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          order_date: orderDate,
          supplier_name: supplierName.trim().toUpperCase(),
          invoice_number: invoiceNumber.trim().toUpperCase() || null,
          notes: notes.trim().toUpperCase() || null,
          invoice_images: invoiceImages.length > 0 ? invoiceImages : null,
          total_amount: totalAmount,
          discount_amount: discountAmount * 1000,
          shipping_fee: shippingFee * 1000,
          final_amount: finalAmount,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Step 3: Get IDs of items to delete
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

      // Step 4: Update existing items and insert new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemData = {
          purchase_order_id: order.id,
          product_id: productIds[i],
          quantity: item.quantity,
          notes: item.notes.trim().toUpperCase() || null,
          position: item.position || (i + 1),
          // Snapshot data
          product_code_snapshot: item._tempProductCode.trim().toUpperCase(),
          product_name_snapshot: item._tempProductName.trim().toUpperCase(),
          variant_snapshot: item._tempVariant.trim().toUpperCase() || null,
          purchase_price_snapshot: Number(item._tempUnitPrice || 0) * 1000,
          selling_price_snapshot: Number(item._tempSellingPrice || 0) * 1000,
          product_images_snapshot: item._tempProductImages || [],
          price_images_snapshot: item._tempPriceImages || []
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
    onSuccess: () => {
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
  const finalAmount = totalAmount - discountAmount + shippingFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pr-10">
          <DialogTitle>Chỉnh sửa đơn hàng #{order?.invoice_number || order?.id.slice(0, 8)}</DialogTitle>
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
                value={invoiceAmount || ""}
                onChange={(e) => setInvoiceAmount(parseNumberInput(e.target.value))}
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
                    <TableHead className="w-[60px]">SL</TableHead>
                    <TableHead className="w-[90px]">Giá mua (VND)</TableHead>
                    <TableHead className="w-[90px]">Giá bán (VND)</TableHead>
                    <TableHead className="w-[130px]">Thành tiền (VND)</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh sản phẩm</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh Giá mua</TableHead>
                    <TableHead className="w-[150px]">Biến thể</TableHead>
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
                          value={item._tempProductName}
                          onChange={(e) => updateItem(index, "_tempProductName", e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 min-h-[60px] resize-none"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Mã SP"
                          value={item._tempProductCode}
                          onChange={(e) => updateItem(index, "_tempProductCode", e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 w-[70px] text-xs"
                          maxLength={10}
                        />
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
                          placeholder=""
                          value={item._tempUnitPrice === 0 || item._tempUnitPrice === "" ? "" : item._tempUnitPrice}
                          onChange={(e) => updateItem(index, "_tempUnitPrice", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder=""
                          value={item._tempSellingPrice === 0 || item._tempSellingPrice === "" ? "" : item._tempSellingPrice}
                          onChange={(e) => updateItem(index, "_tempSellingPrice", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm"
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
                        />
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item._tempPriceImages}
                          onImagesChange={(images) => updateItem(index, "_tempPriceImages", images)}
                          itemIndex={index}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <VariantDropdownSelector
                            baseProductCode={item._tempProductCode}
                            value={item._tempVariant}
                            onChange={(value) => updateItem(index, "_tempVariant", value)}
                            onVariantSelect={(data) => {
                              updateItem(index, "_tempProductCode", data.productCode);
                              updateItem(index, "_tempProductName", data.productName);
                              updateItem(index, "_tempVariant", data.variant);
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => openVariantGenerator(index)}
                            title="Tạo biến thể tự động"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
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
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(parseNumberInput(e.target.value))}
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
                      value={shippingFee || ""}
                      onChange={(e) => setShippingFee(parseNumberInput(e.target.value))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowShippingFee(false);
                        setShippingFee(0);
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
              onClick={handleSubmit}
              disabled={updateOrderMutation.isPending}
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

      {variantGeneratorIndex !== null && items[variantGeneratorIndex] && (
        <VariantGeneratorDialog
          open={isVariantDialogOpen}
          onOpenChange={setIsVariantDialogOpen}
          currentItem={{
            product_code: items[variantGeneratorIndex]._tempProductCode,
            product_name: items[variantGeneratorIndex]._tempProductName
          }}
          onVariantsGenerated={(variants, selectedIndices) => {
            handleVariantsGenerated(variantGeneratorIndex, variants, selectedIndices);
            setVariantGeneratorIndex(null);
          }}
        />
      )}
    </Dialog>
  );
}