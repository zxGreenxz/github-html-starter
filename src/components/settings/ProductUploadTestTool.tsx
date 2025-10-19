import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, X, Edit, RefreshCw, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { AttributeSelectionModal, AttributeLine } from "./AttributeSelectionModal";

interface ProductForm {
  defaultCode: string;
  name: string;
  listPrice: number;
  purchasePrice: number;
  qtyAvailable: number;
}

export function ProductUploadTestTool() {
  const [productForm, setProductForm] = useState<ProductForm>({
    defaultCode: "NTEST",
    name: "",
    listPrice: 100000,
    purchasePrice: 50000,
    qtyAvailable: 50
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attributeLines, setAttributeLines] = useState<AttributeLine[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file hình ảnh",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageBase64(dataUrl.split(',')[1]);
      setImagePreview(dataUrl);
      setImageFile(file);
      toast({
        title: "Thành công",
        description: `Đã tải ảnh (${(file.size / 1024).toFixed(2)} KB)`
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImageBase64(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: "Thành công",
      description: "Đã xóa ảnh"
    });
  };

  // Handle paste image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const resetForm = () => {
    setProductForm({
      defaultCode: "NTEST",
      name: "",
      listPrice: 100000,
      purchasePrice: 50000,
      qtyAvailable: 50
    });
    setAttributeLines([]);
    removeImage();
    setResult(null);
    setError(null);
  };

  const handleCreateProduct = async () => {
    if (!productForm.defaultCode || !productForm.name) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    setError(null);
    setResult(null);

    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Không tìm thấy TPOS token");
      }

      // Step 1: Check if product exists
      const checkResponse = await fetch(
        `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${productForm.defaultCode}`,
        { headers: getTPOSHeaders(token) }
      );
      const checkData = await checkResponse.json();

      if (checkData.value && checkData.value.length > 0) {
        setError(`❌ Sản phẩm đã tồn tại! Mã: ${productForm.defaultCode}`);
        setResult(checkData.value[0]);
        toast({
          title: "Lỗi",
          description: "Sản phẩm đã tồn tại trên TPOS",
          variant: "destructive"
        });
        return;
      }

      // Step 2: Create product
      const payload = {
        Id: 0,
        Name: productForm.name,
        Type: "product",
        ListPrice: productForm.listPrice,
        PurchasePrice: productForm.purchasePrice,
        DefaultCode: productForm.defaultCode,
        QtyAvailable: productForm.qtyAvailable,
        Image: imageBase64,
        ImageUrl: null,
        Thumbnails: [],
        AttributeLines: attributeLines,
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

      const response = await fetch(
        'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO',
        {
          method: 'POST',
          headers: getTPOSHeaders(token),
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast({
          title: "Thành công! 🎉",
          description: `Đã tạo sản phẩm: ${productForm.defaultCode} (ID: ${data.Id})`
        });
        // Don't reset form immediately so user can see the result
      } else {
        setError(data.error?.message || 'Lỗi không xác định');
        setResult(data);
        toast({
          title: "Lỗi",
          description: data.error?.message || "Không thể tạo sản phẩm",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Lỗi",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Test Upload Sản Phẩm TPOS</CardTitle>
          <CardDescription>
            Tạo sản phẩm mới với biến thể trực tiếp trên TPOS. Công cụ này cho phép bạn test việc tạo sản phẩm với AttributeLines.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Image Upload Area */}
          <div 
            className="border-2 border-dashed rounded-lg p-6 transition-colors hover:border-primary cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {!imagePreview ? (
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click để chọn ảnh hoặc paste từ clipboard
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF (tối đa 5MB)
                </p>
              </div>
            ) : (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-h-64 mx-auto rounded-md border"
                />
                <Button 
                  onClick={removeImage} 
                  variant="destructive" 
                  size="sm" 
                  className="absolute top-2 right-2"
                >
                  <X className="h-4 w-4 mr-1" /> Xóa
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Product Form */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultCode">Mã sản phẩm *</Label>
              <Input
                id="defaultCode"
                value={productForm.defaultCode}
                onChange={(e) => setProductForm({ ...productForm, defaultCode: e.target.value.toUpperCase() })}
                placeholder="NTEST001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên sản phẩm *</Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Áo thun test"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listPrice">Giá bán</Label>
              <Input
                id="listPrice"
                type="number"
                value={productForm.listPrice}
                onChange={(e) => setProductForm({ ...productForm, listPrice: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Giá mua</Label>
              <Input
                id="purchasePrice"
                type="number"
                value={productForm.purchasePrice}
                onChange={(e) => setProductForm({ ...productForm, purchasePrice: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="qtyAvailable">Số lượng</Label>
              <Input
                id="qtyAvailable"
                type="number"
                value={productForm.qtyAvailable}
                onChange={(e) => setProductForm({ ...productForm, qtyAvailable: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          {/* AttributeLines Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Biến thể (AttributeLines)</Label>
              <Button onClick={() => setModalOpen(true)} variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Chọn biến thể
              </Button>
            </div>
            <Textarea
              value={JSON.stringify(attributeLines, null, 2)}
              readOnly
              className="font-mono text-xs"
              rows={6}
              placeholder='[]'
            />
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreateProduct}
            disabled={isCreating || !productForm.defaultCode || !productForm.name}
            className="w-full"
            size="lg"
          >
            {isCreating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo sản phẩm...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Tạo sản phẩm test
              </>
            )}
          </Button>

          {/* Result Alert */}
          {result && !error && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Thành công!</AlertTitle>
              <AlertDescription className="flex items-center gap-2 flex-wrap">
                <span>Đã tạo sản phẩm: {result.DefaultCode} (ID: {result.Id})</span>
                {result.VariantActiveCount > 0 && (
                  <Badge variant="secondary">{result.VariantActiveCount} biến thể</Badge>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* JSON Result Collapsible */}
          {result && (
            <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${isJsonOpen ? 'rotate-180' : ''}`} />
                  {isJsonOpen ? 'Ẩn' : 'Xem'} JSON Response
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ScrollArea className="h-96 border rounded-md">
                  <pre className="p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Reset Button */}
          {(result || error) && (
            <Button onClick={resetForm} variant="outline" className="w-full">
              Tạo sản phẩm mới
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Attribute Selection Modal */}
      <AttributeSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialAttributeLines={attributeLines}
        onSave={(lines) => {
          setAttributeLines(lines);
          setModalOpen(false);
        }}
      />
    </>
  );
}
