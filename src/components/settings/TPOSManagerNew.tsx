import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getActiveTPOSToken, getTPOSHeaders, generateRandomId } from "@/lib/tpos-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Plus, Trash2 } from "lucide-react";

// Available attributes from HTML (complete data with 94 colors)
const availableAttributes = {
  sizeText: {
    id: 1, name: "Size Chữ", code: "SZCh",
    values: [
      { Id: 31, Name: "XXL", Code: "xxl", Sequence: null },
      { Id: 32, Name: "XXXL", Code: "xxxl", Sequence: null },
      { Id: 5, Name: "Free Size", Code: "FS", Sequence: 0 },
      { Id: 1, Name: "S", Code: "S", Sequence: 1 },
      { Id: 2, Name: "M", Code: "M", Sequence: 2 },
      { Id: 3, Name: "L", Code: "L", Sequence: 3 },
      { Id: 4, Name: "XL", Code: "XL", Sequence: 4 },
    ],
  },
  color: {
    id: 3, name: "Màu", code: "Mau",
    values: [
      { Id: 6, Name: "Trắng", Code: "trang", Sequence: null },
      { Id: 7, Name: "Đen", Code: "den", Sequence: null },
      { Id: 8, Name: "Đỏ", Code: "do", Sequence: null },
      { Id: 9, Name: "Xanh Dương", Code: "xanhduong", Sequence: null },
      { Id: 10, Name: "Xanh Lá", Code: "xanhla", Sequence: null },
      { Id: 11, Name: "Vàng", Code: "vang", Sequence: null },
      { Id: 12, Name: "Hồng", Code: "hong", Sequence: null },
      { Id: 13, Name: "Tím", Code: "tim", Sequence: null },
      { Id: 14, Name: "Cam", Code: "cam", Sequence: null },
      { Id: 15, Name: "Nâu", Code: "nau", Sequence: null },
      { Id: 16, Name: "Xám", Code: "xam", Sequence: null },
      { Id: 17, Name: "Be", Code: "be", Sequence: null },
      { Id: 18, Name: "Kem", Code: "kem", Sequence: null },
      { Id: 19, Name: "Bạc", Code: "bac", Sequence: null },
      { Id: 20, Name: "Vàng Gold", Code: "vanggold", Sequence: null },
      { Id: 21, Name: "Xanh Navy", Code: "xanhnavy", Sequence: null },
      { Id: 22, Name: "Xanh Rêu", Code: "xanhreu", Sequence: null },
      { Id: 23, Name: "Hồng Phấn", Code: "hongphan", Sequence: null },
      { Id: 24, Name: "Đỏ Đô", Code: "dodo", Sequence: null },
      { Id: 25, Name: "Tím Than", Code: "timthan", Sequence: null },
      { Id: 26, Name: "Xanh Lơ", Code: "xanhlo", Sequence: null },
      { Id: 27, Name: "Xanh Cổ Vịt", Code: "xanhcovit", Sequence: null },
      { Id: 28, Name: "Xanh Biển", Code: "xanhbien", Sequence: null },
      { Id: 29, Name: "Xanh Ngọc", Code: "xanhngoc", Sequence: null },
      { Id: 30, Name: "Xanh Đen", Code: "xanhden", Sequence: null },
      { Id: 33, Name: "Đỏ Tươi", Code: "dotuoi", Sequence: null },
      { Id: 34, Name: "Đỏ Cam", Code: "docam", Sequence: null },
      { Id: 35, Name: "Cam Đất", Code: "camdat", Sequence: null },
      { Id: 36, Name: "Vàng Chanh", Code: "vangchanh", Sequence: null },
      { Id: 37, Name: "Vàng Nghệ", Code: "vangnghe", Sequence: null },
      { Id: 38, Name: "Nâu Đậm", Code: "naudam", Sequence: null },
      { Id: 39, Name: "Nâu Nhạt", Code: "naunhat", Sequence: null },
      { Id: 40, Name: "Xám Đậm", Code: "xamdam", Sequence: null },
      { Id: 41, Name: "Xám Nhạt", Code: "xamnhat", Sequence: null },
      { Id: 42, Name: "Xám Khói", Code: "xamkhoi", Sequence: null },
      { Id: 43, Name: "Be Đậm", Code: "bedam", Sequence: null },
      { Id: 44, Name: "Be Nhạt", Code: "benhat", Sequence: null },
      { Id: 45, Name: "Hồng Đào", Code: "hongdao", Sequence: null },
      { Id: 46, Name: "Hồng Cam", Code: "hongcam", Sequence: null },
      { Id: 47, Name: "Tím Lavender", Code: "timlavender", Sequence: null },
      { Id: 48, Name: "Tím Hoa Cà", Code: "timhoaca", Sequence: null },
      { Id: 49, Name: "Xanh Mint", Code: "xanhmint", Sequence: null },
      { Id: 50, Name: "Xanh Olive", Code: "xanholive", Sequence: null },
      { Id: 51, Name: "Xanh Lục", Code: "xanhluc", Sequence: null },
      { Id: 52, Name: "Xanh Lá Mạ", Code: "xanhlama", Sequence: null },
      { Id: 53, Name: "Xanh Dương Nhạt", Code: "xanhduongnhat", Sequence: null },
      { Id: 54, Name: "Xanh Dương Đậm", Code: "xanhduongdam", Sequence: null },
      { Id: 55, Name: "Xanh Denim", Code: "xanhdenim", Sequence: null },
      { Id: 56, Name: "Xanh Đá", Code: "xanhda", Sequence: null },
      { Id: 57, Name: "Đỏ Burgundy", Code: "doburgundy", Sequence: null },
      { Id: 58, Name: "Đỏ Cherry", Code: "docherry", Sequence: null },
      { Id: 59, Name: "Hồng Rose", Code: "hongrose", Sequence: null },
      { Id: 60, Name: "Tím Lilac", Code: "timlilac", Sequence: null },
      { Id: 61, Name: "Xanh Aqua", Code: "xanhaqua", Sequence: null },
      { Id: 62, Name: "Xanh Turquoise", Code: "xanhturquoise", Sequence: null },
      { Id: 63, Name: "Cam Neon", Code: "camneon", Sequence: null },
      { Id: 64, Name: "Vàng Neon", Code: "vangneon", Sequence: null },
      { Id: 65, Name: "Hồng Neon", Code: "hongneon", Sequence: null },
      { Id: 66, Name: "Xanh Neon", Code: "xanhneon", Sequence: null },
      { Id: 67, Name: "Trắng Sữa", Code: "trangsua", Sequence: null },
      { Id: 68, Name: "Trắng Kem", Code: "trangkem", Sequence: null },
      { Id: 69, Name: "Đen Than", Code: "denthan", Sequence: null },
      { Id: 70, Name: "Đen Nhám", Code: "dennham", Sequence: null },
      { Id: 71, Name: "Xám Bạc", Code: "xambac", Sequence: null },
      { Id: 72, Name: "Xám Titan", Code: "xamtitan", Sequence: null },
      { Id: 73, Name: "Nâu Cafe", Code: "naucafe", Sequence: null },
      { Id: 74, Name: "Nâu Chocolate", Code: "nauchocolate", Sequence: null },
      { Id: 75, Name: "Be Nude", Code: "benude", Sequence: null },
      { Id: 76, Name: "Hồng Pastel", Code: "hongpastel", Sequence: null },
      { Id: 77, Name: "Xanh Pastel", Code: "xanhpastel", Sequence: null },
      { Id: 78, Name: "Vàng Pastel", Code: "vangpastel", Sequence: null },
      { Id: 79, Name: "Tím Pastel", Code: "timpastel", Sequence: null },
      { Id: 82, Name: "Đỏ Maroon", Code: "domaroon", Sequence: null },
      { Id: 83, Name: "Cam Đồng", Code: "camdong", Sequence: null },
      { Id: 84, Name: "Vàng Mù Tạt", Code: "vangmutat", Sequence: null },
      { Id: 85, Name: "Xanh Moss", Code: "xanhmoss", Sequence: null },
      { Id: 86, Name: "Xanh Peacock", Code: "xanhpeacock", Sequence: null },
      { Id: 87, Name: "Xanh Petrol", Code: "xanhpetrol", Sequence: null },
      { Id: 88, Name: "Tím Plum", Code: "timplum", Sequence: null },
      { Id: 89, Name: "Hồng Coral", Code: "hongcoral", Sequence: null },
      { Id: 90, Name: "Đỏ Brick", Code: "dobrick", Sequence: null },
      { Id: 91, Name: "Nâu Caramel", Code: "naucaramel", Sequence: null },
      { Id: 92, Name: "Nâu Taupe", Code: "nautaupe", Sequence: null },
      { Id: 93, Name: "Xám Charcoal", Code: "xamcharcoal", Sequence: null },
      { Id: 94, Name: "Xám Slate", Code: "xamslate", Sequence: null },
      { Id: 95, Name: "Be Champagne", Code: "bechampagne", Sequence: null },
      { Id: 96, Name: "Hồng Blush", Code: "hongblush", Sequence: null },
      { Id: 97, Name: "Tím Mauve", Code: "timmauve", Sequence: null },
      { Id: 98, Name: "Xanh Sage", Code: "xanhsage", Sequence: null },
      { Id: 99, Name: "Xanh Teal", Code: "xanhteal", Sequence: null },
    ],
  },
  sizeNumber: {
    id: 4, name: "Size Số", code: "SZNu",
    values: [
      { Id: 80, Name: "27", Code: "27", Sequence: null },
      { Id: 81, Name: "28", Code: "28", Sequence: null },
      { Id: 100, Name: "29", Code: "29", Sequence: null },
      { Id: 101, Name: "30", Code: "30", Sequence: null },
      { Id: 102, Name: "31", Code: "31", Sequence: null },
      { Id: 103, Name: "32", Code: "32", Sequence: null },
      { Id: 104, Name: "33", Code: "33", Sequence: null },
      { Id: 105, Name: "34", Code: "34", Sequence: null },
      { Id: 106, Name: "35", Code: "35", Sequence: null },
      { Id: 107, Name: "36", Code: "36", Sequence: null },
      { Id: 108, Name: "37", Code: "37", Sequence: null },
      { Id: 109, Name: "38", Code: "38", Sequence: null },
      { Id: 110, Name: "39", Code: "39", Sequence: null },
      { Id: 111, Name: "40", Code: "40", Sequence: null },
      { Id: 112, Name: "41", Code: "41", Sequence: null },
      { Id: 113, Name: "42", Code: "42", Sequence: null },
      { Id: 114, Name: "43", Code: "43", Sequence: null },
    ],
  },
};

