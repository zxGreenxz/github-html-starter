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
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Sparkles, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantDropdownSelector } from "./VariantDropdownSelector";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { detectAttributesFromText } from "@/lib/tpos-api";
import { generateProductCodeFromMax, incrementProductCode, extractBaseProductCode } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";

import { useCreateVariantProducts } from "@/hooks/use-create-variant-products";

interface PurchaseOrderItem {
  product_id: string | null;
  quantity: number;
  notes: string;
  position?: number;
  
  // Temporary fields for UI only (not saved to DB)
  _tempProductName: string;
  _tempVariant: string;
  _tempProductCode: string;
  _tempBaseProductCode?: string;
  _tempUnitPrice: number | string;
  _tempSellingPrice: number | string;
  _tempTotalPrice: number;
  _tempProductImages: string[];
  _tempPriceImages: string[];
}

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseOrderDialog({ open, onOpenChange }: CreatePurchaseOrderDialogProps) {
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
      product_id: null,
      quantity: 1,
      notes: "",
      _tempProductName: "",
      _tempVariant: "",
      _tempProductCode: "",
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


  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!formData.supplier_name.trim()) {
        throw new Error("Vui lòng nhập tên nhà cung cấp");
      }

      const totalAmount = items.reduce((sum, item) => sum + item._tempTotalPrice, 0) * 1000;
      const discountAmount = formData.discount_amount * 1000;
      const shippingFee = formData.shipping_fee * 1000;
      const finalAmount = totalAmount - discountAmount + shippingFee;

      // Step 1: Create/update products and collect product_ids
      const productIds: (string | null)[] = [];
      
      for (const item of items) {
        if (!item._tempProductCode.trim()) {
          productIds.push(null);
          continue;
        }
        
        if (item.product_id) {
          productIds.push(item.product_id);
          continue;
        }
        
        const productCode = item._tempProductCode.trim().toUpperCase();
        
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id")
          .eq("product_code", productCode)
          .maybeSingle();
        
        if (existingProduct) {
          productIds.push(existingProduct.id);
        } else {
          const { data: newProduct } = await supabase
            .from("products")
            .insert({
              product_code: productCode,
              base_product_code: productCode,
              product_name: item._tempProductName.trim().toUpperCase(),
              variant: item._tempVariant?.trim().toUpperCase() || null,
              purchase_price: Number(item._tempUnitPrice || 0) * 1000,
              selling_price: Number(item._tempSellingPrice || 0) * 1000,
              supplier_name: formData.supplier_name.trim().toUpperCase(),
              stock_quantity: 0,
              unit: "Cái",
              product_images: item._tempProductImages || [],
              price_images: item._tempPriceImages || []
            })
            .select("id")
            .single();
          
          productIds.push(newProduct?.id || null);
        }
      }

      // Step 2: Create purchase_order
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

      // Step 3: Create purchase_order_items with product_id and snapshot data
      const orderItems = items
        .filter((item, index) => item._tempProductName.trim() && productIds[index])
        .map((item, index) => ({
          purchase_order_id: order.id,
          product_id: productIds[index],
          quantity: item.quantity,
          position: index + 1,
          notes: item.notes.trim().toUpperCase() || null,
          // Snapshot data
          product_code_snapshot: item._tempProductCode.trim().toUpperCase(),
          product_name_snapshot: item._tempProductName.trim().toUpperCase(),
          variant_snapshot: item._tempVariant?.trim().toUpperCase() || null,
          purchase_price_snapshot: Number(item._tempUnitPrice || 0) * 1000,
          selling_price_snapshot: Number(item._tempSellingPrice || 0) * 1000,
          product_images_snapshot: item._tempProductImages || [],
          price_images_snapshot: item._tempPriceImages || []
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
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
    setItems([
      { 
        product_id: null,
        quantity: 1,
        notes: "",
        _tempProductName: "",
        _tempVariant: "",
        _tempProductCode: "",
        _tempUnitPrice: "",
        _tempSellingPrice: "",
        _tempTotalPrice: 0,
        _tempProductImages: [],
        _tempPriceImages: []
      }
    ]);
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "_tempUnitPrice") {
      newItems[index]._tempTotalPrice = newItems[index].quantity * Number(newItems[index]._tempUnitPrice || 0);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { 
      product_id: null,
      quantity: 1,
      notes: "",
      _tempProductName: "",
      _tempVariant: "",
      _tempProductCode: "",
      _tempUnitPrice: "",
      _tempSellingPrice: "",
      _tempTotalPrice: 0,
      _tempProductImages: [],
      _tempPriceImages: []
    }]);
  };

  const copyItem = async (index: number) => {
    const itemToCopy = { ...items[index] };
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
        _tempVariant: "",
        _tempProductCode: "",
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
      if (!formData.supplier_name && product.supplier_name) {
        setFormData({ ...formData, supplier_name: product.supplier_name });
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
      product_id: product.id,
      quantity: 1,
      notes: "",
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
      supplier_name: formData.supplier_name || undefined,
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
      supplier_name: formData.supplier_name || undefined,
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
            product_id: null,
            quantity: 1,
            notes: "",
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
              product_id: null,
              quantity: 1,
              notes: "",
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