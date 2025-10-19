import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getActiveTPOSToken, getTPOSHeaders, generateRandomId } from "@/lib/tpos-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Plus, Trash2 } from "lucide-react";

// Available attributes from HTML
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
      { Id: 9, Name: "Vàng", Code: "vang", Sequence: null },
      { Id: 10, Name: "Cam", Code: "cam", Sequence: null },
      { Id: 11, Name: "Xám", Code: "xam", Sequence: null },
      { Id: 12, Name: "Hồng", Code: "hong", Sequence: null },
      // ... add more colors as needed
    ],
  },
  sizeNumber: {
    id: 4, name: "Size Số", code: "SZNu",
    values: [
      { Id: 80, Name: "27", Code: "27", Sequence: null },
      { Id: 81, Name: "28", Code: "28", Sequence: null },
      { Id: 18, Name: "29", Code: "29", Sequence: null },
      { Id: 19, Name: "30", Code: "30", Sequence: null },
      { Id: 20, Name: "31", Code: "31", Sequence: null },
      { Id: 21, Name: "32", Code: "32", Sequence: null },
      // ... add more sizes as needed
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
        NameGet: `${productName} (${variantName})`,
        Name: `${productName} (${variantName})`,
        PriceVariant: listPrice,
        AttributeValues: attrs.map(a => ({
          Id: a.Id,
          Name: a.Name,
          NameGet: a.NameGet,
          AttributeId: a.AttributeId,
          AttributeName: a.AttributeName
        }))
      };
    });
  };

  const createProductOneClick = async () => {
    if (!productName.trim()) {
      toast({ variant: "destructive", title: "❌ Lỗi", description: "Vui lòng nhập tên sản phẩm" });
      return;
    }

    setIsCreatingProduct(true);
    setCreatedVariants([]);
    
    try {
      const headers = await getHeaders();
      
      // Generate variants
      const variants = generateVariants(productName, parseFloat(listPrice), attributeLines);
      
      const payload = {
        Name: productName,
        DefaultCode: defaultCode.toUpperCase(),
        ListPrice: parseFloat(listPrice),
        PurchasePrice: parseFloat(purchasePrice),
        QtyAvailable: parseInt(qtyAvailable),
        Type: "product",
        SaleOK: true,
        PurchaseOK: true,
        Active: true,
        UOMId: 1,
        UOMPOId: 1,
        CategId: 1,
        AttributeLines: attributeLines,
        ProductVariants: variants,
        Images: imageBase64 ? [{ Image: imageBase64 }] : []
      };

      const response = await fetch('https://tomato.tpos.vn/odata/ProductTemplate', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Fetch created variants
      await fetchAndDisplayCreatedVariants(data.Id);
      
      toast({
        title: "✅ Thành công",
        description: `Đã tạo sản phẩm với ${variants.length} variants!`
      });
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
                  <Badge variant="secondary">
                    Tổng: {createdVariants.length} variants
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {createdVariants.map((variant, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="font-semibold">ID:</span> {variant.Id}</div>
                          <div><span className="font-semibold">Mã:</span> {variant.DefaultCode || 'N/A'}</div>
                          <div className="col-span-2"><span className="font-semibold">Tên:</span> {variant.Name}</div>
                          <div><span className="font-semibold">Giá Bán:</span> {variant.PriceVariant?.toLocaleString('vi-VN')}₫</div>
                          <div>
                            <span className="font-semibold">Thuộc Tính:</span>{' '}
                            {variant.AttributeValues?.map((attr: any) => attr.Name).join(', ') || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                    <div className="space-y-2">
                      {variantData.ProductVariants?.map((variant: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="font-semibold">ID:</span> {variant.Id}</div>
                            <div><span className="font-semibold">Mã:</span> {variant.DefaultCode || 'N/A'}</div>
                            <div className="col-span-2"><span className="font-semibold">Tên:</span> {variant.Name}</div>
                            <div className="text-green-600 font-semibold">
                              Giá Bán: {variant.PriceVariant?.toLocaleString('vi-VN')}₫
                            </div>
                            <div className="text-blue-600 font-semibold">
                              Giá Mua: {variant.StandardPrice?.toLocaleString('vi-VN')}₫
                            </div>
                            <div className="col-span-2 text-muted-foreground">
                              <span className="font-semibold">Thuộc Tính:</span>{' '}
                              {variant.AttributeValues?.map((attr: any) => attr.NameGet).join(', ') || 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
