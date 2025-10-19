import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";

export function ProductUploadTestTool() {
  const { toast } = useToast();

  useEffect(() => {
    // Initialize the vanilla JS module when component mounts
    const initModule = async () => {
      if (window.ProductModule && window.ProductModule.initProductModule) {
        // Pass helper functions to vanilla JS
        window.ProductModule.initProductModule(getHeaders, showMessage);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(initModule, 100);
  }, []);

  // Helper function to get TPOS headers
  const getHeaders = async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không tìm thấy TPOS token. Vui lòng cấu hình trong tab TPOS Credentials."
      });
      throw new Error('Không tìm thấy TPOS token');
    }
    return getTPOSHeaders(token);
  };

  // Helper function to show messages using React toast
  const showMessage = (type: 'success' | 'error' | 'info', message: string) => {
    if (type === 'success') {
      toast({ title: "Thành công", description: message });
    } else if (type === 'error') {
      toast({ variant: "destructive", title: "Lỗi", description: message });
    } else {
      toast({ title: "Thông báo", description: message });
    }
  };

  // Expose functions globally for vanilla JS
  useEffect(() => {
    (window as any).getHeaders = getHeaders;
    (window as any).showMessage = showMessage;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Upload Sản Phẩm TPOS</CardTitle>
        <CardDescription>
          Tạo sản phẩm mới với biến thể trực tiếp lên TPOS. Công cụ này cho phép bạn test việc tạo sản phẩm với AttributeLines và ProductVariants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div id="productUploadModule">
          {/* Image Upload Area */}
          <div 
            id="imageUpload" 
            className="border-2 border-dashed rounded-lg p-6 mb-4 cursor-pointer hover:border-primary transition-colors relative"
          >
            <input 
              type="file" 
              id="fileInput" 
              accept="image/*" 
              className="hidden"
            />
            
            <div id="imageUploadPlaceholder" className="text-center">
              <p className="text-muted-foreground">📸 Click hoặc paste ảnh vào đây</p>
            </div>
            
            <div id="imagePreviewContainer" className="hidden relative">
              <img 
                id="imagePreview" 
                alt="Preview" 
                className="max-h-40 mx-auto rounded"
              />
              <button
                type="button"
                onClick={(e) => {
                  if (window.ProductModule) window.ProductModule.removeImage(e);
                }}
                className="absolute top-2 right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-destructive/90"
              >
                ×
              </button>
            </div>
          </div>

          {/* Product Form */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input 
              id="defaultCode" 
              placeholder="Mã sản phẩm (VD: NTEST)" 
              defaultValue="NTEST"
              className="px-3 py-2 border rounded-md"
            />
            <input 
              id="productName" 
              placeholder="Tên sản phẩm" 
              className="px-3 py-2 border rounded-md"
            />
            <input 
              id="listPrice" 
              type="number" 
              placeholder="Giá bán" 
              defaultValue="100000"
              className="px-3 py-2 border rounded-md"
            />
            <input 
              id="purchasePrice" 
              type="number" 
              placeholder="Giá nhập" 
              defaultValue="50000"
              className="px-3 py-2 border rounded-md"
            />
            <input 
              id="qtyAvailable" 
              type="number" 
              placeholder="Số lượng" 
              defaultValue="100"
              className="px-3 py-2 border rounded-md col-span-2"
            />
          </div>

          {/* AttributeLines Display */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              AttributeLines (JSON)
            </label>
            <textarea 
              id="attributeLinesDisplay" 
              rows={6}
              defaultValue="[]"
              className="w-full px-3 py-2 border rounded-md font-mono text-xs"
              readOnly
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                if (window.ProductModule) window.ProductModule.openAttributeModal();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              🎨 Chọn biến thể
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.ProductModule) window.ProductModule.createProductOneClick();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex-1"
            >
              ✨ Tạo sản phẩm test
            </button>
          </div>

          {/* Result Display */}
          <div id="productResult" className="hidden">
            <div className="border rounded-lg p-4 bg-muted">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Kết quả:</h3>
                <button
                  type="button"
                  onClick={() => {
                    const content = document.getElementById('productResultContent')?.textContent || '';
                    navigator.clipboard.writeText(content);
                    showMessage('success', 'Đã sao chép JSON');
                  }}
                  className="px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80"
                >
                  📋 Copy JSON
                </button>
              </div>
              <pre 
                id="productResultContent" 
                className="text-xs overflow-auto max-h-96 bg-background p-3 rounded"
              />
            </div>
          </div>
        </div>

        {/* Attribute Modal */}
        <div id="attributeModal" className="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Chọn Biến Thể</h2>
            
            {/* Tabs */}
            <div className="flex gap-2 border-b mb-4">
              <button
                type="button"
                onClick={(e) => {
                  if (window.ProductModule) window.ProductModule.switchAttrTab('sizeText', e);
                }}
                className="px-4 py-2 border-b-2 border-primary text-primary"
              >
                Size Chữ
              </button>
              <button
                type="button"
                onClick={(e) => {
                  if (window.ProductModule) window.ProductModule.switchAttrTab('color', e);
                }}
                className="px-4 py-2 text-muted-foreground"
              >
                Màu sắc
              </button>
              <button
                type="button"
                onClick={(e) => {
                  if (window.ProductModule) window.ProductModule.switchAttrTab('sizeNumber', e);
                }}
                className="px-4 py-2 text-muted-foreground"
              >
                Size Số
              </button>
            </div>
            
            {/* Tab Contents */}
            <div id="tab-sizeText" className="attr-tab-content">
              <select 
                id="sizeTextSelect" 
                className="w-full px-3 py-2 border rounded-md mb-3"
              >
                <option value="">-- Chọn Size Chữ --</option>
              </select>
              <div id="sizeTextChips" className="flex flex-wrap gap-2 min-h-[40px]" />
            </div>

            <div id="tab-color" className="attr-tab-content hidden">
              <select 
                id="colorSelect" 
                className="w-full px-3 py-2 border rounded-md mb-3"
              >
                <option value="">-- Chọn Màu --</option>
              </select>
              <div id="colorChips" className="flex flex-wrap gap-2 min-h-[40px]" />
            </div>

            <div id="tab-sizeNumber" className="attr-tab-content hidden">
              <select 
                id="sizeNumberSelect" 
                className="w-full px-3 py-2 border rounded-md mb-3"
              >
                <option value="">-- Chọn Size Số --</option>
              </select>
              <div id="sizeNumberChips" className="flex flex-wrap gap-2 min-h-[40px]" />
            </div>
            
            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  if (window.ProductModule) window.ProductModule.closeAttributeModal();
                }}
                className="px-4 py-2 border rounded-md hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.ProductModule) window.ProductModule.saveAttributeLines();
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                💾 Lưu biến thể
              </button>
            </div>
          </div>
        </div>

        {/* Add styles for chips */}
        <style>{`
          .size-chip {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-radius: 9999px;
            font-size: 0.875rem;
          }
          .size-chip-remove {
            font-size: 1.25rem;
            font-weight: bold;
            line-height: 1;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s;
          }
          .size-chip-remove:hover {
            opacity: 1;
          }
        `}</style>
      </CardContent>
    </Card>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ProductModule?: {
      initProductModule: (getHeaders: () => Promise<any>, showMessage: (type: string, message: string) => void) => void;
      openAttributeModal: () => void;
      closeAttributeModal: () => void;
      switchAttrTab: (tab: string, event: any) => void;
      saveAttributeLines: () => void;
      removeValue: (type: string, valueId: number) => void;
      removeImage: (event: any) => void;
      createProductOneClick: () => void;
    };
  }
}