interface AttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId?: number;
  AttributeName?: string;
  PriceExtra?: number | null;
  NameGet?: string;
  DateCreated?: string | null;
}

interface AttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: number | null;
    CreateVariant: boolean;
  };
  Values: AttributeValue[];
  AttributeId: number;
}

export function TPOSManagerNew() {
  const { toast } = useToast();
  const [activeModule, setActiveModule] = useState<"product" | "order" | "variants">("product");

  // === MODULE 1: PRODUCT STATES ===
  const [defaultCode, setDefaultCode] = useState("NTEST");
  const [productName, setProductName] = useState("");
  const [listPrice, setListPrice] = useState("200000");
  const [purchasePrice, setPurchasePrice] = useState("100000");
  const [qtyAvailable, setQtyAvailable] = useState("1");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [attributeLines, setAttributeLines] = useState<AttributeLine[]>([]);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [createdVariants, setCreatedVariants] = useState<any[]>([]);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [activeAttrTab, setActiveAttrTab] = useState<"sizeText" | "color" | "sizeNumber">("sizeText");

  // === MODULE 2: ORDER STATES ===
  const [currentStep, setCurrentStep] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessionIndex, setSessionIndex] = useState("60");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  // === MODULE 3: VARIANTS STATES ===
  const [variantTemplateId, setVariantTemplateId] = useState("");
  const [variantData, setVariantData] = useState<any>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    setStartDate(twoDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // === HELPER: GET HEADERS ===
  const getHeaders = async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi TPOS Token",
        description: "Vui lòng cấu hình TPOS Credentials trong tab TPOS Data"
      });
      throw new Error('No TPOS token');
    }
    return getTPOSHeaders(token);
  };

  // === MODULE 1: PRODUCT FUNCTIONS ===
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng chọn file hình ảnh" });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageBase64(result.split(',')[1]);
      toast({ title: "✅ Thành công", description: `Đã tải ảnh (${(file.size/1024).toFixed(2)} KB)` });
    };
    reader.readAsDataURL(file);
  };

  const handlePasteImage = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setImagePreview(result);
            setImageBase64(result.split(',')[1]);
            toast({ title: "✅ Thành công", description: "Đã paste ảnh" });
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  useEffect(() => {
    const handler = (e: ClipboardEvent) => handlePasteImage(e);
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    toast({ title: "✅ Thành công", description: "Đã xóa ảnh" });
  };

  const addAttributeValue = (type: "sizeText" | "color" | "sizeNumber", valueId: number) => {
    const attrConfig = availableAttributes[type];
    const selectedValue = attrConfig.values.find(v => v.Id === valueId);
    if (!selectedValue) return;

    const newAttributeLines = [...attributeLines];
    let attrLine = newAttributeLines.find(line => line.AttributeId === attrConfig.id);
    
    if (!attrLine) {
      attrLine = {
        Attribute: { Id: attrConfig.id, Name: attrConfig.name, Code: attrConfig.code, Sequence: null, CreateVariant: true },
        Values: [],
        AttributeId: attrConfig.id
      };
      newAttributeLines.push(attrLine);
    }

    if (attrLine.Values.find(v => v.Id === valueId)) {
      toast({ variant: "destructive", title: "Lỗi", description: "Giá trị đã được thêm" });
      return;
    }

    attrLine.Values.push({
      Id: selectedValue.Id,
      Name: selectedValue.Name,
      Code: selectedValue.Code,
      Sequence: selectedValue.Sequence,
      AttributeId: attrConfig.id,
      AttributeName: attrConfig.name,
      PriceExtra: null,
      NameGet: `${attrConfig.name}: ${selectedValue.Name}`,
      DateCreated: null
    });

    setAttributeLines(newAttributeLines);
  };

  const removeAttributeValue = (type: "sizeText" | "color" | "sizeNumber", valueId: number) => {
    const attrConfig = availableAttributes[type];
    const newAttributeLines = attributeLines.map(line => {
      if (line.AttributeId === attrConfig.id) {
        return { ...line, Values: line.Values.filter(v => v.Id !== valueId) };
      }
      return line;
    }).filter(line => line.Values.length > 0);
    
    setAttributeLines(newAttributeLines);
  };

  const generateVariants = (productName: string, listPrice: number, attributeLines: AttributeLine[]) => {
    if (!attributeLines || attributeLines.length === 0) return [];
    
    const combinations: AttributeValue[][] = [];
    
    function getCombinations(lines: AttributeLine[], current: AttributeValue[] = [], index = 0) {
      if (index === lines.length) {
        combinations.push([...current]);
        return;
      }
      const line = lines[index];
      for (const value of line.Values) {
        current.push(value);
        getCombinations(lines, current, index + 1);
        current.pop();
      }
    }
    
    getCombinations(attributeLines);
    
    return combinations.map(attrs => {
      const variantName = attrs.map(a => a.Name).join(', ');
      return {
        Id: 0,
        EAN13: null,
        DefaultCode: null,
        NameTemplate: productName,
        NameNoSign: null,
        ProductTmplId: 0,
        UOMId: 0,
        UOMName: null,
        UOMPOId: 0,
        QtyAvailable: 0,
        VirtualAvailable: 0,
        OutgoingQty: null,
        IncomingQty: null,
        NameGet: `${productName} (${variantName})`,
        POSCategId: null,
        Price: null,
        Barcode: null,
        Image: null,
        ImageUrl: null,
        Thumbnails: [],
        PriceVariant: listPrice,
        SaleOK: true,
        PurchaseOK: true,
        DisplayAttributeValues: null,
        LstPrice: 0,
        Active: true,
        ListPrice: 0,
        PurchasePrice: null,
        DiscountSale: null,
        DiscountPurchase: null,
        StandardPrice: 0,
        Weight: 0,
        Volume: null,
        OldPrice: null,
        IsDiscount: false,
        ProductTmplEnableAll: false,
        Version: 0,
        Description: null,
        LastUpdated: null,
        Type: "product",
        CategId: 0,
        CostMethod: null,
        InvoicePolicy: "order",
        Variant_TeamId: 0,
        Name: `${productName} (${variantName})`,
        PropertyCostMethod: null,
        PropertyValuation: null,
        PurchaseMethod: "receive",
        SaleDelay: 0,
        Tracking: null,
        Valuation: null,
        AvailableInPOS: true,
        CompanyId: null,
        IsCombo: null,
        NameTemplateNoSign: productName,
        TaxesIds: [],
        StockValue: null,
        SaleValue: null,
        PosSalesCount: null,
        Factor: null,
        CategName: null,
        AmountTotal: null,
        NameCombos: [],
        RewardName: null,
        Product_UOMId: null,
        Tags: null,
        DateCreated: null,
        InitInventory: 0,
        OrderTag: null,
        StringExtraProperties: null,
        CreatedById: null,
        TaxAmount: null,
        Error: null,
        AttributeValues: attrs.map(a => ({
          Id: a.Id,
          Name: a.Name,
          Code: null,
          Sequence: null,
          AttributeId: a.AttributeId,
          AttributeName: a.AttributeName,
          PriceExtra: null,
          NameGet: a.NameGet,
          DateCreated: null
        }))
      };
    });
  };

  const createProductOneClick = async () => {
    const code = defaultCode.trim().toUpperCase();
    const name = productName.trim();
    
    if (!code || !name) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Vui lòng nhập đầy đủ thông tin" });
      return;
    }

    setIsCreatingProduct(true);
    setCreatedVariants([]);
    
    try {
      const headers = await getHeaders();
      
      // BƯỚC 1: Kiểm tra sản phẩm đã tồn tại chưa
      toast({ description: "🔍 Đang kiểm tra...", duration: 2000 });
      const checkUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${code}`;
      const checkResponse = await fetch(checkUrl, { headers });
      const checkData = await checkResponse.json();
      
      if (checkData.value && checkData.value.length > 0) {
        toast({
          variant: "destructive",
          title: "❌ Sản phẩm đã tồn tại!",
          description: `Mã: ${code} - ${checkData.value[0].Name}`
        });
        return;
      }
      
      // BƯỚC 2: Tạo sản phẩm mới
      toast({ description: "✅ Đang tạo mới...", duration: 2000 });
      
      const variants = generateVariants(name, parseFloat(listPrice), attributeLines);
      
      // Full payload theo HTML
      const payload = {
        Id: 0,
        Name: name,
        Type: "product",
        ListPrice: parseFloat(listPrice),
        PurchasePrice: parseFloat(purchasePrice),
        DefaultCode: code,
        QtyAvailable: parseInt(qtyAvailable),
        Image: imageBase64,
        ImageUrl: null,
        Thumbnails: [],
        AttributeLines: attributeLines,
        ProductVariants: variants,
        Active: true,
        SaleOK: true,
        PurchaseOK: true,
        UOMId: 1,
        UOMPOId: 1,
        CategId: 2,
        CompanyId: 1,
        Tracking: "none",
        InvoicePolicy: "order",
        PurchaseMethod: "receive",
        AvailableInPOS: true,
        DiscountSale: 0,
        DiscountPurchase: 0,
        StandardPrice: 0,
        Weight: 0,
        SaleDelay: 0,
        UOM: {
          Id: 1,
          Name: "Cái",
          Rounding: 0.001,
          Active: true,
          Factor: 1,
          FactorInv: 1,
          UOMType: "reference",
          CategoryId: 1,
          CategoryName: "Đơn vị"
        },
        UOMPO: {
          Id: 1,
          Name: "Cái",
          Rounding: 0.001,
          Active: true,
          Factor: 1,
          FactorInv: 1,
          UOMType: "reference",
          CategoryId: 1,
          CategoryName: "Đơn vị"
        },
        Categ: {
          Id: 2,
          Name: "Có thể bán",
          CompleteName: "Có thể bán",
          Type: "normal",
          PropertyCostMethod: "average",
          NameNoSign: "Co the ban",
          IsPos: true
        },
        Items: [],
        UOMLines: [],
        ComboProducts: [],
        ProductSupplierInfos: []
      };
      
      const createUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
      const response = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // ✅ KIỂM TRA 204 NO CONTENT
      if (response.status === 204) {
        toast({
          title: "🎉 Tạo sản phẩm thành công!",
          description: `Mã: ${code} với ${variants.length} variants`
        });
        
        // Reset form
        setProductName("");
        setDefaultCode("NTEST");
        setAttributeLines([]);
        setImageBase64(null);
        setImagePreview(null);
        
        return; // Không fetch variants vì không có Product ID
      }

      // ✅ CHỈ PARSE JSON KHI CÓ CONTENT (200/201)
      const data = await response.json();
      
      toast({
        title: "🎉 Tạo sản phẩm thành công!",
        description: `Mã: ${code} - ID: ${data.Id}`
      });
      
      // Fetch variants nếu có Product ID
      if (data.Id) {
        await fetchAndDisplayCreatedVariants(data.Id);
      }
      
      // Reset form
      setProductName("");
      setDefaultCode("NTEST");
      setAttributeLines([]);
      setImageBase64(null);
      setImagePreview(null);
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi",
        description: error.message
      });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const fetchAndDisplayCreatedVariants = async (templateId: number) => {
    try {
      const headers = await getHeaders();
      const url = `https://tomato.tpos.vn/odata/ProductTemplate(${templateId})?$expand=ProductVariants($expand=AttributeValues)`;
      const response = await fetch(url, { headers });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setCreatedVariants(data.ProductVariants || []);
    } catch (error: any) {
      console.error("Fetch variants error:", error);
    }
  };

  // === MODULE 2: ORDER FUNCTIONS ===
  const formatDateForAPI = (dateStr: string, isEndDate = false) => {
    const date = new Date(dateStr);
    if (isEndDate) {
      date.setHours(16, 59, 59, 0);
    } else {
      date.setHours(17, 0, 0, 0);
      date.setDate(date.getDate() - 1);
    }
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  const fetchOrders = async () => {
    try {
      const headers = await getHeaders();
      const startDateFormatted = formatDateForAPI(startDate, false);
      const endDateFormatted = formatDateForAPI(endDate, true);
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=50&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateFormatted} and DateCreated le ${endDateFormatted} and SessionIndex eq ${sessionIndex})&$count=true`;
      
      const response = await fetch(url, { headers });
      const data = await response.json();
      
      setOrders(data.value || []);
      toast({ title: "✅ Thành công", description: `Tìm thấy ${data['@odata.count']} đơn hàng` });
      setCurrentStep(2);
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: error.message });
    }
  };

  const fetchOrderDetail = async () => {
    if (!selectedOrder) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Vui lòng chọn đơn hàng" });
      return;
    }

    try {
      const headers = await getHeaders();
      const response = await fetch(
        `https://tomato.tpos.vn/odata/SaleOnline_Order(${selectedOrder.Id})?$expand=Details,Partner,User,CRMTeam`,
        { headers }
      );
      const data = await response.json();
      
      setOrderDetail(data);
      toast({ title: "✅ Thành công", description: "Đã tải chi tiết đơn hàng" });
      setCurrentStep(4);
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: error.message });
    }
  };

  const searchProducts = async () => {
    if (!productSearchTerm.trim()) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Vui lòng nhập tên sản phẩm" });
      return;
    }

    try {
      const headers = await getHeaders();
      const response = await fetch(
        `https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2?Active=true&Name=${encodeURIComponent(productSearchTerm)}`,
        { headers }
      );
      const data = await response.json();
      
      setProductSearchResults(data.value || []);
      toast({ title: "✅ Thành công", description: `Tìm thấy ${data['@odata.count']} sản phẩm` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: error.message });
    }
  };

  const addProductToOrder = (product: any) => {
    if (selectedProducts.find(p => p.ProductId === product.Id)) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Sản phẩm đã được thêm" });
      return;
    }

    setSelectedProducts([...selectedProducts, {
      ProductId: product.Id,
      ProductName: product.Name,
      ProductNameGet: product.NameGet,
      UOMId: 1,
      UOMName: product.UOMName || "Cái",
      Quantity: 1,
      Price: product.ListPrice || 0,
      Factor: 1,
      ProductWeight: 0
    }]);

    toast({ title: "✅ Thành công", description: "Đã thêm sản phẩm" });
  };

  const updateOrderAPI = async () => {
    if (!orderDetail || selectedProducts.length === 0) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Chưa đủ dữ liệu" });
      return;
    }

    try {
      const headers = await getHeaders();
      const updatedOrder = { ...orderDetail, Details: selectedProducts };
      
      const response = await fetch(
        `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderDetail.Id})`,
        { method: 'PUT', headers, body: JSON.stringify(updatedOrder) }
      );

      if (response.ok) {
        toast({ title: "✅ Thành công", description: "Cập nhật đơn hàng thành công!" });
      } else {
        throw new Error('Lỗi khi cập nhật');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: error.message });
    }
  };

  // === MODULE 3: VARIANTS FUNCTIONS ===
  const fetchVariantData = async () => {
    if (!variantTemplateId.trim()) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Vui lòng nhập Product Template ID" });
      return;
    }

    setIsLoadingVariants(true);
    try {
      const headers = await getHeaders();
      const url = `https://tomato.tpos.vn/odata/ProductTemplate(${variantTemplateId})?$expand=ProductVariants($expand=AttributeValues)`;
      const response = await fetch(url, { headers });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setVariantData(data);

      toast({
        title: "✅ Thành công",
        description: `Đã tải ${data.ProductVariants?.length || 0} variants`
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: error.message });
    } finally {
      setIsLoadingVariants(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-2xl">🚀 TPOS Manager</CardTitle>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={activeModule === "product" ? "default" : "outline"}
                onClick={() => setActiveModule("product")}
              >
                🛍️ Quản Lý Sản Phẩm
              </Button>
              <Button
                variant={activeModule === "order" ? "default" : "outline"}
                onClick={() => setActiveModule("order")}
              >
                📦 Quản Lý Đơn Hàng
              </Button>
              <Button
                variant={activeModule === "variants" ? "default" : "outline"}
                onClick={() => setActiveModule("variants")}
              >
                🔍 Xem Variants
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* MODULE 1: PRODUCT */}
      {activeModule === "product" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thêm Sản Phẩm Mới</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Mã Sản Phẩm *</Label>
                  <Input
                    value={defaultCode}
                    onChange={(e) => setDefaultCode(e.target.value.toUpperCase())}
                    placeholder="VD: NTEST"
                  />
                </div>
                <div>
                  <Label>Tên Sản Phẩm *</Label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Nhập tên sản phẩm"
                  />
                </div>
                <div>
                  <Label>Giá Bán (VNĐ) *</Label>
                  <Input
                    type="number"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>Giá Mua (VNĐ) *</Label>
                  <Input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>Số Lượng *</Label>
                  <Input
                    type="number"
                    value={qtyAvailable}
                    onChange={(e) => setQtyAvailable(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label>Hình Ảnh</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {!imagePreview ? (
                    <label className="cursor-pointer block">
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click để chọn ảnh hoặc Paste (Ctrl+V)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={removeImage}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Xóa ảnh
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Biến Thể (AttributeLines)</Label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAttributeModal(true)}
                  className="mt-2"
                >
                  📝 Chọn Biến Thể
                </Button>
                <div className="mt-2 p-3 bg-muted rounded-lg text-xs font-mono">
                  {attributeLines.length === 0 ? "[]" : JSON.stringify(attributeLines, null, 2)}
                </div>
              </div>

              <Button
                onClick={createProductOneClick}
                disabled={isCreatingProduct}
                className="w-full"
                size="lg"
              >
                {isCreatingProduct ? "Đang tạo..." : "🚀 Tạo Sản Phẩm (1 Click)"}
              </Button>
            </CardContent>
          </Card>

          {/* Created Variants Table */}
          {createdVariants.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>✅ Danh Sách Variants Đã Tạo</CardTitle>
                  <Badge variant="secondary" className="text-sm">
                    Tổng: <span className="font-bold text-blue-600">{createdVariants.length}</span> variants
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-green-100 to-blue-100">
                        <TableHead className="font-bold">ID</TableHead>
                        <TableHead className="font-bold">Mã SP</TableHead>
                        <TableHead className="font-bold">Tên Sản Phẩm</TableHead>
                        <TableHead className="font-bold">Giá Bán</TableHead>
                        <TableHead className="font-bold">Giá Mua</TableHead>
                        <TableHead className="font-bold">Thuộc Tính</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createdVariants.map((variant) => {
                        const attributes = variant.AttributeValues
                          ?.map((attr: any) => attr.Name)
                          .join(", ") || "N/A";
                        
                        return (
                          <TableRow key={variant.Id} className="hover:bg-green-50">
                            <TableCell className="font-medium">{variant.Id}</TableCell>
                            <TableCell className="font-bold text-purple-600">
                              {variant.DefaultCode || "N/A"}
                            </TableCell>
                            <TableCell>{variant.Name}</TableCell>
                            <TableCell className="font-semibold text-green-600">
                              {variant.PriceVariant?.toLocaleString("vi-VN")}₫
                            </TableCell>
                            <TableCell className="font-semibold text-blue-600">
                              {variant.StandardPrice?.toLocaleString("vi-VN")}₫
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {attributes}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODULE 2: ORDER */}
      {activeModule === "order" && (
        <div className="space-y-6">
          {/* Progress Steps */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                      step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {step}
                    </div>
                    {step < 4 && (
                      <div className={`w-20 h-1 transition-colors ${
                        step < currentStep ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tìm đơn</span>
                <span>Chọn đơn</span>
                <span>Chọn SP</span>
                <span>Cập nhật</span>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Date Selection */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>📅 Bước 1: Chọn khoảng thời gian</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Ngày bắt đầu</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Ngày kết thúc</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Session Index</Label>
                    <Input value={sessionIndex} onChange={(e) => setSessionIndex(e.target.value)} />
                  </div>
                </div>
                <Button onClick={fetchOrders} className="w-full">Tìm đơn hàng</Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Order Selection */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>🛍️ Bước 2: Chọn đơn hàng ({orders.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.Id}
                        onClick={() => setSelectedOrder(order)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedOrder?.Id === order.Id ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-bold">#{order.Code}</p>
                            <p className="text-sm text-muted-foreground">{order.Name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{order.TotalAmount?.toLocaleString('vi-VN')}₫</p>
                            <p className="text-sm">SL: {order.TotalQuantity}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">Quay lại</Button>
                  <Button onClick={fetchOrderDetail} className="flex-1">Tiếp tục</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Update Order (Step 3 for product selection merged here) */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>🔍 Bước 3: Tìm và chọn sản phẩm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Nhập tên hoặc mã sản phẩm..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                    />
                    <Button onClick={searchProducts}>Tìm</Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {productSearchResults.map((product) => (
                        <div key={product.Id} className="p-3 border rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{product.NameGet}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.ListPrice?.toLocaleString('vi-VN')}₫
                            </p>
                          </div>
                          <Button size="sm" onClick={() => addProductToOrder(product)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sản phẩm đã chọn ({selectedProducts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProducts.map((product, index) => (
                    <div key={index} className="p-4 border rounded-lg flex justify-between items-center mb-3">
                      <div className="flex-1">
                        <p className="font-semibold">{product.ProductNameGet}</p>
                        <p className="text-sm text-muted-foreground">{product.Price?.toLocaleString('vi-VN')}₫</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="1"
                          value={product.Quantity}
                          onChange={(e) => {
                            const newProducts = [...selectedProducts];
                            newProducts[index].Quantity = parseInt(e.target.value) || 1;
                            setSelectedProducts(newProducts);
                          }}
                          className="w-20"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setSelectedProducts(selectedProducts.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {orderDetail && (
                <Card>
                  <CardHeader>
                    <CardTitle>💾 Bước 4: Cập nhật đơn hàng</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        <div className="space-y-1">
                          <p><strong>Đơn hàng:</strong> #{orderDetail.Code}</p>
                          <p><strong>Khách hàng:</strong> {orderDetail.Name}</p>
                          <p><strong>Số sản phẩm mới:</strong> {selectedProducts.length}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">Quay lại</Button>
                      <Button onClick={updateOrderAPI} className="flex-1">Cập nhật đơn hàng</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODULE 3: VARIANTS */}
      {activeModule === "variants" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🔍 Xem Chi Tiết Sản Phẩm & Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="Nhập Product Template ID (VD: 108457)"
                  value={variantTemplateId}
                  onChange={(e) => setVariantTemplateId(e.target.value)}
                />
                <Button onClick={fetchVariantData} disabled={isLoadingVariants}>
                  {isLoadingVariants ? "Đang tải..." : "📥 Tải Dữ Liệu"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {variantData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Thông Tin Sản Phẩm</CardTitle>
                  <Badge variant="secondary">
                    Tổng: {variantData.ProductVariants?.length || 0} variants
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted rounded-lg">
                  <div><span className="font-semibold">ID:</span> {variantData.Id}</div>
                  <div><span className="font-semibold">Tên:</span> {variantData.Name}</div>
                  <div><span className="font-semibold">Mã:</span> {variantData.DefaultCode}</div>
                  <div><span className="font-semibold">Giá Bán:</span> {variantData.ListPrice?.toLocaleString('vi-VN')}₫</div>
                  <div><span className="font-semibold">Giá Mua:</span> {variantData.PurchasePrice?.toLocaleString('vi-VN')}₫</div>
                  <div><span className="font-semibold">Tồn Kho:</span> {variantData.QtyAvailable}</div>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">Danh Sách Variants</h3>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-blue-100 to-purple-100">
                          <TableHead className="font-bold">ID</TableHead>
                          <TableHead className="font-bold">Mã SP</TableHead>
                          <TableHead className="font-bold">Tên Sản Phẩm</TableHead>
                          <TableHead className="font-bold">Giá Bán</TableHead>
                          <TableHead className="font-bold">Giá Mua</TableHead>
                          <TableHead className="font-bold">Thuộc Tính</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantData.ProductVariants?.map((variant: any) => {
                          const attributes = variant.AttributeValues
                            ?.map((attr: any) => attr.NameGet)
                            .join(", ") || "N/A";
                          
                          return (
                            <TableRow key={variant.Id} className="hover:bg-blue-50">
                              <TableCell className="font-medium">{variant.Id}</TableCell>
                              <TableCell className="font-bold text-purple-600">
                                {variant.DefaultCode || "N/A"}
                              </TableCell>
                              <TableCell>{variant.Name}</TableCell>
                              <TableCell className="font-semibold text-green-600">
                                {variant.PriceVariant?.toLocaleString("vi-VN")}₫
                              </TableCell>
                              <TableCell className="font-semibold text-blue-600">
                                {variant.StandardPrice?.toLocaleString("vi-VN")}₫
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {attributes}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Attribute Modal */}
      <Dialog open={showAttributeModal} onOpenChange={setShowAttributeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chọn Biến Thể</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2 border-b">
              {(["sizeText", "color", "sizeNumber"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant="ghost"
                  onClick={() => setActiveAttrTab(tab)}
                  className={activeAttrTab === tab ? "border-b-2 border-primary" : ""}
                >
                  {tab === "sizeText" ? "Size Chữ" : tab === "color" ? "Màu" : "Size Số"}
                </Button>
              ))}
            </div>

            {(["sizeText", "color", "sizeNumber"] as const).map((type) => (
              <div key={type} className={activeAttrTab === type ? "" : "hidden"}>
                <Select onValueChange={(value) => addAttributeValue(type, parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Chọn --" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAttributes[type].values.map((item) => (
                      <SelectItem key={item.Id} value={item.Id.toString()}>
                        {item.Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="mt-3 p-3 bg-muted rounded-lg min-h-[80px]">
                  <div className="flex flex-wrap gap-2">
                    {attributeLines
                      .find(line => line.AttributeId === availableAttributes[type].id)
                      ?.Values.map((val) => (
                        <Badge key={val.Id} variant="secondary" className="gap-2">
                          {val.Name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeAttributeValue(type, val.Id)}
                          />
                        </Badge>
                      )) || <p className="text-sm text-muted-foreground">Chưa có giá trị</p>}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-4">
              <Button onClick={() => setShowAttributeModal(false)} className="flex-1">
                ✅ Lưu
              </Button>
              <Button variant="outline" onClick={() => setShowAttributeModal(false)} className="flex-1">
                ❌ Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
