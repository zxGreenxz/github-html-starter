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
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw, Sparkles, Truck, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantDropdownSelector } from "./VariantDropdownSelector";
import { VariantGeneratorDialog } from "./VariantGeneratorDialog";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { generateProductCodeFromMax, incrementProductCode } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";


interface PurchaseOrderItem {
  id?: string;
  purchase_order_id?: string;
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
  tpos_product_id?: number;
  receiving_status?: string;
  
  // Temporary UI fields
  _tempProductName: string;
  _tempProductCode: string;
  _tempVariant: string;
  _tempUnitPrice: number | string;
  _tempSellingPrice: number | string;
  _tempTotalPrice: number;
  _tempProductImages: string[];
  _tempPriceImages: string[];
  
  // TPOS data storage
  _fullTPOSData?: any;      // ✅ FULL variant data from TPOS
  _parentTPOSData?: any;    // ✅ FULL parent product data from TPOS
  _parentProductCode?: string; // ✅ Track which parent this came from
  _tempQuantity?: number;   // ✅ Temporary quantity field for editing
  _isExpanded?: boolean;
  _isNew?: boolean;
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [variantGeneratorIndex, setVariantGeneratorIndex] = useState<number | null>(null);
  // Cache for TPOS FULL product data to avoid redundant API calls
  const [tposVariantsCache, setTposVariantsCache] = useState<Record<string, any>>({});
  const [isUpdatingTPOS, setIsUpdatingTPOS] = useState(false);

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
        _tempProductName: item.product_name,
        _tempProductCode: item.product_code,
        _tempVariant: item.variant || "",
        _tempUnitPrice: Number(item.purchase_price) / 1000,
        _tempSellingPrice: Number(item.selling_price) / 1000,
        _tempTotalPrice: (item.quantity * Number(item.purchase_price)) / 1000,
        _tempProductImages: item.product_images || [],
        _tempPriceImages: item.price_images || [],
      })));
    } else if (open && existingItems) {
      // If no existing items, add one empty row
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

  // Fetch FULL product data from TPOS (similar to TPOS Manager)
  const fetchFullProductForEdit = async (productCode: string) => {
    try {
      // Check cache first
      if (tposVariantsCache[productCode]) {
        console.log("✅ Using cached TPOS data for:", productCode);
        return tposVariantsCache[productCode];
      }
      
      console.log("🔄 Fetching FULL product from TPOS for:", productCode);
      
      // Step 1: Get tpos_product_id from database
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("tpos_product_id, product_images, price_images")
        .eq("product_code", productCode)
        .maybeSingle();
      
      if (productError || !productData?.tpos_product_id) {
        console.error("❌ No tpos_product_id found for:", productCode);
        return null;
      }
      
      // Step 2: Get TPOS bearer token
      const { data: tokenData } = await supabase
        .from('tpos_credentials')
        .select('bearer_token')
        .eq('token_type', 'tpos')
        .not('bearer_token', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!tokenData?.bearer_token) {
        console.error("❌ No TPOS token found");
        return null;
      }
      
      // Step 3: Fetch FULL product with ALL expands (same as TPOS Manager)
      const url = `https://tomato.tpos.vn/odata/ProductTemplate(${productData.tpos_product_id})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokenData.bearer_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error("❌ TPOS API failed:", response.status);
        return null;
      }
      
      const fullProductData = await response.json();
      console.log("✅ Fetched FULL product:", fullProductData.Name, "with", fullProductData.ProductVariants?.length, "variants");
      
      // Deep clone to create editable copy
      const editableData = JSON.parse(JSON.stringify(fullProductData));
      
      // Cache the FULL product data (NOT just variants)
      setTposVariantsCache(prev => ({
        ...prev,
        [productCode]: editableData
      }));
      
      return editableData;
    } catch (error) {
      console.error("❌ Error fetching FULL product from TPOS:", error);
      return null;
    }
  };

  // Expand parent products by fetching FULL data from TPOS
  useEffect(() => {
    const expandParentProducts = async () => {
      if (!existingItems || existingItems.length === 0 || !open) return;
      
      console.log("🔍 Checking for parent products to expand...");
      const expandedItems: PurchaseOrderItem[] = [];
      
      for (const item of existingItems) {
        // Check if this is a parent product (no variant, has tpos_product_id)
        const isParent = !item.variant && item.tpos_product_id;
        
        if (isParent) {
          console.log("🔄 Expanding parent:", item.product_code);
          
          // Fetch FULL product data
          const fullProductData = await fetchFullProductForEdit(item.product_code);
          
          if (fullProductData?.ProductVariants && fullProductData.ProductVariants.length > 0) {
            console.log(`✅ Found ${fullProductData.ProductVariants.length} variants for ${item.product_code}`);
            
            // Create items from variants
            fullProductData.ProductVariants.forEach((variant: any) => {
              const variantAttributes = variant.AttributeValues?.map((attr: any) => attr.Name).join(', ') || '';
              
              expandedItems.push({
                id: crypto.randomUUID(),
                purchase_order_id: item.purchase_order_id,
                product_code: variant.DefaultCode || item.product_code,
                product_name: variant.Name || variant.NameGet || item.product_name,
                variant: variantAttributes,
                quantity: variant.QtyAvailable || 0, // ✅ Stock from TPOS
                purchase_price: variant.PriceVariant || 0, // ✅ Purchase price
                selling_price: variant.ListPrice || 0, // ✅ Selling price
                product_images: item.product_images || [],
                price_images: item.price_images || [],
                tpos_product_id: variant.Id,
                receiving_status: 'pending',
                notes: "",
                _isExpanded: true,
                _parentProductCode: item.product_code,
                _tempQuantity: variant.QtyAvailable || 0,
                _tempProductName: variant.Name || variant.NameGet || item.product_name,
                _tempProductCode: variant.DefaultCode || item.product_code,
                _tempVariant: variantAttributes,
                _tempUnitPrice: (variant.PriceVariant || 0) / 1000,
                _tempSellingPrice: (variant.ListPrice || 0) / 1000,
                _tempTotalPrice: ((variant.QtyAvailable || 0) * (variant.PriceVariant || 0)) / 1000,
                _tempProductImages: item.product_images || [],
                _tempPriceImages: item.price_images || [],
                _fullTPOSData: variant, // ✅ STORE FULL VARIANT DATA
                _parentTPOSData: fullProductData // ✅ STORE FULL PARENT DATA
              });
            });
          } else {
            console.log("⚠️ No variants found, keeping original item");
            expandedItems.push({
              ...item,
              _tempQuantity: item.quantity,
              _tempProductName: item.product_name,
              _tempProductCode: item.product_code,
              _tempVariant: item.variant || "",
              _tempUnitPrice: Number(item.purchase_price) / 1000,
              _tempSellingPrice: Number(item.selling_price) / 1000,
              _tempTotalPrice: (item.quantity * Number(item.purchase_price)) / 1000,
              _tempProductImages: item.product_images || [],
              _tempPriceImages: item.price_images || [],
            });
          }
        } else {
          // Not a parent, keep as is
          expandedItems.push({
            ...item,
            _tempQuantity: item.quantity,
            _tempProductName: item.product_name,
            _tempProductCode: item.product_code,
            _tempVariant: item.variant || "",
            _tempUnitPrice: Number(item.purchase_price) / 1000,
            _tempSellingPrice: Number(item.selling_price) / 1000,
            _tempTotalPrice: (item.quantity * Number(item.purchase_price)) / 1000,
            _tempProductImages: item.product_images || [],
            _tempPriceImages: item.price_images || [],
          });
        }
      }
      
      if (expandedItems.length > 0) {
        setItems(expandedItems);
        console.log("✅ Expanded to", expandedItems.length, "items");
      }
    };
    
    expandParentProducts();
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
    // Clear cache when closing modal without saving
    setTposVariantsCache({});
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
    delete itemToCopy.id; // Remove id so it will be inserted as new
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

  const handleVariantsGenerated = async (index: number, variantText: string) => {
    const baseItem = items[index];
    
    // Prepare product data for upsert
    const productData = {
      product_code: baseItem._tempProductCode.trim().toUpperCase(),
      product_name: baseItem._tempProductName.trim().toUpperCase(),
      variant: variantText || null,
      purchase_price: Number(baseItem._tempUnitPrice) * 1000,
      selling_price: Number(baseItem._tempSellingPrice) * 1000,
      supplier_name: supplierName || null,
      stock_quantity: 0,
      unit: "Cái",
      product_images: baseItem._tempProductImages || [],
      price_images: baseItem._tempPriceImages || [],
      base_product_code: baseItem._tempProductCode.trim().toUpperCase()
    };

    // Check if product exists
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("product_code", productData.product_code)
      .maybeSingle();

    if (existingProduct) {
      // Update existing product
      const { error } = await supabase
        .from("products")
        .update({
          variant: productData.variant,
          product_images: productData.product_images,
          price_images: productData.price_images,
          purchase_price: productData.purchase_price,
          selling_price: productData.selling_price,
          supplier_name: productData.supplier_name,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingProduct.id);

      if (error) {
        toast({
          title: "Lỗi cập nhật sản phẩm",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "✅ Cập nhật kho thành công",
        description: `${productData.product_code}`,
      });
    } else {
      // Insert new product
      const { error } = await supabase
        .from("products")
        .insert(productData);

      if (error) {
        toast({
          title: "Lỗi tạo sản phẩm",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "✅ Tạo vào kho thành công",
        description: `${productData.product_code}`,
      });
    }
    
    // Upload to TPOS and create variants
    try {
      const { uploadToTPOSAndCreateVariants } = await import('@/lib/tpos-variant-uploader');
      
      const createdVariants = await uploadToTPOSAndCreateVariants(
        productData.product_code,
        productData.product_name,
        variantText,
        {
          selling_price: productData.selling_price * 1000,
          purchase_price: productData.purchase_price * 1000,
          product_images: productData.product_images,
          price_images: productData.price_images,
          supplier_name: productData.supplier_name
        },
        (message) => {
          toast({ description: message, duration: 1500 });
        }
      );
      
      console.log('🔍 Created variants from TPOS:', createdVariants);
      
      // Add created variants to items list
      if (createdVariants && createdVariants.length > 0) {
        console.log(`📦 Adding ${createdVariants.length} variants to purchase order`);
        
        const newVariantItems = createdVariants.map(variant => ({
          id: undefined,
          purchase_order_id: order.id,
          quantity: 1,
          notes: "",
          position: 0,
          created_at: new Date().toISOString(),
          tpos_product_id: variant.tpos_product_id,
          tpos_deleted: false,
          tpos_deleted_at: null,
          _isNew: true,
          _tempProductCode: variant.product_code,
          _tempProductName: variant.product_name,
          _tempVariant: variant.variant,
          _tempUnitPrice: variant.purchase_price / 1000, // Convert from VND to thousands for form display
          _tempSellingPrice: variant.selling_price / 1000, // Convert from VND to thousands for form display
          _tempProductImages: variant.product_images,
          _tempPriceImages: variant.price_images,
          _tempTotalPrice: variant.purchase_price / 1000, // Convert from VND to thousands for form display
          product_code: variant.product_code,
          product_name: variant.product_name,
          variant: variant.variant,
          purchase_price: variant.purchase_price / 1000, // Convert from VND to thousands for form display
          selling_price: variant.selling_price / 1000, // Convert from VND to thousands for form display
          product_images: variant.product_images,
          price_images: variant.price_images,
        }));
        
        // Insert new variant items after the current base item
        setItems(prev => {
          const newItems = [...prev];
          // Update the base item with variant text
          newItems[index] = {
            ...newItems[index],
            _tempVariant: variantText,
          };
          // Insert variant items after the base item
          newItems.splice(index + 1, 0, ...newVariantItems);
          console.log('✅ Updated items list:', newItems);
          return newItems;
        });
        
        toast({
          title: "✅ Đã thêm variants vào danh sách",
          description: `Đã thêm ${createdVariants.length} variants vào đơn đặt hàng`,
        });
      }
    } catch (error: any) {
      console.error("TPOS upload error:", error);
      toast({
        variant: "destructive",
        title: "⚠️ Lỗi upload TPOS",
        description: error.message
      });
      
      // Still update the variant field even if TPOS upload fails
      setItems(prev => {
        const newItems = [...prev];
        newItems[index] = {
          ...newItems[index],
          _tempVariant: variantText,
        };
        return newItems;
      });
    }
  };

  const openVariantGenerator = async (index: number) => {
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
    
    // Fetch variant string from parent product in database
    const { data, error } = await supabase
      .from("products")
      .select("variant")
      .eq("product_code", item._tempProductCode)
      .single();
    
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

      // Step 1: Update purchase order
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
    onSuccess: () => {
      // Clear TPOS variants cache after successful update
      setTposVariantsCache({});
      
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

  const handleUpdateToTPOS = async () => {
    if (!items || items.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Vui lòng thêm sản phẩm trước"
      });
      return;
    }
    
    // Group items by parent product
    const productGroups = new Map<string, PurchaseOrderItem[]>();
    
    items.forEach(item => {
      if (item._parentTPOSData) {
        const parentCode = item._parentProductCode || item.product_code;
        if (!productGroups.has(parentCode)) {
          productGroups.set(parentCode, []);
        }
        productGroups.get(parentCode)!.push(item);
      }
    });
    
    if (productGroups.size === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu TPOS",
        description: "Các sản phẩm này chưa có thông tin từ TPOS"
      });
      return;
    }
    
    setIsUpdatingTPOS(true);
    
    try {
      // Get TPOS token
      const { data: tokenData } = await supabase
        .from('tpos_credentials')
        .select('bearer_token')
        .eq('token_type', 'tpos')
        .not('bearer_token', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!tokenData?.bearer_token) {
        throw new Error("Không tìm thấy TPOS token");
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      // Update each product group
      for (const [parentCode, variantItems] of productGroups.entries()) {
        try {
          // Get parent data from first item
          const parentData = variantItems[0]._parentTPOSData;
          
          if (!parentData) continue;
          
          // Update variants with new values
          const updatedVariants = parentData.ProductVariants.map((variant: any) => {
            // Find matching item in our list
            const matchingItem = variantItems.find(item => 
              item._fullTPOSData?.Id === variant.Id
            );
            
            if (matchingItem) {
              // ✅ Update fields from user input
              return {
                ...variant,
                QtyAvailable: matchingItem._tempQuantity, // ✅ Số lượng
                PriceVariant: Number(matchingItem._tempUnitPrice) * 1000, // ✅ Giá mua (convert to VND)
                ListPrice: Number(matchingItem._tempSellingPrice) * 1000, // ✅ Giá bán (convert to VND)
                StandardPrice: Number(matchingItem._tempSellingPrice) * 1000, // Also update StandardPrice
              };
            }
            
            return variant; // Keep unchanged
          });
          
          // Build payload (FULL product data)
          const payload = {
            ...parentData,
            ProductVariants: updatedVariants
          };
          
          console.log("📤 Updating product:", parentCode, payload);
          
          // POST to TPOS
          const response = await fetch(
            "https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2",
            {
              method: "POST",
              headers: {
                'Authorization': `Bearer ${tokenData.bearer_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(payload)
            }
          );
          
          if (response.ok) {
            successCount++;
            console.log("✅ Updated:", parentCode);
          } else {
            const error = await response.json();
            console.error("❌ Failed to update:", parentCode, error);
            errorCount++;
          }
        } catch (error) {
          console.error("❌ Error updating:", parentCode, error);
          errorCount++;
        }
      }
      
      // Show result
      if (successCount > 0) {
        toast({
          title: "🎉 Cập nhật thành công!",
          description: `Đã cập nhật ${successCount} sản phẩm lên TPOS${errorCount > 0 ? ` (${errorCount} thất bại)` : ''}`
        });
        
        // Clear cache to force refetch next time
        setTposVariantsCache({});
      } else {
        throw new Error("Không có sản phẩm nào được cập nhật");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi cập nhật TPOS",
        description: error instanceof Error ? error.message : "Không thể cập nhật lên TPOS"
      });
      console.error("Update error:", error);
    } finally {
      setIsUpdatingTPOS(false);
    }
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
                    <TableHead className="w-[80px]">SL</TableHead>
                    <TableHead className="w-[90px]">Giá mua (VND)</TableHead>
                    <TableHead className="w-[90px]">Giá bán (VND)</TableHead>
                    <TableHead className="w-[130px]">Thành tiền (VND)</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh sản phẩm</TableHead>
                    <TableHead className="w-[100px]">Hình ảnh Giá mua</TableHead>
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
                          min="0"
                          value={item._tempQuantity !== undefined ? item._tempQuantity : item.quantity}
                          onChange={(e) => {
                            const newItems = [...items];
                            const newQty = parseInt(e.target.value) || 0;
                            newItems[index]._tempQuantity = newQty;
                            newItems[index].quantity = newQty;
                            newItems[index]._tempTotalPrice = newQty * Number(newItems[index]._tempUnitPrice || 0);
                            setItems(newItems);
                          }}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-center w-[80px]"
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
              onClick={handleUpdateToTPOS}
              disabled={isUpdatingTPOS || items.length === 0}
              variant="secondary"
            >
              {isUpdatingTPOS ? "⏳ Đang cập nhật..." : "📤 Cập nhật lên TPOS"}
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
            product_name: items[variantGeneratorIndex]._tempProductName,
            variant: items[variantGeneratorIndex]._tempVariant || ""
          }}
          onVariantsGenerated={(variantText) => {
            handleVariantsGenerated(variantGeneratorIndex, variantText);
            setVariantGeneratorIndex(null);
          }}
        />
      )}
    </Dialog>
  );
}