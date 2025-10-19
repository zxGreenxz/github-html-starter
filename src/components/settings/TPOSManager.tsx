import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getActiveTPOSToken, getTPOSHeaders, generateRandomId } from "@/lib/tpos-config";

export function TPOSManager() {
  const { toast } = useToast();

  useEffect(() => {
    // Expose getHeaders globally for vanilla JS
    (window as any).getHeaders = async () => {
      const token = await getActiveTPOSToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "Lỗi TPOS Token",
          description: "Vui lòng cấu hình TPOS Credentials"
        });
        throw new Error('No TPOS token');
      }
      return getTPOSHeaders(token);
    };

    // Expose showMessage globally for vanilla JS
    (window as any).showMessage = (type: string, text: string) => {
      const variant = type === 'error' ? 'destructive' : 'default';
      toast({
        variant,
        title: type === 'success' ? '✅ Thành công' : 
               type === 'error' ? '❌ Lỗi' : 
               type === 'warning' ? '⚠️ Cảnh báo' : 'ℹ️ Thông báo',
        description: text
      });
    };

    // Initialize vanilla JS after DOM is ready
    const timer = setTimeout(() => {
      initializeTPOSManager();
    }, 100);

    return () => {
      clearTimeout(timer);
      delete (window as any).getHeaders;
      delete (window as any).showMessage;
    };
  }, [toast]);

  return (
    <>
      <style>{`
        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-button.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .size-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
        }
        .size-chip-remove {
          background: rgba(255, 255, 255, 0.3);
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
      
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen -m-6 p-6">
        <div className="container mx-auto max-w-7xl">
          {/* Main Navigation */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-800">🚀 TPOS Manager</h1>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => (window as any).switchModule('product')} id="btnProduct" className="tab-button px-6 py-3 rounded-lg font-semibold transition active">
                  🛍️ Quản Lý Sản Phẩm
                </button>
                <button onClick={() => (window as any).switchModule('order')} id="btnOrder" className="tab-button px-6 py-3 rounded-lg font-semibold transition bg-gray-200 text-gray-700">
                  📦 Quản Lý Đơn Hàng
                </button>
              </div>
            </div>
          </div>

          {/* Message Alert */}
          <div id="messageAlert" className="hidden mb-6 p-4 rounded-lg flex items-center gap-3 fade-in"></div>

          {/* Product Module */}
          <div id="productModule">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Thêm Sản Phẩm Mới</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mã Sản Phẩm *</label>
                  <input type="text" id="defaultCode" placeholder="VD: NTEST" defaultValue="NTEST" 
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tên Sản Phẩm *</label>
                  <input type="text" id="productName" placeholder="Nhập tên sản phẩm"
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Giá Bán (VNĐ) *</label>
                  <input type="number" id="listPrice" defaultValue="200000" min="0"
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Giá Mua (VNĐ) *</label>
                  <input type="number" id="purchasePrice" defaultValue="100000" min="0"
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Số Lượng *</label>
                  <input type="number" id="qtyAvailable" defaultValue="1" min="0"
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hình Ảnh</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition" id="imageUpload">
                    <div id="imageUploadPlaceholder">
                      <p className="text-sm text-gray-600">📷 Click để chọn ảnh hoặc Paste (Ctrl+V)</p>
                    </div>
                    <div id="imagePreviewContainer" className="hidden">
                      <img id="imagePreview" src="" alt="Preview" className="max-h-40 mx-auto rounded-lg mb-2"/>
                      <button type="button" onClick={(e) => (window as any).removeImage(e)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">🗑️ Xóa ảnh</button>
                    </div>
                    <input type="file" id="fileInput" accept="image/*" className="hidden"/>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Biến Thể (AttributeLines)</label>
                <button onClick={() => (window as any).openAttributeModal()} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition">📝 Chọn Biến Thể</button>
                <textarea id="attributeLinesDisplay" readOnly className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-xs" rows={3} defaultValue="[]"></textarea>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => (window as any).createProductOneClick()} className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg">🚀 Tạo Sản Phẩm (1 Click)</button>
              </div>
            </div>
            <div id="productResult" className="hidden bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Kết Quả</h3>
              <pre id="productResultContent" className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs"></pre>
            </div>
          </div>

          {/* Order Module */}
          <div id="orderModule" className="hidden">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center"><div id="step1" className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-blue-500 text-white">1</div><div id="line1" className="w-20 h-1 bg-gray-200"></div></div>
                <div className="flex items-center"><div id="step2" className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-gray-200 text-gray-500">2</div><div id="line2" className="w-20 h-1 bg-gray-200"></div></div>
                <div className="flex items-center"><div id="step3" className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-gray-200 text-gray-500">3</div><div id="line3" className="w-20 h-1 bg-gray-200"></div></div>
                <div id="step4" className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-gray-200 text-gray-500">4</div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>Tìm đơn</span><span>Chọn đơn</span><span>Chọn SP</span><span>Cập nhật</span>
              </div>
            </div>
            <div id="stepContent1" className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📅 Bước 1: Chọn khoảng thời gian</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Ngày bắt đầu</label><input type="date" id="startDate" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Ngày kết thúc</label><input type="date" id="endDate" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Session Index</label><input type="text" id="sessionIndex" defaultValue="60" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
              </div>
              <button onClick={() => (window as any).fetchOrders()} id="btnFetchOrders" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition">Tìm đơn hàng</button>
            </div>
            <div id="stepContent2" className="hidden bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🛍️ Bước 2: Chọn đơn hàng (<span id="orderCount">0</span>)</h2>
              <div id="ordersList" className="max-h-96 overflow-y-auto space-y-3"></div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => (window as any).goToStep(1)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition">Quay lại</button>
                <button onClick={() => (window as any).fetchOrderDetail()} id="btnContinue" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition">Tiếp tục</button>
              </div>
            </div>
            <div id="stepContent3" className="hidden space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🔍 Bước 3: Tìm và chọn sản phẩm</h2>
                <div className="flex gap-3 mb-4">
                  <input type="text" id="productSearch" placeholder="Nhập tên hoặc mã sản phẩm..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" onKeyPress={(e) => e.key === 'Enter' && (window as any).searchProducts()}/>
                  <button onClick={() => (window as any).searchProducts()} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">Tìm</button>
                </div>
                <div id="productsList" className="max-h-64 overflow-y-auto space-y-2"></div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Sản phẩm đã chọn (<span id="selectedCount">0</span>)</h3>
                <div id="selectedProductsList"></div>
              </div>
              <div id="updateSection" className="hidden bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">💾 Bước 4: Cập nhật đơn hàng</h2>
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-gray-700"><strong>Đơn hàng:</strong> #<span id="orderCode"></span></p>
                  <p className="text-sm text-gray-700"><strong>Khách hàng:</strong> <span id="customerName"></span></p>
                  <p className="text-sm text-gray-700"><strong>Số sản phẩm mới:</strong> <span id="newProductCount"></span></p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => (window as any).goToStep(2)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition">Quay lại</button>
                  <button onClick={() => (window as any).updateOrder()} id="btnUpdate" className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition">Cập nhật đơn hàng</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attribute Modal */}
      <div id="attributeModal" className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Chọn Biến Thể</h3>
            <button onClick={() => (window as any).closeAttributeModal()} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
          </div>
          <div className="flex gap-2 mb-4 border-b">
            <button className="px-4 py-2 font-semibold border-b-2 border-blue-500 text-blue-500" onClick={(e) => (window as any).switchAttrTab('sizeText', e)}>Size Chữ</button>
            <button className="px-4 py-2 font-semibold text-gray-500" onClick={(e) => (window as any).switchAttrTab('color', e)}>Màu</button>
            <button className="px-4 py-2 font-semibold text-gray-500" onClick={(e) => (window as any).switchAttrTab('sizeNumber', e)}>Size Số</button>
          </div>
          <div id="tab-sizeText" className="attr-tab-content">
            <select id="sizeTextSelect" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"></select>
            <div id="sizeTextChips" className="min-h-16 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-2"></div>
          </div>
          <div id="tab-color" className="attr-tab-content hidden">
            <select id="colorSelect" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"></select>
            <div id="colorChips" className="min-h-16 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-2"></div>
          </div>
          <div id="tab-sizeNumber" className="attr-tab-content hidden">
            <select id="sizeNumberSelect" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"></select>
            <div id="sizeNumberChips" className="min-h-16 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-2"></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => (window as any).saveAttributeLines()} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition">✅ Lưu</button>
            <button onClick={() => (window as any).closeAttributeModal()} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition">❌ Hủy</button>
          </div>
        </div>
      </div>
    </>
  );
}

// Vanilla JS logic
function initializeTPOSManager() {
  // ========== PRODUCT MODULE - INLINE ==========
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
        { Id: 14, Name: "Nude", Code: "nude", Sequence: null },
        { Id: 15, Name: "Nâu", Code: "nau", Sequence: null },
        { Id: 16, Name: "Rêu", Code: "reu", Sequence: null },
        { Id: 17, Name: "Xanh", Code: "xanh", Sequence: null },
        { Id: 25, Name: "Bạc", Code: "bac", Sequence: null },
        { Id: 26, Name: "Tím", Code: "tim", Sequence: null },
        { Id: 27, Name: "Xanh Min", Code: "xanhmin", Sequence: null },
        { Id: 28, Name: "Trắng Kem", Code: "trangkem", Sequence: null },
        { Id: 29, Name: "Xanh Lá", Code: "xanhla", Sequence: null },
        { Id: 38, Name: "Cổ Vịt", Code: "co vit", Sequence: null },
        { Id: 40, Name: "Xanh Đậu", Code: "xanh dau", Sequence: null },
        { Id: 42, Name: "Tím Môn", Code: "timmon", Sequence: null },
        { Id: 43, Name: "Muối Tiêu", Code: "muoitieu", Sequence: null },
        { Id: 45, Name: "Kem", Code: "kem", Sequence: null },
        { Id: 47, Name: "Hồng Đậm", Code: "hongdam", Sequence: null },
        { Id: 49, Name: "Ghi", Code: "ghi", Sequence: null },
        { Id: 50, Name: "Xanh Mạ", Code: "xanhma", Sequence: null },
        { Id: 51, Name: "Vàng Đồng", Code: "vangdong", Sequence: null },
        { Id: 52, Name: "Xanh Bơ", Code: "xanhbo", Sequence: null },
        { Id: 53, Name: "Xanh Đen", Code: "xanhden", Sequence: null },
        { Id: 54, Name: "Xanh CoBan", Code: "xanhcoban", Sequence: null },
        { Id: 55, Name: "Xám Đậm", Code: "xamdam", Sequence: null },
        { Id: 56, Name: "Xám Nhạt", Code: "xamnhat", Sequence: null },
        { Id: 57, Name: "Xanh Dương", Code: "xanhduong", Sequence: null },
        { Id: 58, Name: "Cam Sữa", Code: "camsua", Sequence: null },
        { Id: 59, Name: "Hồng Nhạt", Code: "hongnhat", Sequence: null },
        { Id: 60, Name: "Đậm", Code: "dam", Sequence: null },
        { Id: 61, Name: "Nhạt", Code: "nhat", Sequence: null },
        { Id: 62, Name: "Xám Khói", Code: "xamkhoi", Sequence: null },
        { Id: 63, Name: "Xám Chuột", Code: "xamchuot", Sequence: null },
        { Id: 64, Name: "Xám Đen", Code: "xamden", Sequence: null },
        { Id: 65, Name: "Xám Trắng", Code: "xamtrang", Sequence: null },
        { Id: 66, Name: "Xanh Đậm", Code: "xanhdam", Sequence: null },
        { Id: 67, Name: "Sọc Đen", Code: "socden", Sequence: null },
        { Id: 68, Name: "Sọc Trắng", Code: "soctrang", Sequence: null },
        { Id: 69, Name: "Sọc Xám", Code: "socxam", Sequence: null },
        { Id: 70, Name: "Jean Trắng", Code: "jeantrang", Sequence: null },
        { Id: 71, Name: "Jean Xanh", Code: "jeanxanh", Sequence: null },
        { Id: 72, Name: "Cam Đất", Code: "camdat", Sequence: null },
        { Id: 73, Name: "Nâu Đậm", Code: "naudam", Sequence: null },
        { Id: 74, Name: "Nâu Nhạt", Code: "naunhat", Sequence: null },
        { Id: 75, Name: "Đỏ Tươi", Code: "dotuoi", Sequence: null },
        { Id: 76, Name: "Đen Vàng", Code: "denvang", Sequence: null },
        { Id: 77, Name: "Cà Phê", Code: "caphe", Sequence: null },
        { Id: 78, Name: "Đen Bạc", Code: "denbac", Sequence: null },
        { Id: 79, Name: "Bò", Code: "bo", Sequence: null },
        { Id: 82, Name: "Sọc Xanh", Code: "socxanh", Sequence: null },
        { Id: 83, Name: "Xanh Rêu", Code: "xanhreu", Sequence: null },
        { Id: 84, Name: "Hồng Ruốc", Code: "hongruoc", Sequence: null },
        { Id: 85, Name: "Hồng Dâu", Code: "hongdau", Sequence: null },
        { Id: 86, Name: "Xanh Nhạt", Code: "xanhnhat", Sequence: null },
        { Id: 87, Name: "Xanh Ngọc", Code: "xanhngoc", Sequence: null },
        { Id: 88, Name: "Caro", Code: "caro", Sequence: null },
        { Id: 89, Name: "Sọc Hồng", Code: "sochong", Sequence: null },
        { Id: 90, Name: "Trong", Code: "trong", Sequence: null },
        { Id: 95, Name: "Trắng Hồng", Code: "tranghong", Sequence: null },
        { Id: 96, Name: "Trắng Sáng", Code: "trangsang", Sequence: null },
        { Id: 97, Name: "Đỏ Đô", Code: "dodo", Sequence: null },
        { Id: 98, Name: "Cam Đào", Code: "camdao", Sequence: null },
        { Id: 99, Name: "Cam Lạnh", Code: "camlanh", Sequence: null },
        { Id: 100, Name: "Hồng Đào", Code: "hongdao", Sequence: null },
        { Id: 101, Name: "Hồng Đất", Code: "hongdat", Sequence: null },
        { Id: 102, Name: "Tím Đậm", Code: "timdam", Sequence: null },
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
        { Id: 46, Name: "34", Code: "34", Sequence: null },
        { Id: 33, Name: "35", Code: "35", Sequence: null },
        { Id: 34, Name: "36", Code: "36", Sequence: null },
        { Id: 35, Name: "37", Code: "37", Sequence: null },
        { Id: 36, Name: "38", Code: "38", Sequence: null },
        { Id: 37, Name: "39", Code: "39", Sequence: null },
        { Id: 44, Name: "40", Code: "40", Sequence: null },
        { Id: 91, Name: "41", Code: "41", Sequence: null },
        { Id: 92, Name: "42", Code: "42", Sequence: null },
        { Id: 93, Name: "43", Code: "43", Sequence: null },
        { Id: 94, Name: "44", Code: "44", Sequence: null },
        { Id: 22, Name: "1", Code: "1", Sequence: null },
        { Id: 23, Name: "2", Code: "2", Sequence: null },
        { Id: 24, Name: "3", Code: "3", Sequence: null },
        { Id: 48, Name: "4", Code: "4", Sequence: null },
      ],
    },
  };

  let currentAttributeLines: any[] = [];
  let imageBase64: string | null = null;
  let imagePreviewUrl: string | null = null;

  // Image handling
  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return (window as any).showMessage('error', 'Vui lòng chọn file hình ảnh');
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const fullDataUrl = e.target.result;
      imageBase64 = fullDataUrl.split(',')[1];
      imagePreviewUrl = fullDataUrl;
      (document.getElementById('imagePreview') as HTMLImageElement).src = imagePreviewUrl;
      document.getElementById('imageUploadPlaceholder')!.classList.add('hidden');
      document.getElementById('imagePreviewContainer')!.classList.remove('hidden');
      document.getElementById('imageUpload')!.classList.add('border-green-500');
      (window as any).showMessage('success', `Đã tải ảnh (${(file.size/1024).toFixed(2)} KB)`);
    };
    reader.readAsDataURL(file);
  }

  (window as any).removeImage = (event?: Event) => {
    if (event) event.stopPropagation();
    imageBase64 = null;
    imagePreviewUrl = null;
    (document.getElementById('imagePreview') as HTMLImageElement).src = '';
    document.getElementById('imageUploadPlaceholder')!.classList.remove('hidden');
    document.getElementById('imagePreviewContainer')!.classList.add('hidden');
    document.getElementById('imageUpload')!.classList.remove('border-green-500');
    (document.getElementById('fileInput') as HTMLInputElement).value = '';
    (window as any).showMessage('success', 'Đã xóa ảnh');
  };

  // Attribute modal
  (window as any).openAttributeModal = () => {
    try { currentAttributeLines = JSON.parse((document.getElementById('attributeLinesDisplay') as HTMLTextAreaElement).value); } catch(e) { currentAttributeLines = []; }
    populateSelect('sizeTextSelect', availableAttributes.sizeText.values);
    populateSelect('colorSelect', availableAttributes.color.values);
    populateSelect('sizeNumberSelect', availableAttributes.sizeNumber.values);
    renderChips('sizeText');
    renderChips('color');
    renderChips('sizeNumber');
    document.getElementById('attributeModal')!.classList.remove('hidden');
  };

  (window as any).closeAttributeModal = () => { 
    document.getElementById('attributeModal')!.classList.add('hidden'); 
  };

  (window as any).switchAttrTab = (tab: string, event: Event) => {
    document.querySelectorAll('.attr-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`)!.classList.remove('hidden');
    document.querySelectorAll('#attributeModal button').forEach(btn => {
      btn.classList.remove('border-blue-500', 'text-blue-500');
      btn.classList.add('text-gray-500');
    });
    (event.target as HTMLElement).classList.add('border-blue-500', 'text-blue-500');
    (event.target as HTMLElement).classList.remove('text-gray-500');
  };

  function populateSelect(selectId: string, values: any[]) {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    select.innerHTML = '<option value="">-- Chọn --</option>';
    values.forEach(item => select.innerHTML += `<option value="${item.Id}">${item.Name}</option>`);
    select.onchange = (e: any) => {
      const valueId = parseInt(e.target.value);
      if (!valueId) return;
      const type = selectId.replace('Select', '');
      const attrConfig = (availableAttributes as any)[type];
      const selectedValue = attrConfig.values.find((v: any) => v.Id === valueId);
      if (!selectedValue) return;
      let attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
      if (!attrLine) {
        attrLine = {
          Attribute: { Id: attrConfig.id, Name: attrConfig.name, Code: attrConfig.code, Sequence: null, CreateVariant: true },
          Values: [], AttributeId: attrConfig.id
        };
        currentAttributeLines.push(attrLine);
      }
      if (attrLine.Values.find((v: any) => v.Id === valueId)) { (window as any).showMessage('error', 'Giá trị đã được thêm'); e.target.value = ''; return; }
      attrLine.Values.push({
        Id: selectedValue.Id, Name: selectedValue.Name, Code: selectedValue.Code, Sequence: selectedValue.Sequence,
        AttributeId: attrConfig.id, AttributeName: attrConfig.name, PriceExtra: null,
        NameGet: `${attrConfig.name}: ${selectedValue.Name}`, DateCreated: null
      });
      renderChips(type);
      e.target.value = '';
    };
  }

  function renderChips(type: string) {
    const attrConfig = (availableAttributes as any)[type];
    const chipsContainer = document.getElementById(`${type}Chips`)!;
    chipsContainer.innerHTML = '';
    const attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
    if (!attrLine || !attrLine.Values || attrLine.Values.length === 0) {
      chipsContainer.innerHTML = '<p class="text-gray-400 text-sm">Chưa có giá trị</p>';
      return;
    }
    attrLine.Values.forEach((val: any) => {
      const chip = document.createElement('div');
      chip.className = 'size-chip';
      chip.innerHTML = `<span>${val.Name}</span><button class="size-chip-remove" onclick="window.removeValue('${type}', ${val.Id})">×</button>`;
      chipsContainer.appendChild(chip);
    });
  }

  (window as any).removeValue = (type: string, valueId: number) => {
    const attrConfig = (availableAttributes as any)[type];
    const attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
    if (!attrLine) return;
    attrLine.Values = attrLine.Values.filter((v: any) => v.Id !== valueId);
    if (attrLine.Values.length === 0) {
      currentAttributeLines = currentAttributeLines.filter(line => line.AttributeId !== attrLine.AttributeId);
    }
    renderChips(type);
  };

  (window as any).saveAttributeLines = () => {
    (document.getElementById('attributeLinesDisplay') as HTMLTextAreaElement).value = JSON.stringify(currentAttributeLines, null, 2);
    (window as any).closeAttributeModal();
    (window as any).showMessage('success', 'Đã lưu biến thể');
  };

  // Generate Variants
  function generateVariants(productName: string, listPrice: number, attributeLines: any[]) {
    if (!attributeLines || attributeLines.length === 0) return [];
    const combinations: any[] = [];
    function getCombinations(lines: any[], current: any[] = [], index = 0) {
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
      const variantName = attrs.map((a: any) => a.Name).join(', ');
      return {
        Id: 0, EAN13: null, DefaultCode: null, NameTemplate: productName, NameNoSign: null,
        ProductTmplId: 0, UOMId: 0, UOMName: null, UOMPOId: 0, QtyAvailable: 0, VirtualAvailable: 0,
        OutgoingQty: null, IncomingQty: null, NameGet: `${productName} (${variantName})`, POSCategId: null,
        Price: null, Barcode: null, Image: null, ImageUrl: null, Thumbnails: [], PriceVariant: listPrice,
        SaleOK: true, PurchaseOK: true, DisplayAttributeValues: null, LstPrice: 0, Active: true, ListPrice: 0,
        PurchasePrice: null, DiscountSale: null, DiscountPurchase: null, StandardPrice: 0, Weight: 0, Volume: null,
        OldPrice: null, IsDiscount: false, ProductTmplEnableAll: false, Version: 0, Description: null,
        LastUpdated: null, Type: "product", CategId: 0, CostMethod: null, InvoicePolicy: "order",
        Variant_TeamId: 0, Name: `${productName} (${variantName})`, PropertyCostMethod: null, PropertyValuation: null,
        PurchaseMethod: "receive", SaleDelay: 0, Tracking: null, Valuation: null, AvailableInPOS: true,
        CompanyId: null, IsCombo: null, NameTemplateNoSign: productName, TaxesIds: [], StockValue: null,
        SaleValue: null, PosSalesCount: null, Factor: null, CategName: null, AmountTotal: null, NameCombos: [],
        RewardName: null, Product_UOMId: null, Tags: null, DateCreated: null, InitInventory: 0, OrderTag: null,
        StringExtraProperties: null, CreatedById: null, TaxAmount: null, Error: null,
        AttributeValues: attrs.map((a: any) => ({
          Id: a.Id, Name: a.Name, Code: null, Sequence: null, AttributeId: a.AttributeId,
          AttributeName: a.AttributeName, PriceExtra: null, NameGet: a.NameGet, DateCreated: null
        }))
      };
    });
  }

  // Create product
  (window as any).createProductOneClick = async () => {
    const defaultCode = (document.getElementById('defaultCode') as HTMLInputElement).value.trim().toUpperCase();
    const productName = (document.getElementById('productName') as HTMLInputElement).value.trim();
    const listPrice = parseFloat((document.getElementById('listPrice') as HTMLInputElement).value);
    const purchasePrice = parseFloat((document.getElementById('purchasePrice') as HTMLInputElement).value);
    const qtyAvailable = parseFloat((document.getElementById('qtyAvailable') as HTMLInputElement).value);
    if (!defaultCode || !productName) return (window as any).showMessage('error', '⚠️ Vui lòng nhập đầy đủ thông tin!');
    
    try {
      (window as any).showMessage('info', '🔍 Đang kiểm tra...');
      const headers = await (window as any).getHeaders();
      const checkResponse = await fetch(`https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${defaultCode}`, { headers });
      const checkData = await checkResponse.json();
      if (checkData.value && checkData.value.length > 0) {
        (window as any).showMessage('error', '❌ Sản phẩm đã tồn tại! Mã: ' + defaultCode);
        displayProductResult('❌ Sản phẩm đã tồn tại', checkData.value[0]);
        return;
      }
      (window as any).showMessage('info', '✅ Đang tạo mới...');
      const attributeLines = JSON.parse((document.getElementById('attributeLinesDisplay') as HTMLTextAreaElement).value);
      const productVariants = generateVariants(productName, listPrice, attributeLines);
      const payload = {
        Id: 0, Name: productName, Type: "product", ListPrice: listPrice, PurchasePrice: purchasePrice,
        DefaultCode: defaultCode, QtyAvailable: qtyAvailable, Image: imageBase64, ImageUrl: null, Thumbnails: [],
        AttributeLines: attributeLines, ProductVariants: productVariants, Active: true, SaleOK: true, PurchaseOK: true,
        UOMId: 1, UOMPOId: 1, CategId: 2, CompanyId: 1, Tracking: "none", InvoicePolicy: "order",
        PurchaseMethod: "receive", AvailableInPOS: true, DiscountSale: 0, DiscountPurchase: 0, StandardPrice: 0,
        Weight: 0, SaleDelay: 0,
        UOM: { Id: 1, Name: "Cái", Rounding: 0.001, Active: true, Factor: 1, FactorInv: 1, UOMType: "reference", CategoryId: 1, CategoryName: "Đơn vị" },
        UOMPO: { Id: 1, Name: "Cái", Rounding: 0.001, Active: true, Factor: 1, FactorInv: 1, UOMType: "reference", CategoryId: 1, CategoryName: "Đơn vị" },
        Categ: { Id: 2, Name: "Có thể bán", CompleteName: "Có thể bán", Type: "normal", PropertyCostMethod: "average", NameNoSign: "Co the ban", IsPos: true },
        Items: [], UOMLines: [], ComboProducts: [], ProductSupplierInfos: []
      };
      const response = await fetch('https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO',
        { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.ok) {
        (window as any).showMessage('success', '🎉 Tạo sản phẩm thành công! Mã: ' + defaultCode);
        displayProductResult('✅ Thành công', data);
        (document.getElementById('productName') as HTMLInputElement).value = '';
        (document.getElementById('defaultCode') as HTMLInputElement).value = 'NTEST';
        (document.getElementById('attributeLinesDisplay') as HTMLTextAreaElement).value = '[]';
        currentAttributeLines = [];
        if (imageBase64) (window as any).removeImage();
      } else {
        (window as any).showMessage('error', '❌ Lỗi: ' + (data.error?.message || 'Unknown'));
        displayProductResult('❌ Lỗi', data);
      }
    } catch (error: any) {
      (window as any).showMessage('error', '❌ Lỗi: ' + error.message);
    }
  };

  function displayProductResult(title: string, data: any) {
    document.getElementById('productResult')!.classList.remove('hidden');
    document.getElementById('productResultContent')!.textContent = JSON.stringify(data, null, 2);
  }

  // ========== ORDER MODULE ==========
  let currentStep = 1;
  let orders: any[] = [];
  let selectedOrder: any = null;
  let products: any[] = [];
  let selectedProducts: any[] = [];
  let orderDetail: any = null;

  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  (document.getElementById('startDate') as HTMLInputElement).value = twoDaysAgo.toISOString().split('T')[0];
  (document.getElementById('endDate') as HTMLInputElement).value = today.toISOString().split('T')[0];

  function formatDateForAPI(dateStr: string, isEndDate = false) {
    const date = new Date(dateStr);
    if (isEndDate) { date.setHours(16, 59, 59, 0); } else { date.setHours(17, 0, 0, 0); date.setDate(date.getDate() - 1); }
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  (window as any).goToStep = (step: number) => { currentStep = step; updateStepUI(); };

  function updateStepUI() {
    document.getElementById('stepContent1')!.classList.toggle('hidden', currentStep !== 1);
    document.getElementById('stepContent2')!.classList.toggle('hidden', currentStep !== 2);
    document.getElementById('stepContent3')!.classList.toggle('hidden', currentStep < 3);
    document.getElementById('updateSection')!.classList.toggle('hidden', currentStep !== 4);
    for (let i = 1; i <= 4; i++) {
      const circle = document.getElementById(`step${i}`)!;
      circle.classList.toggle('bg-blue-500', i <= currentStep);
      circle.classList.toggle('text-white', i <= currentStep);
      circle.classList.toggle('bg-gray-200', i > currentStep);
      circle.classList.toggle('text-gray-500', i > currentStep);
    }
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`line${i}`)!.classList.toggle('bg-blue-500', i < currentStep);
    }
  }

  (window as any).fetchOrders = async () => {
    try {
      const startDate = formatDateForAPI((document.getElementById('startDate') as HTMLInputElement).value, false);
      const endDate = formatDateForAPI((document.getElementById('endDate') as HTMLInputElement).value, true);
      const sessionIndex = (document.getElementById('sessionIndex') as HTMLInputElement).value;
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=50&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDate} and DateCreated le ${endDate} and SessionIndex eq ${sessionIndex})&$count=true`;
      const headers = await (window as any).getHeaders();
      const response = await fetch(url, { headers });
      const data = await response.json();
      orders = data.value || [];
      displayOrders();
      (window as any).showMessage('success', `Tìm thấy ${data['@odata.count']} đơn hàng`);
      (window as any).goToStep(2);
    } catch (error: any) {
      (window as any).showMessage('error', 'Lỗi: ' + error.message);
    }
  };

  function displayOrders() {
    document.getElementById('orderCount')!.textContent = orders.length.toString();
    const container = document.getElementById('ordersList')!;
    container.innerHTML = orders.map(order => `
      <div onclick="window.selectOrder('${order.Id}')" id="order-${order.Id}" class="order-item p-4 border-2 rounded-lg cursor-pointer transition border-gray-200 hover:border-blue-300">
        <div class="flex justify-between">
          <div><p class="font-bold">#${order.Code}</p><p class="text-sm text-gray-600">${order.Name}</p></div>
          <div class="text-right"><p class="font-bold text-blue-600">${order.TotalAmount?.toLocaleString('vi-VN')}₫</p><p class="text-sm">SL: ${order.TotalQuantity}</p></div>
        </div>
      </div>
    `).join('');
  }

  (window as any).selectOrder = (orderId: string) => {
    selectedOrder = orders.find(o => o.Id === orderId);
    document.querySelectorAll('.order-item').forEach(item => item.classList.remove('border-blue-500', 'bg-blue-50'));
    document.getElementById(`order-${orderId}`)!.classList.add('border-blue-500', 'bg-blue-50');
  };

  (window as any).fetchOrderDetail = async () => {
    if (!selectedOrder) return (window as any).showMessage('error', 'Vui lòng chọn đơn hàng');
    try {
      const headers = await (window as any).getHeaders();
      const response = await fetch(`https://tomato.tpos.vn/odata/SaleOnline_Order(${selectedOrder.Id})?$expand=Details,Partner,User,CRMTeam`, { headers });
      orderDetail = await response.json();
      document.getElementById('orderCode')!.textContent = orderDetail.Code;
      document.getElementById('customerName')!.textContent = orderDetail.Name;
      (window as any).showMessage('success', 'Đã tải chi tiết đơn hàng');
      (window as any).goToStep(4);
    } catch (error: any) {
      (window as any).showMessage('error', 'Lỗi: ' + error.message);
    }
  };

  (window as any).searchProducts = async () => {
    const searchTerm = (document.getElementById('productSearch') as HTMLInputElement).value.trim();
    if (!searchTerm) return (window as any).showMessage('error', 'Vui lòng nhập tên sản phẩm');
    try {
      const headers = await (window as any).getHeaders();
      const response = await fetch(`https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2?Active=true&Name=${encodeURIComponent(searchTerm)}`, { headers });
      const data = await response.json();
      products = data.value || [];
      displayProducts();
      (window as any).showMessage('success', `Tìm thấy ${data['@odata.count']} sản phẩm`);
    } catch (error: any) {
      (window as any).showMessage('error', 'Lỗi: ' + error.message);
    }
  };

  function displayProducts() {
    document.getElementById('productsList')!.innerHTML = products.map(product => `
      <div class="p-3 border rounded-lg flex justify-between items-center hover:border-blue-300">
        <div><p class="font-semibold">${product.NameGet}</p><p class="text-sm text-gray-600">${product.ListPrice?.toLocaleString('vi-VN')}₫</p></div>
        <button onclick='window.addProductToList(${JSON.stringify(product).replace(/'/g, "&apos;")})' class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">Thêm</button>
      </div>
    `).join('');
  }

  (window as any).addProductToList = (product: any) => {
    if (selectedProducts.find(p => p.ProductId === product.Id)) return (window as any).showMessage('error', 'Sản phẩm đã được thêm');
    selectedProducts.push({
      ProductId: product.Id, ProductName: product.Name, ProductNameGet: product.NameGet,
      UOMId: 1, UOMName: product.UOMName || "Cái", Quantity: 1, Price: product.ListPrice || 0, Factor: 1, ProductWeight: 0
    });
    displaySelectedProducts();
    (window as any).showMessage('success', 'Đã thêm sản phẩm');
  };

  function displaySelectedProducts() {
    document.getElementById('selectedCount')!.textContent = selectedProducts.length.toString();
    document.getElementById('newProductCount')!.textContent = selectedProducts.length.toString();
    document.getElementById('selectedProductsList')!.innerHTML = selectedProducts.map((product, index) => `
      <div class="p-4 border rounded-lg flex justify-between items-center mb-3">
        <div class="flex-1"><p class="font-semibold">${product.ProductNameGet}</p><p class="text-sm text-gray-600">${product.Price?.toLocaleString('vi-VN')}₫</p></div>
        <div class="flex items-center gap-3">
          <input type="number" min="1" value="${product.Quantity}" onchange="window.updateQuantity(${index}, this.value)" class="w-20 px-3 py-2 border rounded-lg text-center">
          <button onclick="window.removeProduct(${index})" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Xóa</button>
        </div>
      </div>
    `).join('');
  }

  (window as any).updateQuantity = (index: number, quantity: string) => { selectedProducts[index].Quantity = parseInt(quantity) || 1; };
  (window as any).removeProduct = (index: number) => { selectedProducts.splice(index, 1); displaySelectedProducts(); };

  (window as any).updateOrder = async () => {
    if (!orderDetail || selectedProducts.length === 0) return (window as any).showMessage('error', 'Chưa đủ dữ liệu');
    try {
      const updatedOrder = { ...orderDetail, Details: selectedProducts };
      const headers = await (window as any).getHeaders();
      const response = await fetch(`https://tomato.tpos.vn/odata/SaleOnline_Order(${orderDetail.Id})`,
        { method: 'PUT', headers, body: JSON.stringify(updatedOrder) });
      if (response.ok) (window as any).showMessage('success', 'Cập nhật đơn hàng thành công!');
      else (window as any).showMessage('error', 'Lỗi khi cập nhật');
    } catch (error: any) {
      (window as any).showMessage('error', 'Lỗi: ' + error.message);
    }
  };

  // ========== SHARED UTILITIES ==========
  (window as any).switchModule = (module: string) => {
    ['productModule', 'orderModule'].forEach(m => {
      document.getElementById(m)!.classList.add('hidden');
    });
    document.getElementById(`${module}Module`)!.classList.remove('hidden');
    
    const buttons = ['btnProduct', 'btnOrder'];
    buttons.forEach(btn => {
      const el = document.getElementById(btn)!;
      el.classList.remove('active');
      el.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeBtn = module === 'product' ? 'btnProduct' : 'btnOrder';
    const activeEl = document.getElementById(activeBtn)!;
    activeEl.classList.add('active');
    activeEl.classList.remove('bg-gray-200', 'text-gray-700');
  };

  // ========== INITIALIZE ==========
  document.getElementById('defaultCode')!.addEventListener('input', (e: any) => e.target.value = e.target.value.toUpperCase());
  document.getElementById('imageUpload')!.addEventListener('click', () => (document.getElementById('fileInput') as HTMLInputElement).click());
  document.getElementById('fileInput')!.addEventListener('change', (e: any) => { if(e.target.files[0]) handleImageFile(e.target.files[0]); });
  document.addEventListener('paste', (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) handleImageFile(item.getAsFile()!);
    }
  });

  updateStepUI();
}
